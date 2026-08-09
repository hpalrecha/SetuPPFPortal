// Notification templates — code defaults + admin overrides (notification_templates table).
// Email subject/body are freely editable and support {placeholders}. WhatsApp is a Meta-approved
// template NAME + language mapping (body wording is approved on Meta's side, not editable here).
// Decoupled from the large storage class (talks to db directly, like notificationLog.ts).
import { db } from '../db';
import { notificationTemplates } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface NotifTemplate {
  eventType: string;
  label: string;
  emailSubject: string;
  emailBody: string;
  emailActive: boolean;
  whatsappTemplateName: string;
  whatsappLanguage: string;
  whatsappActive: boolean;
}

// Placeholders the editor may use in email subject/body.
export const TEMPLATE_PLACEHOLDERS = ['{jobId}', '{vehicle}', '{when}', '{reason}', '{partner}', '{customer}'];

export const DEFAULT_TEMPLATES: Record<string, NotifTemplate> = {
  job_card_acknowledged: {
    eventType: 'job_card_acknowledged', label: 'Acknowledged → assigned team',
    emailSubject: 'Job assigned to your team',
    emailBody: 'Job card {jobId} for {vehicle} was acknowledged and is assigned to your team.',
    emailActive: true, whatsappTemplateName: 'job_card_created', whatsappLanguage: 'en_IN', whatsappActive: true,
  },
  job_card_scheduled: {
    eventType: 'job_card_scheduled', label: 'Scheduled',
    emailSubject: 'Job scheduled',
    emailBody: 'Job card {jobId} for {vehicle} is scheduled for {when}.',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_card_completed_customer: {
    eventType: 'job_card_completed_customer', label: 'Completed → everyone incl. customer',
    emailSubject: 'Job Completed - {vehicle}',
    emailBody: 'The job for {vehicle} is completed. For any rework a 15-day buffer applies, during which the rework is reviewed and a team assigned; after 15 days a car checkup is scheduled and its availability will be informed accordingly.',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_card_rework: {
    eventType: 'job_card_rework', label: 'Rework requested',
    emailSubject: 'Rework Requested - {vehicle}',
    emailBody: 'Rework requested for {vehicle}: {reason}',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_card_rescheduled: {
    eventType: 'job_card_rescheduled', label: 'Rescheduled',
    emailSubject: 'Job rescheduled',
    emailBody: 'Job card {jobId} for {vehicle} has been rescheduled to {when}. Reason: {reason}',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_card_approved: {
    eventType: 'job_card_approved', label: 'Approved',
    emailSubject: 'Job approved',
    emailBody: 'Job card {jobId} for {vehicle} has been approved.',
    emailActive: true, whatsappTemplateName: 'job_card_approved', whatsappLanguage: 'en', whatsappActive: true,
  },
  job_arrival_check: {
    eventType: 'job_arrival_check', label: 'Reminder 3h — team arrival check',
    emailSubject: 'Heading to site? — {vehicle}',
    emailBody: 'Job card {jobId} ({vehicle}) is scheduled at {when}. Are you heading to the site? Please confirm.',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_car_ready_check: {
    eventType: 'job_car_ready_check', label: 'Reminder 3h — car ready check',
    emailSubject: 'Is the car ready? — {vehicle}',
    emailBody: 'Job card {jobId} ({vehicle}) is scheduled at {when}. Is the car ready so the team can be dispatched?',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_at_time_check: {
    eventType: 'job_at_time_check', label: 'Reminder — at scheduled time',
    emailSubject: 'Appointment time — {vehicle}',
    emailBody: 'It is time for job {jobId} ({vehicle}). Please confirm arrival; the authority can then mark the job Reached.',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
  job_checkup_due: {
    eventType: 'job_checkup_due', label: 'Reminder — 15-day checkup due',
    emailSubject: 'Checkup due — {vehicle}',
    emailBody: 'The post-installation checkup for {vehicle} (job {jobId}) is due within the 15-day window. Please schedule the team to do the checkup.',
    emailActive: true, whatsappTemplateName: '', whatsappLanguage: 'en', whatsappActive: false,
  },
};

let cache: Record<string, NotifTemplate> | null = null;
let cacheAt = 0;
const TTL = 30_000;

function clean(o?: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  if (!o) return out;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

// Merge code defaults with any DB overrides.
export async function getAllTemplates(): Promise<NotifTemplate[]> {
  let overrides: Record<string, any> = {};
  try {
    const rows = await db.select().from(notificationTemplates);
    for (const r of rows) {
      overrides[r.eventType] = clean({
        emailSubject: r.emailSubject, emailBody: r.emailBody, emailActive: r.emailActive,
        whatsappTemplateName: r.whatsappTemplateName, whatsappLanguage: r.whatsappLanguage, whatsappActive: r.whatsappActive,
      });
    }
  } catch (e) {
    console.error('getAllTemplates: override load failed, using defaults', e);
  }
  return Object.values(DEFAULT_TEMPLATES).map((d) => ({ ...d, ...(overrides[d.eventType] || {}) }));
}

export async function getTemplate(eventType: string): Promise<NotifTemplate> {
  const now = Date.now();
  if (!cache || now - cacheAt > TTL) {
    const all = await getAllTemplates();
    cache = Object.fromEntries(all.map((t) => [t.eventType, t]));
    cacheAt = now;
  }
  return cache[eventType] || DEFAULT_TEMPLATES[eventType];
}

export function invalidateTemplateCache(): void {
  cache = null;
}

export async function upsertTemplate(eventType: string, patch: Partial<NotifTemplate>): Promise<void> {
  if (!DEFAULT_TEMPLATES[eventType]) throw new Error(`Unknown template event: ${eventType}`);
  const values: any = {
    eventType,
    emailSubject: patch.emailSubject,
    emailBody: patch.emailBody,
    emailActive: patch.emailActive,
    whatsappTemplateName: patch.whatsappTemplateName,
    whatsappLanguage: patch.whatsappLanguage,
    whatsappActive: patch.whatsappActive,
    updatedAt: new Date(),
  };
  await db
    .insert(notificationTemplates)
    .values(values)
    .onConflictDoUpdate({ target: notificationTemplates.eventType, set: values });
  invalidateTemplateCache();
}

// Substitute {placeholders}; unknown keys are left intact.
export function fillTemplate(text: string | undefined, vars: Record<string, string | undefined>): string {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}
