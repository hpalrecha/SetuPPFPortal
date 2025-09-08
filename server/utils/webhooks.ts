import crypto from 'crypto';

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: any;
  tenant?: {
    oemId?: string;
    dealershipId?: string;
    showroomId?: string;
  };
}

export interface WebhookSubscription {
  id: string;
  tenantScope: string;
  event: string;
  targetUrl: string;
  secret: string;
  isActive: boolean;
}

export class WebhookService {
  private static readonly SIGNATURE_HEADER = 'X-SetuPPF-Signature';
  private static readonly TIMESTAMP_HEADER = 'X-SetuPPF-Timestamp';
  private static readonly EVENT_TYPE_HEADER = 'X-SetuPPF-Event-Type';

  static generateSignature(payload: string, secret: string, timestamp: string): string {
    const message = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
  }

  static verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string,
    toleranceSeconds: number = 300
  ): boolean {
    // Check timestamp tolerance (5 minutes by default)
    const currentTime = Math.floor(Date.now() / 1000);
    const receivedTime = parseInt(timestamp);
    
    if (Math.abs(currentTime - receivedTime) > toleranceSeconds) {
      throw new Error('Webhook timestamp too old');
    }

    // Verify signature
    const expectedSignature = this.generateSignature(payload, secret, timestamp);
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  static createWebhookEvent(type: string, data: any, tenant?: any): WebhookEvent {
    return {
      id: `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      type,
      timestamp: new Date().toISOString(),
      data,
      tenant
    };
  }

  static async deliverWebhook(
    subscription: WebhookSubscription,
    event: WebhookEvent,
    maxRetries: number = 3
  ): Promise<boolean> {
    const payload = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.generateSignature(payload, subscription.secret, timestamp);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(subscription.targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [this.SIGNATURE_HEADER]: signature,
            [this.TIMESTAMP_HEADER]: timestamp,
            [this.EVENT_TYPE_HEADER]: event.type,
            'User-Agent': 'SetuPPF-Webhook/1.0'
          },
          body: payload,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (response.ok) {
          console.log(`✅ Webhook delivered successfully to ${subscription.targetUrl} (attempt ${attempt})`);
          return true;
        } else {
          console.warn(`⚠️ Webhook delivery failed with status ${response.status} (attempt ${attempt})`);
          
          // Don't retry for client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            console.error(`❌ Webhook delivery failed permanently due to client error: ${response.status}`);
            return false;
          }
        }
      } catch (error) {
        console.error(`❌ Webhook delivery attempt ${attempt} failed:`, error);
      }

      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, ...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.error(`❌ Webhook delivery failed permanently after ${maxRetries} attempts`);
    return false;
  }

  // Predefined event types
  static readonly Events = {
    // Work Order Events
    WORK_ORDER_CREATED: 'work_order.created',
    WORK_ORDER_SUBMITTED: 'work_order.submitted',
    WORK_ORDER_ASSIGNED: 'work_order.assigned',
    WORK_ORDER_STATUS_CHANGED: 'work_order.status_changed',
    WORK_ORDER_CANCELLED: 'work_order.cancelled',
    WORK_ORDER_COMPLETED: 'work_order.completed',
    WORK_ORDER_APPROVED: 'work_order.approved',

    // Job Card Events
    JOB_CARD_CREATED: 'job_card.created',
    JOB_CARD_ACKNOWLEDGED: 'job_card.acknowledged',
    JOB_CARD_SCHEDULED: 'job_card.scheduled',
    JOB_CARD_STARTED: 'job_card.started',
    JOB_CARD_IN_PROGRESS: 'job_card.in_progress',
    JOB_CARD_COMPLETED: 'job_card.completed',
    JOB_CARD_APPROVED: 'job_card.approved',
    JOB_CARD_REJECTED: 'job_card.rejected',
    JOB_CARD_REWORK_REQUESTED: 'job_card.rework_requested',

    // Payout Events
    PAYOUT_COMPUTED: 'payout.computed',
    PAYOUT_PROCESSED: 'payout.processed',
    PAYOUT_PAID: 'payout.paid',
    PAYOUT_FAILED: 'payout.failed',

    // Commission Events
    COMMISSION_COMPUTED: 'commission.computed',
    COMMISSION_PAID: 'commission.paid',

    // SLA Events
    SLA_BREACH_WARNING: 'sla.breach.warning',
    SLA_BREACH_CRITICAL: 'sla.breach.critical',

    // Partner Events
    PARTNER_ALLOCATED: 'partner.allocated',
    PARTNER_DEALLOCATED: 'partner.deallocated',

    // Pricing Events
    PRICING_RULE_CREATED: 'pricing_rule.created',
    PRICING_RULE_UPDATED: 'pricing_rule.updated',
    PRICING_RULE_EXPIRED: 'pricing_rule.expired'
  } as const;

  // Event data transformers
  static transformWorkOrderEvent(workOrder: any): any {
    return {
      workOrder: {
        id: workOrder.id,
        status: workOrder.status,
        customerName: workOrder.customerName,
        customerPhone: workOrder.customerPhone,
        vehicleInfo: {
          brand: workOrder.vehicleBrand?.name,
          model: workOrder.vehicleModel?.modelName,
          regNo: workOrder.regNo
        },
        service: workOrder.service?.name,
        estimatedPrice: workOrder.estimatedPrice,
        finalPrice: workOrder.finalPrice,
        createdAt: workOrder.createdAt,
        updatedAt: workOrder.updatedAt
      }
    };
  }

  static transformJobCardEvent(jobCard: any, workOrder?: any): any {
    return {
      jobCard: {
        id: jobCard.id,
        status: jobCard.status,
        scheduledAt: jobCard.scheduledAt,
        startedAt: jobCard.startedAt,
        completedAt: jobCard.completedAt,
        partnerRemarks: jobCard.partnerRemarks,
        createdAt: jobCard.createdAt,
        updatedAt: jobCard.updatedAt
      },
      workOrder: workOrder ? {
        id: workOrder.id,
        customerName: workOrder.customerName,
        vehicleInfo: {
          brand: workOrder.vehicleBrand?.name,
          model: workOrder.vehicleModel?.modelName,
          regNo: workOrder.regNo
        }
      } : undefined
    };
  }

  static transformPayoutEvent(payout: any): any {
    return {
      payout: {
        id: payout.id,
        partnerId: payout.partnerId,
        grossAmount: payout.grossAmount,
        netAmount: payout.netAmount,
        status: payout.status,
        paidAt: payout.paidAt,
        createdAt: payout.createdAt
      }
    };
  }

  static transformCommissionEvent(commission: any): any {
    return {
      commission: {
        id: commission.id,
        salesPersonId: commission.salesPersonId,
        showroomId: commission.showroomId,
        computedAmount: commission.computedAmount,
        status: commission.status,
        paidAt: commission.paidAt,
        createdAt: commission.createdAt
      }
    };
  }

  // Helper method for creating and delivering webhooks
  static async emitEvent(
    eventType: string,
    data: any,
    tenant?: { oemId?: string; dealershipId?: string; showroomId?: string }
  ): Promise<void> {
    try {
      const event = this.createWebhookEvent(eventType, data, tenant);
      
      // Get active subscriptions for this event type and tenant
      const subscriptions = await this.getActiveSubscriptions(eventType, tenant);
      
      // Deliver to all matching subscriptions
      const deliveryPromises = subscriptions.map(subscription =>
        this.deliverWebhook(subscription, event)
      );
      
      await Promise.allSettled(deliveryPromises);
      
      console.log(`📡 Webhook event ${eventType} emitted to ${subscriptions.length} subscribers`);
    } catch (error) {
      console.error(`Failed to emit webhook event ${eventType}:`, error);
    }
  }

  private static async getActiveSubscriptions(
    eventType: string,
    tenant?: { oemId?: string; dealershipId?: string; showroomId?: string }
  ): Promise<WebhookSubscription[]> {
    // This would query the database for active webhook subscriptions
    // that match the event type and tenant scope
    // For now, return empty array
    return [];
  }

  // Webhook endpoint handler for incoming webhooks
  static createWebhookHandler() {
    return async (req: any, res: any) => {
      try {
        const signature = req.headers[this.SIGNATURE_HEADER.toLowerCase()];
        const timestamp = req.headers[this.TIMESTAMP_HEADER.toLowerCase()];
        const eventType = req.headers[this.EVENT_TYPE_HEADER.toLowerCase()];
        
        if (!signature || !timestamp || !eventType) {
          return res.status(400).json({
            error: 'Missing required webhook headers'
          });
        }

        const payload = req.rawBody || JSON.stringify(req.body);
        const secret = process.env.WEBHOOK_SECRET || 'default-secret';

        // Verify the webhook signature
        if (!this.verifySignature(payload, signature, secret, timestamp)) {
          return res.status(401).json({
            error: 'Invalid webhook signature'
          });
        }

        // Process the webhook event
        await this.processIncomingWebhook(eventType, req.body);

        res.status(200).json({ received: true });
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
          error: 'Webhook processing failed'
        });
      }
    };
  }

  private static async processIncomingWebhook(eventType: string, data: any): Promise<void> {
    console.log(`🔔 Processing incoming webhook: ${eventType}`, data);
    
    // Implement webhook processing logic based on event type
    switch (eventType) {
      case 'external.status_update':
        // Handle external status updates
        break;
      case 'payment.confirmation':
        // Handle payment confirmations
        break;
      case 'whatsapp.message':
        // Handle WhatsApp messages/media uploads
        break;
      default:
        console.warn(`Unknown incoming webhook event type: ${eventType}`);
    }
  }

  // Test webhook delivery
  static async testWebhook(url: string, secret: string): Promise<boolean> {
    const testEvent = this.createWebhookEvent('test.ping', {
      message: 'This is a test webhook from SetuPPF',
      timestamp: new Date().toISOString()
    });

    const subscription: WebhookSubscription = {
      id: 'test',
      tenantScope: 'test',
      event: 'test.ping',
      targetUrl: url,
      secret,
      isActive: true
    };

    return this.deliverWebhook(subscription, testEvent, 1);
  }
}

// Export webhook utilities
export const webhookUtils = {
  generateSignature: WebhookService.generateSignature,
  verifySignature: WebhookService.verifySignature,
  createEvent: WebhookService.createWebhookEvent,
  emitEvent: WebhookService.emitEvent,
  testWebhook: WebhookService.testWebhook,
  Events: WebhookService.Events
};
