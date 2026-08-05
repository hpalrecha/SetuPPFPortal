import { storage } from '../storage';
import { notificationService } from './notificationService';
import type { JobCard, User } from '@shared/schema';

// Statuses whose next action is owned by the PARTNER side. Reminder goes to the
// assigned installer (lowest authority); if none, the partner's admin(s).
const PARTNER_SIDE_STATUSES = [
  'AWAITING_ACK',
  'ACKNOWLEDGED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PARTS_PENDING',
  'RESCHEDULED',
  'REWORK_REQUESTED',
  'COMPLETED',
];

// Statuses whose next action is owned by the COMPANY side (approval / invoicing).
// Reminder goes to every active ADMIN + SUPER_ADMIN.
const COMPANY_SIDE_STATUSES = [
  'PENDING_APPROVAL',
  'REWORK_PERMISSION_REQUESTED',
  'APPROVED',
  'PENDING_SALES_INVOICE',
  'INVOICE_RAISED',
];

// The full set of "pending / not yet completed" statuses that get reminded.
// Everything else (WARRANTY_REGISTRATION, PAYMENT_PENDING, CLOSED, NO_SHOW,
// CANCELLED, CANCELLED_BY_CUSTOMER) is terminal/post-warranty and is skipped.
const PENDING_STATUSES = [...PARTNER_SIDE_STATUSES, ...COMPANY_SIDE_STATUSES];

const isActive = (u: { isActive?: boolean | null }) => u.isActive !== false;

// Recipients (matched by email, case-insensitive) that must NEVER receive
// reminders. Configured via REMINDER_EXCLUDE_EMAILS (comma/space separated).
function excludedEmails(): Set<string> {
  return new Set(
    (process.env.REMINDER_EXCLUDE_EMAILS || '')
      .split(/[\s,]+/)
      .map(e => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Keep only active users who are not on the exclusion list.
function eligible(users: User[], excluded: Set<string>): User[] {
  return users.filter(u => isActive(u) && !(u.email && excluded.has(u.email.toLowerCase())));
}

// Resolve the responsible recipient user(s) for a single pending job card,
// with excluded addresses removed.
async function resolveRecipients(jobCard: JobCard): Promise<User[]> {
  const status = jobCard.status || '';
  const excluded = excludedEmails();

  // Company-side: notify all eligible admins + super admins.
  if (COMPANY_SIDE_STATUSES.includes(status)) {
    const [supers, admins] = await Promise.all([
      storage.getUsers({ role: 'SUPER_ADMIN' }),
      storage.getUsers({ role: 'ADMIN' }),
    ]);
    const map = new Map<string, User>();
    eligible([...supers, ...admins], excluded).forEach(u => map.set(u.id, u));
    return Array.from(map.values());
  }

  // Partner-side: assigned installer (lowest authority) if present, active, and
  // not excluded.
  if (jobCard.assignedInstallerId) {
    const installer = await storage.getUser(jobCard.assignedInstallerId).catch(() => null);
    if (installer) {
      const kept = eligible([installer], excluded);
      if (kept.length > 0) return kept;
      // installer inactive/excluded -> fall through to partner admin
    }
  }

  // Otherwise escalate to the partner's admin(s). users.partnerId is reliably set
  // for PARTNER_ADMIN, so filter the admin list by this job card's partner.
  if (jobCard.partnerId) {
    const partnerAdmins = eligible(
      (await storage.getUsers({ role: 'PARTNER_ADMIN' })).filter(u => u.partnerId === jobCard.partnerId),
      excluded,
    );
    if (partnerAdmins.length > 0) {
      return partnerAdmins;
    }
  }

  // No partner / no partner admin: fall back to super admins so nothing is lost.
  return eligible(await storage.getUsers({ role: 'SUPER_ADMIN' }), excluded);
}

export interface ReminderSweepResult {
  scanned: number;      // pending cards found
  processed: number;    // cards we attempted (not skipped by dedup)
  skippedDuplicate: number; // cards already reminded today
  remindersSent: number;    // recipient-sends attempted
}

// Sweep every pending job card and send at most one reminder per card per day to
// the responsible recipient(s). Safe to call repeatedly (idempotent via the
// notification_logs dedup check).
export async function runPendingJobCardReminders(): Promise<ReminderSweepResult> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const jobCards = await storage.getJobCardsByStatuses(PENDING_STATUSES);
  const result: ReminderSweepResult = { scanned: jobCards.length, processed: 0, skippedDuplicate: 0, remindersSent: 0 };

  for (const jobCard of jobCards) {
    try {
      // One reminder per card per day, even across restarts / repeated sweeps.
      const already = await storage.hasJobCardReminderSince(jobCard.id, startOfToday);
      if (already) {
        result.skippedDuplicate++;
        continue;
      }

      const recipients = await resolveRecipients(jobCard);
      result.processed++;

      for (const user of recipients) {
        try {
          await notificationService.sendJobCardPendingReminder(jobCard, user.id);
          result.remindersSent++;
        } catch (err) {
          console.error(`[jobCardReminders] Failed to remind user ${user.id} for job card ${jobCard.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[jobCardReminders] Error processing job card ${jobCard.id}:`, err);
    }
  }

  console.log(
    `[jobCardReminders] sweep done — scanned ${result.scanned}, processed ${result.processed}, ` +
    `skipped(dup) ${result.skippedDuplicate}, reminders sent ${result.remindersSent}`,
  );
  return result;
}

// Start the in-process daily scheduler. Runs an initial sweep shortly after boot
// ("start immediately"), then once per day at REMINDER_HOUR (local). The per-day
// dedup makes the initial + daily runs (and restarts) safe from double-sending.
//   REMINDER_ENABLED = 'false'  -> disable entirely
//   REMINDER_HOUR    = 0..23    -> daily run hour (default 9)
export function startPendingReminderScheduler(): void {
  if (process.env.REMINDER_ENABLED === 'false') {
    console.log('[jobCardReminders] scheduler disabled (REMINDER_ENABLED=false)');
    return;
  }

  const parsedHour = parseInt(process.env.REMINDER_HOUR || '9', 10);
  const hour = Number.isFinite(parsedHour) ? Math.min(Math.max(parsedHour, 0), 23) : 9;

  const runSafely = () => {
    runPendingJobCardReminders().catch(err =>
      console.error('[jobCardReminders] sweep failed:', err));
  };

  // Initial sweep ~60s after boot to let the server settle.
  setTimeout(runSafely, 60_000);

  // First daily run at HH:00 local, then every 24h.
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  const msUntilNext = next.getTime() - now.getTime();

  setTimeout(() => {
    runSafely();
    setInterval(runSafely, 24 * 60 * 60 * 1000);
  }, msUntilNext);

  console.log(
    `[jobCardReminders] scheduler started — daily at ${hour}:00 ` +
    `(first run in ~${Math.round(msUntilNext / 60000)} min; initial sweep in 60s)`,
  );
}
