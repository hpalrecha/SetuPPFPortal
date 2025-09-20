import { storage } from '../storage';
import type { WorkOrder, JobCard, User } from '@shared/schema';
import { whatsappService } from './whatsapp-service';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  data?: any;
}

interface NotificationChannel {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
}

export class NotificationService {
  async sendNotification(
    userId: string,
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP',
    payload: NotificationPayload
  ): Promise<void> {
    try {
      await storage.createNotification({
        actorId: userId,
        channel,
        subject: payload.title,
        payloadJson: payload,
        status: 'PENDING'
      });

      // In production, integrate with actual notification services:
      // - Email: SendGrid, AWS SES, Mailgun
      // - SMS: Twilio, AWS SNS
      // - Push: Firebase Cloud Messaging, OneSignal
      
      await this.processNotificationByChannel(channel, userId, payload);
      
      console.log(`✓ Notification sent to user ${userId} via ${channel}:`, payload.title);
    } catch (error) {
      console.error(`✗ Failed to send ${channel} notification to user ${userId}:`, error);
      throw error;
    }
  }

  async sendBulkNotification(
    userIds: string[],
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP',
    payload: NotificationPayload
  ): Promise<void> {
    const promises = userIds.map(userId => 
      this.sendNotification(userId, channel, payload)
    );
    
    await Promise.allSettled(promises);
  }

  private async processNotificationByChannel(
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP',
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    switch (channel) {
      case 'EMAIL':
        await this.sendEmail(userId, payload);
        break;
      case 'SMS':
        await this.sendSMS(userId, payload);
        break;
      case 'PUSH':
        await this.sendPushNotification(userId, payload);
        break;
      case 'WHATSAPP':
        await this.sendWhatsApp(userId, payload);
        break;
    }
  }

  private async sendEmail(userId: string, payload: NotificationPayload): Promise<void> {
    // Email service integration would go here
    // Example with SendGrid, AWS SES, etc.
    if (process.env.SMTP_HOST) {
      // TODO: Implement actual email sending
      console.log(`📧 Email notification sent to user ${userId}`);
    }
  }

  private async sendSMS(userId: string, payload: NotificationPayload): Promise<void> {
    // SMS service integration would go here
    // Example with Twilio, AWS SNS, etc.
    if (process.env.TWILIO_ACCOUNT_SID) {
      // TODO: Implement actual SMS sending
      console.log(`📱 SMS notification sent to user ${userId}`);
    }
  }

