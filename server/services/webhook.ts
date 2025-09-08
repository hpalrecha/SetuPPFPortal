import crypto from 'crypto';
import { storage } from '../storage';

export interface WebhookEvent {
  event: string;
  data: Record<string, any>;
  timestamp: string;
  tenantId?: string;
}

export interface WebhookSubscription {
  id: string;
  tenantScope?: string;
  event: string;
  targetUrl: string;
  secret?: string;
  isActive: boolean;
}

export class WebhookService {
  private readonly webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
  }

  /**
   * Emit webhook event to all subscribed endpoints
   */
  async emitEvent(event: WebhookEvent): Promise<void> {
    try {
      // Get all active subscriptions for this event
      const subscriptions = await this.getSubscriptions(event.event, event.tenantId);
      
      const promises = subscriptions.map(subscription => 
        this.deliverWebhook(subscription, event)
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error emitting webhook event:', error);
    }
  }

  /**
   * Deliver webhook to a specific subscription
   */
  private async deliverWebhook(
    subscription: WebhookSubscription, 
    event: WebhookEvent
  ): Promise<void> {
    try {
      const payload = JSON.stringify({
        id: crypto.randomUUID(),
        event: event.event,
        data: event.data,
        timestamp: event.timestamp,
        tenant_id: event.tenantId
      });

      const signature = this.generateSignature(payload, subscription.secret || this.webhookSecret);

      const response = await fetch(subscription.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.event,
          'User-Agent': 'SetuPPF-Webhook/1.0'
        },
        body: payload,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        console.error(`Webhook delivery failed for ${subscription.targetUrl}:`, {
          status: response.status,
          statusText: response.statusText,
          event: event.event
        });
      } else {
        console.log(`Webhook delivered successfully to ${subscription.targetUrl} for event ${event.event}`);
      }
    } catch (error) {
      console.error(`Error delivering webhook to ${subscription.targetUrl}:`, error);
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret?: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret || this.webhookSecret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get subscriptions for an event and tenant
   */
  private async getSubscriptions(event: string, tenantId?: string): Promise<WebhookSubscription[]> {
    // This would query the webhook_subscriptions table
    // For now, return empty array as implementation would depend on actual DB queries
    console.log(`Getting subscriptions for event ${event}, tenant ${tenantId}`);
    return [];
  }

  /**
   * Emit work order events
   */
  async emitWorkOrderEvent(
    event: 'work_order.created' | 'work_order.submitted' | 'work_order.assigned' | 'work_order.status_changed',
    workOrderId: string,
    data: Record<string, any>
  ): Promise<void> {
    await this.emitEvent({
      event,
      data: {
        work_order_id: workOrderId,
        ...data
      },
      timestamp: new Date().toISOString(),
      tenantId: data.oem_id
    });
  }

  /**
   * Emit job card events
   */
  async emitJobCardEvent(
    event: 'job_card.created' | 'job_card.scheduled' | 'job_card.in_progress' | 'job_card.completed' | 'job_card.approved' | 'job_card.rework_requested',
    jobCardId: string,
    data: Record<string, any>
  ): Promise<void> {
    await this.emitEvent({
      event,
      data: {
        job_card_id: jobCardId,
        ...data
      },
      timestamp: new Date().toISOString(),
      tenantId: data.oem_id
    });
  }

  /**
   * Emit payout events
   */
  async emitPayoutEvent(
    event: 'payout.computed' | 'payout.paid',
    payoutId: string,
    data: Record<string, any>
  ): Promise<void> {
    await this.emitEvent({
      event,
      data: {
        payout_id: payoutId,
        ...data
      },
      timestamp: new Date().toISOString(),
      tenantId: data.oem_id
    });
  }

  /**
   * Emit commission events
   */
  async emitCommissionEvent(
    event: 'commission.computed' | 'commission.paid',
    commissionId: string,
    data: Record<string, any>
  ): Promise<void> {
    await this.emitEvent({
      event,
      data: {
        commission_id: commissionId,
        ...data
      },
      timestamp: new Date().toISOString(),
      tenantId: data.oem_id
    });
  }
}

export const webhookService = new WebhookService();
