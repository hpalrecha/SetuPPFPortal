import { db } from '../db';
import { storage } from '../storage';
import { jobCards, auditLogs, notificationLogs, users } from '@shared/schema';
import { inArray, and } from 'drizzle-orm';
import type { JobCard } from '@shared/schema';

const AUDIT_TIMELINE_ENTITIES = ['work_order', 'job_card', 'job_card_photo', 'job_card_media', 'job_card_rework_photo'];
const NOTIFICATION_TIMELINE_ENTITY_TYPES = ['work_order', 'job_card'];

const LIFECYCLE_EVENTS: Array<{ field: keyof JobCard; label: string }> = [
  { field: 'createdAt', label: 'Job card created' },
  { field: 'acknowledgedAt', label: 'Acknowledged by partner' },
  { field: 'scheduledAt', label: 'Installation scheduled' },
  { field: 'preInstallationCompletedAt', label: 'Pre-installation inspection completed' },
  { field: 'startedAt', label: 'Installation started' },
  { field: 'completedAt', label: 'Installation completed' },
  { field: 'approvalRequestedAt', label: 'Approval requested' },
  { field: 'approvedAt', label: 'Approved' },
  { field: 'paymentSettledAt', label: 'Payment settled' },
  { field: 'warrantyAppliedAt', label: 'Warranty applied' },
  { field: 'eWarrantyAppliedAt', label: 'E-warranty applied' },
  { field: 'reworkRequestedAt', label: 'Rework requested' },
  { field: 'reworkCompletedAt', label: 'Rework completed' },
];

export interface TimelineEvent {
  timestamp: string;
  category: 'status' | 'audit' | 'notification';
  label: string;
  jobCardTag: string;
  jobCardId?: string;
  recipientName?: string;
  channel?: string;
}

export interface JobCardChainEntry {
  id: string;
  tag: string;
  status: string | null;
}

export interface WorkOrderTimeline {
  workOrder: any;
  jobCardChain: JobCardChainEntry[];
  events: TimelineEvent[];
}

class TimelineService {
  // Orders a work order's job cards into their rework chain (original first,
  // each rework after the card it reworked). Falls back to createdAt order
  // for cards that don't cleanly chain (defensive — in practice each rework
  // points at exactly one prior card, forming a simple linear chain).
  private orderJobCardChain(cards: JobCard[]): JobCard[] {
    const byId = new Map(cards.map(c => [c.id, c]));
    const childOf = new Map<string, JobCard>();
    for (const c of cards) {
      if (c.reworkOfJobCardId && byId.has(c.reworkOfJobCardId)) {
        childOf.set(c.reworkOfJobCardId, c);
      }
    }

    const roots = cards
      .filter(c => !c.reworkOfJobCardId || !byId.has(c.reworkOfJobCardId))
      .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime());

    const ordered: JobCard[] = [];
    const visited = new Set<string>();
    for (const root of roots) {
      let current: JobCard | undefined = root;
      while (current && !visited.has(current.id)) {
        ordered.push(current);
        visited.add(current.id);
        current = childOf.get(current.id);
      }
    }
    for (const c of cards) {
      if (!visited.has(c.id)) ordered.push(c);
    }
    return ordered;
  }

  async getWorkOrderTimeline(workOrderId: string): Promise<WorkOrderTimeline | undefined> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) return undefined;

    const cards = await storage.getJobCards({ workOrderId });
    const orderedCards = this.orderJobCardChain(cards);

    const jobCardChain: JobCardChainEntry[] = orderedCards.map((c, index) => ({
      id: c.id,
      tag: index === 0 ? 'Job Card #1' : `Job Card #${index + 1} (rework)`,
      status: c.status,
    }));
    const tagByJobCardId = new Map(jobCardChain.map(entry => [entry.id, entry.tag]));

    const events: TimelineEvent[] = [];

    for (const card of orderedCards) {
      const tag = tagByJobCardId.get(card.id)!;
      for (const { field, label } of LIFECYCLE_EVENTS) {
        const value = (card as any)[field];
        if (value) {
          events.push({
            timestamp: new Date(value).toISOString(),
            category: 'status',
            label,
            jobCardTag: tag,
            jobCardId: card.id,
          });
        }
      }
    }

    const relevantIds = [workOrderId, ...orderedCards.map(c => c.id)];

    const auditRows = await db
      .select()
      .from(auditLogs)
      .where(and(
        inArray(auditLogs.entityId, relevantIds),
        inArray(auditLogs.entity, AUDIT_TIMELINE_ENTITIES)
      ));

    const actorIds = Array.from(new Set(auditRows.map(r => r.actorUserId).filter((id): id is string => !!id)));
    const actorRows = actorIds.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds))
      : [];
    const actorNameById = new Map(actorRows.map(u => [u.id, u.name]));

    for (const row of auditRows) {
      const tag = row.entityId === workOrderId ? 'Work Order' : (tagByJobCardId.get(row.entityId) || 'Work Order');
      const actorName = row.actorUserId ? actorNameById.get(row.actorUserId) : undefined;
      events.push({
        timestamp: new Date(row.createdAt as any).toISOString(),
        category: 'audit',
        label: actorName ? `${row.action} by ${actorName}` : row.action,
        jobCardTag: tag,
        jobCardId: row.entityId === workOrderId ? undefined : row.entityId,
      });
    }

    const notificationRows = await db
      .select()
      .from(notificationLogs)
      .where(and(
        inArray(notificationLogs.relatedEntityId, relevantIds),
        inArray(notificationLogs.relatedEntityType, NOTIFICATION_TIMELINE_ENTITY_TYPES)
      ));

    for (const row of notificationRows) {
      const relatedId = row.relatedEntityId as string;
      const tag = relatedId === workOrderId ? 'Work Order' : (tagByJobCardId.get(relatedId) || 'Work Order');
      events.push({
        timestamp: new Date(row.createdAt as any).toISOString(),
        category: 'notification',
        label: row.eventType || 'Notification sent',
        jobCardTag: tag,
        jobCardId: relatedId === workOrderId ? undefined : relatedId,
        recipientName: row.recipientName || row.recipient || undefined,
        channel: row.channel,
      });
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { workOrder, jobCardChain, events };
  }
}

export const timelineService = new TimelineService();