  private async sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
    // Push notification service integration would go here
    // Example with Firebase Cloud Messaging
    if (process.env.FIREBASE_SERVER_KEY) {
      // TODO: Implement actual push notification sending
      console.log(`🔔 Push notification sent to user ${userId}`);
    }
  }

  private async sendWhatsApp(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.phone) {
        console.warn(`⚠️ Cannot send WhatsApp to user ${userId}: No phone number found`);
        return;
      }

      const formattedPhone = whatsappService.constructor.formatPhoneNumber(user.phone);
      const message = `*${payload.title}*\n\n${payload.message}`;
      
      await whatsappService.sendCustomMessage(formattedPhone, message);
      console.log(`📱 WhatsApp notification sent to user ${userId} at ${formattedPhone}`);
    } catch (error) {
      console.error(`❌ Failed to send WhatsApp notification to user ${userId}:`, error);
      throw error;
    }
  }

  // Work Order Notifications
  async sendWorkOrderCreated(workOrder: WorkOrder): Promise<void> {
    const user = await storage.getUser(workOrder.createdByUserId);
    if (!user) return;

    await this.sendNotification(user.id, 'PUSH', {
      title: 'Work Order Created',
      message: `Work order ${workOrder.id.slice(0, 8)} has been created successfully.`,
      type: 'INFO',
      data: { workOrderId: workOrder.id, type: 'work_order_created' }
    });

    // Notify relevant stakeholders
    await this.notifyStakeholders('work_order_created', workOrder);
  }

  async sendWorkOrderSubmitted(workOrder: WorkOrder): Promise<void> {
    const admins = await this.getUsersByRole(
      ['OEM_ADMIN', 'DEALERSHIP_ADMIN'], 
      {
        oemId: workOrder.oemId,
        dealershipId: workOrder.dealershipId
      }
    );

    const payload: NotificationPayload = {
      title: 'Work Order Submitted',
      message: `Work order ${workOrder.id.slice(0, 8)} has been submitted for assignment.`,
      type: 'INFO',
      data: { workOrderId: workOrder.id, type: 'work_order_submitted' }
    };

    await this.sendBulkNotification(
      admins.map(admin => admin.id), 
      'EMAIL', 
      payload
    );
  }

  async sendWorkOrderAssigned(workOrder: WorkOrder, partnerId: string): Promise<void> {
    const partnerMembers = await this.getPartnerMembers(partnerId);
    
    const payload: NotificationPayload = {
      title: 'New Job Assignment',
      message: `A new PPF installation job has been assigned to your team. Please acknowledge within 2 hours.`,
      type: 'WARNING',
      data: { 
        workOrderId: workOrder.id, 
        jobCardId: workOrder.assignedJobCardId,
        type: 'job_assigned',
        priority: 'high'
      }
    };

    await this.sendBulkNotification(
      partnerMembers.map(member => member.userId), 
      'PUSH', 
      payload
    );

    // Also send SMS for urgent notifications
    await this.sendBulkNotification(
      partnerMembers.map(member => member.userId), 
      'SMS', 
      {
        ...payload,
        message: `URGENT: New PPF job assigned. Please acknowledge in SetuPPF app within 2 hours.`
      }
    );
  }

  // Job Card Notifications
  async sendJobCardAcknowledged(jobCard: JobCard): Promise<void> {
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder) return;

    const showroomManagers = await this.getUsersByRole(
      ['SHOWROOM_MANAGER'], 
      { showroomId: workOrder.showroomId }
    );

    await this.sendBulkNotification(
      showroomManagers.map(manager => manager.id),
      'PUSH',
      {
        title: 'Job Acknowledged',
        message: `Partner has acknowledged job ${jobCard.id.slice(0, 8)} and will schedule it soon.`,
        type: 'SUCCESS',
        data: { jobCardId: jobCard.id, workOrderId: workOrder.id, type: 'job_acknowledged' }
      }
    );
  }

  async sendJobCardScheduled(jobCard: JobCard): Promise<void> {
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder) return;

    const showroomManagers = await this.getUsersByRole(
      ['SHOWROOM_MANAGER'], 
      { showroomId: workOrder.showroomId }
    );

    const scheduledDate = jobCard.scheduledAt 
      ? new Date(jobCard.scheduledAt).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Unknown';

    await this.sendBulkNotification(
      showroomManagers.map(manager => manager.id),
      'EMAIL',
      {
        title: 'Job Scheduled',
        message: `PPF installation for job ${jobCard.id.slice(0, 8)} has been scheduled for ${scheduledDate}.`,
        type: 'INFO',
        data: { 
          jobCardId: jobCard.id, 
          scheduledAt: jobCard.scheduledAt,
          type: 'job_scheduled'
        }
      }
    );
  }

  async sendJobCardStarted(jobCard: JobCard): Promise<void> {
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder) return;

    const showroomManagers = await this.getUsersByRole(
      ['SHOWROOM_MANAGER'], 
      { showroomId: workOrder.showroomId }
    );

    await this.sendBulkNotification(
      showroomManagers.map(manager => manager.id),
      'PUSH',
      {
        title: 'Installation Started',
        message: `PPF installation work has started for job ${jobCard.id.slice(0, 8)}.`,
        type: 'INFO',
        data: { jobCardId: jobCard.id, type: 'job_started' }
      }
    );
  }

  async sendJobCardPendingApproval(jobCard: JobCard): Promise<void> {
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder) return;

    const showroomManagers = await this.getUsersByRole(
      ['SHOWROOM_MANAGER'], 
      { showroomId: workOrder.showroomId }
    );

    await this.sendBulkNotification(
      showroomManagers.map(manager => manager.id),
      'EMAIL',
      {
        title: 'Job Completed - Approval Required',
        message: `Job ${jobCard.id.slice(0, 8)} has been completed and requires your approval. Please review the uploaded proofs.`,
        type: 'WARNING',
        data: { 
          jobCardId: jobCard.id, 
          type: 'approval_required',
          priority: 'high'
        }
      }
    );

    // Also send push notification for immediate attention
    await this.sendBulkNotification(
      showroomManagers.map(manager => manager.id),
      'PUSH',
      {
        title: '🔔 Approval Required',
        message: `Job ${jobCard.id.slice(0, 8)} completed - Review needed`,
        type: 'WARNING',
        data: { jobCardId: jobCard.id, type: 'approval_required' }
      }
    );
  }

  async sendJobCardApproved(jobCard: JobCard): Promise<void> {
    const partnerMembers = await this.getPartnerMembers(jobCard.partnerId);
    
    await this.sendBulkNotification(
      partnerMembers.map(member => member.userId),
      'PUSH',
      {
        title: 'Job Approved ✅',
        message: `Your completed job ${jobCard.id.slice(0, 8)} has been approved. Payment will be processed soon.`,
        type: 'SUCCESS',
        data: { jobCardId: jobCard.id, type: 'job_approved' }
      }
    );
  }

  async sendJobCardRejected(jobCard: JobCard): Promise<void> {
    const partnerMembers = await this.getPartnerMembers(jobCard.partnerId);
    
    await this.sendBulkNotification(
      partnerMembers.map(member => member.userId),
      'EMAIL',
      {
        title: 'Job Rejected',
        message: `Your submitted job ${jobCard.id.slice(0, 8)} has been rejected. Please check the feedback and contact the showroom.`,
        type: 'ERROR',
        data: { 
          jobCardId: jobCard.id, 
          reason: jobCard.rejectionReason,
          type: 'job_rejected'
        }
      }
    );
  }

  async sendJobCardReworkRequested(jobCard: JobCard): Promise<void> {
    const partnerMembers = await this.getPartnerMembers(jobCard.partnerId);
    
    await this.sendBulkNotification(
      partnerMembers.map(member => member.userId),
      'EMAIL',
      {
        title: 'Rework Required',
        message: `Rework has been requested for job ${jobCard.id.slice(0, 8)}. Please review the feedback and proceed accordingly.`,
        type: 'WARNING',
        data: { 
          jobCardId: jobCard.id, 
          reason: jobCard.reworkReason,
          type: 'rework_requested'
        }
      }
    );
  }

  // SLA Alerts
  async sendSLAAlert(
    type: 'ACK_OVERDUE' | 'SCHEDULE_OVERDUE' | 'COMPLETION_OVERDUE' | 'APPROVAL_OVERDUE', 
    entityId: string, 
    overdueDuration: string
  ): Promise<void> {
    let targetUsers: User[] = [];
    let alertData: NotificationPayload;

    switch (type) {
      case 'ACK_OVERDUE':
        const jobCard = await storage.getJobCard(entityId);
        if (jobCard) {
          const partnerMembers = await this.getPartnerMembers(jobCard.partnerId);
          targetUsers = partnerMembers.map(member => ({ id: member.userId } as User));
          
          alertData = {
            title: '🚨 SLA Alert: Acknowledgment Overdue',
            message: `Job acknowledgment is overdue by ${overdueDuration}. Please acknowledge immediately to avoid penalties.`,
            type: 'ERROR',
            data: { 
              entityId, 
              type: 'ack_overdue', 
              overdueDuration,
              priority: 'critical'
            }
          };
        }
        break;

      case 'COMPLETION_OVERDUE':
        const overdueJobCard = await storage.getJobCard(entityId);
        if (overdueJobCard) {
          const partnerMembers = await this.getPartnerMembers(overdueJobCard.partnerId);
          targetUsers = partnerMembers.map(member => ({ id: member.userId } as User));
          
          alertData = {
            title: '⏰ SLA Alert: Completion Overdue',
            message: `Job completion is overdue by ${overdueDuration}. Please complete the work immediately.`,
            type: 'ERROR',
            data: { 
              entityId, 
              type: 'completion_overdue', 
              overdueDuration,
              priority: 'critical'
            }
          };
        }
        break;

      case 'APPROVAL_OVERDUE':
        const pendingJobCard = await storage.getJobCard(entityId);
        if (pendingJobCard) {
          const workOrder = await storage.getWorkOrder(pendingJobCard.workOrderId);
          if (workOrder) {
            const showroomManagers = await this.getUsersByRole(
              ['SHOWROOM_MANAGER'], 
              { showroomId: workOrder.showroomId }
            );
            targetUsers = showroomManagers;
            
            alertData = {
              title: '⏳ SLA Alert: Approval Overdue',
              message: `Job approval is overdue by ${overdueDuration}. Please review and approve immediately.`,
              type: 'ERROR',
              data: { 
                entityId, 
                type: 'approval_overdue', 
                overdueDuration,
                priority: 'critical'
              }
            };
          }
        }
        break;

      default:
        console.warn(`Unknown SLA alert type: ${type}`);
        return;
    }

    if (targetUsers.length > 0 && alertData!) {
      // Send both SMS and Push for critical SLA alerts
      await this.sendBulkNotification(
        targetUsers.map(user => user.id),
        'SMS',
        alertData
      );
      
      await this.sendBulkNotification(
        targetUsers.map(user => user.id),
        'PUSH',
        alertData
      );
    }
  }

  // Payment & Commission Notifications
  async sendPayoutProcessed(payoutId: string, partnerId: string, amount: number): Promise<void> {
    const partnerMembers = await this.getPartnerMembers(partnerId);
    
    await this.sendBulkNotification(
      partnerMembers.map(member => member.userId),
      'EMAIL',
      {
        title: 'Payment Processed 💰',
        message: `Your payout of ₹${amount.toLocaleString('en-IN')} has been processed and will reflect in your account shortly.`,
        type: 'SUCCESS',
        data: { payoutId, amount, type: 'payout_processed' }
      }
    );
  }

  async sendCommissionEarned(commissionId: string, salesPersonId: string, amount: number): Promise<void> {
    const salesPerson = await storage.getSalesPerson(salesPersonId);
    if (!salesPerson) return;

    // Notification would go to the sales person's linked user account
    // For now, we'll log it
    console.log(`Commission notification: Sales person ${salesPersonId} earned ₹${amount}`);
  }

  // Helper methods
  private async getUsersByRole(
    roles: string[], 
    filters: {
      oemId?: string;
      dealershipId?: string;
      showroomId?: string;
    }
  ): Promise<User[]> {
    // This would be implemented in the storage layer
    // For now, return empty array
    return [];
  }

  private async getPartnerMembers(partnerId: string): Promise<{ userId: string }[]> {
    // This would be implemented in the storage layer
    // For now, return empty array
    return [];
  }

  private async notifyStakeholders(eventType: string, workOrder: WorkOrder): Promise<void> {
    // Send webhooks to external systems
    try {
      await this.sendWebhookNotification(eventType, {
        workOrderId: workOrder.id,
        status: workOrder.status,
        oemId: workOrder.oemId,
        dealershipId: workOrder.dealershipId,
        showroomId: workOrder.showroomId
      });
    } catch (error) {
      console.error(`Failed to send webhook for ${eventType}:`, error);
    }
  }

  private async sendWebhookNotification(event: string, data: any): Promise<void> {
    // Implementation would fetch webhook subscriptions and send HTTP requests
    // This is a placeholder for webhook functionality
    console.log(`Webhook notification sent for event: ${event}`, data);
  }

  // Queue management for batch processing
  async processNotificationQueue(): Promise<void> {
    // This would be called by a background job
    try {
      const pendingNotifications = await storage.getPendingNotifications();
      
      for (const notification of pendingNotifications) {
        try {
          await this.processQueuedNotification(notification);
          
          await storage.updateNotification(notification.id, {
            status: 'SENT',
            sentAt: new Date()
          });
        } catch (error) {
          console.error(`Failed to process notification ${notification.id}:`, error);
          
          await storage.updateNotification(notification.id, {
            status: 'FAILED'
          });
        }
      }
    } catch (error) {
      console.error('Failed to process notification queue:', error);
    }
  }

  private async processQueuedNotification(notification: any): Promise<void> {
    const payload = typeof notification.payloadJson === 'string' 
      ? JSON.parse(notification.payloadJson)
      : notification.payloadJson;

    await this.processNotificationByChannel(
      notification.channel as 'EMAIL' | 'SMS' | 'PUSH',
      notification.actorId,
      payload
    );
  }

  // Template-based notifications
  async sendTemplatedNotification(
    userId: string,
    templateId: string,
    variables: Record<string, any>,
    channels: NotificationChannel = { push: true }
  ): Promise<void> {
    // This would load notification templates and replace variables
    // Implementation would depend on your templating system
    console.log(`Templated notification sent to ${userId} using template ${templateId}`);
  }
}

export const notificationService = new NotificationService();
