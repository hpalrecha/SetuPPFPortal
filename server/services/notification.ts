export interface NotificationPayload {
  type: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  recipient: string;
  subject?: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  variables: string[];
}

export class NotificationService {
  private templates: Map<string, NotificationTemplate> = new Map([
    ['job_card_assigned', {
      id: 'job_card_assigned',
      name: 'Job Card Assigned',
      subject: 'New Job Card Assigned - {{jobCardId}}',
      body: 'A new job card {{jobCardId}} has been assigned to you for {{vehicleModel}} - {{serviceName}}. Please acknowledge within {{slaHours}} hours.',
      variables: ['jobCardId', 'vehicleModel', 'serviceName', 'slaHours']
    }],
    ['job_card_reminder', {
      id: 'job_card_reminder',
      name: 'Job Card Acknowledgment Reminder',
      subject: 'Reminder: Job Card {{jobCardId}} Pending Acknowledgment',
      body: 'This is a reminder that job card {{jobCardId}} is still pending acknowledgment. Please respond immediately.',
      variables: ['jobCardId']
    }],
    ['work_order_approved', {
      id: 'work_order_approved',
      name: 'Work Order Approved',
      subject: 'Work Order {{workOrderId}} Approved',
      body: 'Your work order {{workOrderId}} has been approved. Total amount: {{totalAmount}}. Commission: {{commissionAmount}}.',
      variables: ['workOrderId', 'totalAmount', 'commissionAmount']
    }],
    ['sla_breach_alert', {
      id: 'sla_breach_alert',
      name: 'SLA Breach Alert',
      subject: 'SLA Breach Alert - {{entity}} {{entityId}}',
      body: 'SLA breach detected for {{entity}} {{entityId}}. Current status: {{status}}. Time elapsed: {{timeElapsed}}.',
      variables: ['entity', 'entityId', 'status', 'timeElapsed']
    }]
  ]);

  async sendNotification(payload: NotificationPayload): Promise<void> {
    console.log(`Sending ${payload.type} notification to ${payload.recipient}:`, {
      subject: payload.subject,
      message: payload.message,
      data: payload.data
    });

    // In production, implement actual notification providers:
    switch (payload.type) {
      case 'EMAIL':
        await this.sendEmail(payload);
        break;
      case 'SMS':
        await this.sendSMS(payload);
        break;
      case 'PUSH':
        await this.sendPush(payload);
        break;
      case 'WHATSAPP':
        await this.sendWhatsApp(payload);
        break;
    }
  }

  async sendFromTemplate(
    templateId: string, 
    recipient: string, 
    variables: Record<string, string>,
    type: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP' = 'EMAIL'
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let subject = template.subject;
    let message = template.body;

    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      if (subject) {
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
      }
      message = message.replace(new RegExp(placeholder, 'g'), value);
    }

    await this.sendNotification({
      type,
      recipient,
      subject,
      message,
      data: variables
    });
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    // Implement SMTP email sending
    // Use environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    console.log('EMAIL:', payload);
  }

  private async sendSMS(payload: NotificationPayload): Promise<void> {
    // Implement SMS gateway integration
    console.log('SMS:', payload);
  }

  private async sendPush(payload: NotificationPayload): Promise<void> {
    // Implement push notification service
    console.log('PUSH:', payload);
  }

  private async sendWhatsApp(payload: NotificationPayload): Promise<void> {
    // Implement WhatsApp Business API
    // Use environment variables: WHATSAPP_API_URL, WHATSAPP_API_TOKEN
    console.log('WHATSAPP:', payload);
  }

  /**
   * Send job assignment notification
   */
  async notifyJobAssignment(jobCardId: string, partnerEmail: string, details: {
    vehicleModel: string;
    serviceName: string;
    slaHours: number;
  }): Promise<void> {
    await this.sendFromTemplate('job_card_assigned', partnerEmail, {
      jobCardId,
      vehicleModel: details.vehicleModel,
      serviceName: details.serviceName,
      slaHours: details.slaHours.toString()
    });
  }

  /**
   * Send SLA breach alert
   */
  async notifySLABreach(
    recipients: string[], 
    entity: string, 
    entityId: string, 
    status: string, 
    timeElapsed: string
  ): Promise<void> {
    const promises = recipients.map(recipient =>
      this.sendFromTemplate('sla_breach_alert', recipient, {
        entity,
        entityId,
        status,
        timeElapsed
      })
    );

    await Promise.all(promises);
  }

  /**
   * Send work order approval notification
   */
  async notifyWorkOrderApproval(
    salesPersonEmail: string,
    workOrderId: string,
    totalAmount: string,
    commissionAmount: string
  ): Promise<void> {
    await this.sendFromTemplate('work_order_approved', salesPersonEmail, {
      workOrderId,
      totalAmount,
      commissionAmount
    });
  }
}

export const notificationService = new NotificationService();
