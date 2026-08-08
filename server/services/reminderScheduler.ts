// Cluster 3 — time-based appointment reminders. A single setInterval tick (no Redis) started
// from server/index.ts. Fires each reminder once per job card (deduped via job_reminders),
// respects quiet hours, and is re-entrancy guarded. Testable on demand via runOnce({dryRun}).
import { db } from '../db';
import { jobCards, jobReminders } from '@shared/schema';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { notifyPre3h, notifyAtTime } from './jobCardNotifications';

const TICK_MINUTES = Number(process.env.REMINDER_TICK_MINUTES || 5);
const PRE_HOURS = Number(process.env.REMINDER_PRE_HOURS || 3);
const QUIET_START = Number(process.env.REMINDER_QUIET_START ?? 21); // 21:00
const QUIET_END = Number(process.env.REMINDER_QUIET_END ?? 8);      // 08:00
const ENABLED = (process.env.REMINDERS_ENABLED ?? 'true') !== 'false';

let timer: NodeJS.Timeout | null = null;
let running = false;

function inQuietHours(d = new Date()): boolean {
  const h = d.getHours();
  return QUIET_START > QUIET_END ? (h >= QUIET_START || h < QUIET_END) : (h >= QUIET_START && h < QUIET_END);
}

async function alreadySent(jobCardId: string, key: string): Promise<boolean> {
  const [row] = await db.select().from(jobReminders)
    .where(and(eq(jobReminders.jobCardId, jobCardId), eq(jobReminders.reminderKey, key)));
  return !!row;
}

async function markSent(jobCardId: string, key: string): Promise<void> {
  await db.insert(jobReminders).values({ jobCardId, reminderKey: key }).onConflictDoNothing();
}

export interface RunSummary {
  checked: number;
  pre3h: string[];
  atTime: string[];
  skippedQuiet: boolean;
}

export async function runOnce(opts: { dryRun?: boolean } = {}): Promise<RunSummary> {
  const now = new Date();
  const quiet = inQuietHours(now);
  const summary: RunSummary = { checked: 0, pre3h: [], atTime: [], skippedQuiet: quiet };

  // Candidates: scheduled/rescheduled, have a time, not yet started.
  const rows = await db.select().from(jobCards).where(and(
    inArray(jobCards.status, ['SCHEDULED', 'RESCHEDULED'] as any),
    isNotNull(jobCards.scheduledAt),
    isNull(jobCards.startedAt),
  ));
  summary.checked = rows.length;

  // Quiet hours: defer real sends (dry-run still reports what it would do).
  if (quiet && !opts.dryRun) return summary;

  const preWindowMs = PRE_HOURS * 3_600_000;
  const atGraceMs = 6 * 3_600_000; // only ping "at time" within 6h of the appointment, not months-old ones

  for (const jc of rows) {
    const sched = jc.scheduledAt ? new Date(jc.scheduledAt).getTime() : 0;
    const msToAppt = sched - now.getTime();

    // pre_3h: appointment is in the future but within the pre-window.
    if (msToAppt > 0 && msToAppt <= preWindowMs && !(await alreadySent(jc.id, 'pre_3h'))) {
      summary.pre3h.push(jc.id);
      if (!opts.dryRun) { await notifyPre3h(jc.id); await markSent(jc.id, 'pre_3h'); }
    }

    // at_time: appointment time has arrived (within the grace window).
    if (msToAppt <= 0 && msToAppt >= -atGraceMs && !(await alreadySent(jc.id, 'at_time'))) {
      summary.atTime.push(jc.id);
      if (!opts.dryRun) { await notifyAtTime(jc.id); await markSent(jc.id, 'at_time'); }
    }
  }

  return summary;
}

export function start(): void {
  if (!ENABLED) {
    console.log('⏰ Reminder scheduler disabled (REMINDERS_ENABLED=false)');
    return;
  }
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const s = await runOnce();
      if (s.pre3h.length || s.atTime.length) console.log('⏰ reminders sent', s);
    } catch (e) {
      console.error('reminder tick failed', e);
    } finally {
      running = false;
    }
  }, TICK_MINUTES * 60_000);
  console.log(`⏰ Reminder scheduler started (every ${TICK_MINUTES}m · ${PRE_HOURS}h pre · quiet ${QUIET_START}:00–${QUIET_END}:00)`);
}
