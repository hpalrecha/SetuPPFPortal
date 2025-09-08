import { db } from '../db';
import { jobCards, workOrders, users } from '@shared/schema';
import { eq, and, sql, lt, isNull } from 'drizzle-orm';
import { notificationService } from '../services/notification';

export interface SLAConfig {
  awaitingAckHours: number;
  scheduledGraceHours: number;
}

export class SLAMonitor {
  private config: SLAConfig;

  constructor() {
    this.config = {
      awaitingAckHours: parseInt(process.env.SLA_AWAITING_ACK_HOURS || '24'),
      scheduledGraceHours: parseInt(process.env.SLA_SCHEDULED_GRACE_HOURS || '2')
    };
  }

  /**
   * Check for SLA breaches and send notifications
   */
  async checkSLABreaches(): Promise<void> {
    try {
      console.log('Running SLA breach check...');
      
      await Promise.all([
        this.checkAwaitingAckBreaches(),
        this.checkScheduledBreaches()
      ]);
      
      console.log('SLA breach check completed');
    } catch (error) {
      console.error('Error in SLA breach check:', error);
    }
  }

  /**
   * Check for job cards awaiting acknowledgment beyond SLA
   */
  private async checkAwaitingAckBreaches(): Promise<void> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.config.awaitingAckHours);

    const breachedJobCards = await db
      .select({
        jobCard: jobCards,
        workOrder: workOrders,
        partnerUser: users
      })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .leftJoin(users, and(
        eq(users.partnerId, jobCards.partnerId),
        eq(users.role, 'PARTNER_ADMIN')
      ))
      .where(and(
        eq(jobCards.status, 'AWAITING_ACK'),
        lt(jobCards.createdAt, cutoffTime)
      ));

    for (const breach of breachedJobCards) {
      const timeElapsed = this.getTimeElapsed(breach.jobCard.createdAt!);
      
      // Notify partner
      if (breach.partnerUser?.email) {
        await notificationService.sendFromTemplate(
          'job_card_reminder',
          breach.partnerUser.email,
          {
            jobCardId: `JC-${breach.jobCard.id.slice(-6)}`
          }
        );
      }

      // Notify showroom manager
      const showroomManager = await this.getShowroomManager(breach.workOrder.showroomId);
      if (showroomManager?.email) {
        await notificationService.notifySLABreach(
          [showroomManager.email],
          'Job Card',
          `JC-${breach.jobCard.id.slice(-6)}`,
          'AWAITING_ACK',
          timeElapsed
        );
      }
    }
  }

  /**
   * Check for scheduled job cards that haven't started
   */
  private async checkScheduledBreaches(): Promise<void> {
    const cutoffTime = new Date();

    const breachedJobCards = await db
      .select({
        jobCard: jobCards,
        workOrder: workOrders
      })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        eq(jobCards.status, 'SCHEDULED'),
        lt(sql`${jobCards.scheduledAt} + INTERVAL '${this.config.scheduledGraceHours} hours'`, cutoffTime),
        isNull(jobCards.startedAt)
      ));

    for (const breach of breachedJobCards) {
      const timeElapsed = this.getTimeElapsed(breach.jobCard.scheduledAt!);
      
      // Notify showroom manager about missed schedule
      const showroomManager = await this.getShowroomManager(breach.workOrder.showroomId);
      if (showroomManager?.email) {
        await notificationService.notifySLABreach(
          [showroomManager.email],
          'Job Card',
          `JC-${breach.jobCard.id.slice(-6)}`,
          'SCHEDULED_MISSED',
          timeElapsed
        );
      }
    }
  }

  /**
   * Get showroom manager for notifications
   */
  private async getShowroomManager(showroomId: string) {
    const [manager] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.showroomId, showroomId),
        eq(users.role, 'SHOWROOM_MANAGER'),
        eq(users.isActive, true)
      ))
      .limit(1);

    return manager;
  }

  /**
   * Calculate time elapsed since a timestamp
   */
  private getTimeElapsed(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${(hours % 24) > 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
}

export const slaMonitor = new SLAMonitor();
