// Central notification logger. Every outbound message (email / whatsapp / sms) is recorded
// here from the transport layer, plus in-app PUSH rows written directly by notificationService.
// Kept deliberately decoupled from the large `storage` class to avoid circular imports —
// it only depends on `db` and the schema. Logging must NEVER throw into a send path.
import { db } from '../db';
import { notificationLogs } from '@shared/schema';

export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH';
export type NotificationStatus = 'SENT' | 'FAILED';

// Optional context a caller can thread through to enrich a log row. All fields are optional —
// the transport layer always has channel/recipient/status; callers add the rest when known.
export interface NotificationContext {
  eventType?: string;
  recipientName?: string;
  recipientUserId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  oemId?: string;
}

export interface LogNotificationEntry extends NotificationContext {
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient?: string;
  subject?: string;
  bodyPreview?: string;   // raw text or HTML — stripped + truncated before storing
  payloadJson?: any;
  provider?: string;
  errorMessage?: string;
}

// Strip HTML tags, collapse whitespace, truncate — keeps the list view light.
function toPreview(text?: string, len = 300): string | undefined {
  if (!text) return undefined;
  const stripped = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > len ? `${stripped.slice(0, len)}…` : stripped;
}

export async function logNotification(entry: LogNotificationEntry): Promise<void> {
  try {
    await db.insert(notificationLogs).values({
      channel: entry.channel,
      status: entry.status,
      recipient: entry.recipient ?? null,
      recipientUserId: entry.recipientUserId ?? null,
      recipientName: entry.recipientName ?? null,
      eventType: entry.eventType ?? null,
      subject: entry.subject ?? null,
      bodyPreview: toPreview(entry.bodyPreview) ?? null,
      payloadJson: entry.payloadJson ?? null,
      provider: entry.provider ?? null,
      errorMessage: entry.errorMessage ?? null,
      relatedEntityType: entry.relatedEntityType ?? null,
      relatedEntityId: entry.relatedEntityId ?? null,
      oemId: entry.oemId ?? null,
    });
  } catch (err) {
    // Never let logging break the actual send.
    console.error('⚠️ Failed to persist notification log:', err);
  }
}
