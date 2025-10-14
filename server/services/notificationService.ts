import { storage } from '../storage';
import type { WorkOrder, JobCard, User } from '@shared/schema';
import { whatsappService } from './whatsapp-service';
import { emailService } from './email-service';

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
    payload: NotificationPayload,
    productBrand?: string // Optional product brand for dynamic from email
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
      
      await this.processNotificationByChannel(channel, userId, payload, productBrand);
      
      console.log(`✓ Notification sent to user ${userId} via ${channel}:`, payload.title);
    } catch (error) {
      console.error(`✗ Failed to send ${channel} notification to user ${userId}:`, error);
      throw error;
    }
  }

  async sendBulkNotification(
    userIds: string[],
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP',
    payload: NotificationPayload,
    productBrand?: string // Optional product brand for dynamic from email
  ): Promise<void> {
    const promises = userIds.map(userId => 
      this.sendNotification(userId, channel, payload, productBrand)
    );
    
    await Promise.allSettled(promises);
  }

  private async processNotificationByChannel(
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP',
    userId: string,
    payload: NotificationPayload,
    productBrand?: string
  ): Promise<void> {
    switch (channel) {
      case 'EMAIL':
        await this.sendEmail(userId, payload, productBrand);
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

  private async sendEmail(userId: string, payload: NotificationPayload, productBrand?: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        console.warn(`⚠️ Cannot send email to user ${userId}: No email address found`);
        return;
      }

      // Get dynamic from email based on product brand (for transactional emails)
      const fromEmail = productBrand ? emailService.getFromEmailByBrand(productBrand) : undefined;

      // Send email using the email service
      const success = await emailService.sendEmail({
        to: user.email,
        subject: payload.title,
        html: this.formatEmailHTML(payload),
        text: payload.message,
        from: fromEmail // Pass dynamic from email
      });

      if (success) {
        console.log(`✅ Email notification sent to ${user.email} from ${fromEmail || 'default'}`);
      } else {
        console.error(`❌ Failed to send email notification to ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Error sending email to user ${userId}:`, error);
    }
  }

  private formatEmailHTML(payload: NotificationPayload): string {
    const bgColor = {
      'INFO': '#3b82f6',
      'SUCCESS': '#10b981',
      'WARNING': '#f59e0b',
      'ERROR': '#ef4444'
    }[payload.type] || '#3b82f6';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: ${bgColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${payload.title}</h1>
          </div>
          <div class="content">
            <p>${payload.message}</p>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;
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

      const formattedPhone = whatsappService.formatPhoneNumber(user.phone);
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
  async sendJobCardCreated(jobCard: JobCard): Promise<void> {
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder || !jobCard.assignedToUserId) return;

    const assignedUser = await storage.getUser(jobCard.assignedToUserId);
    if (!assignedUser) return;

    // Send WhatsApp notification to assigned detailer/installer
    if (assignedUser.phone) {
      try {
        // Get brand from service
        const service = await storage.getService(workOrder.serviceId);
        const brandId = service?.productBrand ? await this.getBrandIdByName(service.productBrand) : null;
        
        // Try template-based messaging first if brand is configured
        let templateSent = false;
        if (brandId) {
          const partner = await storage.getPartner(jobCard.partnerId);
          const showroom = await storage.getShowroom(workOrder.showroomId);
          
          templateSent = await whatsappService.sendTemplateMessage(
            whatsappService.formatPhoneNumber(assignedUser.phone),
            brandId,
            'job_card_created',
            {
              partnerName: assignedUser.name,
              vehicleDetails: `${workOrder.vehicleModel} - ${workOrder.customerName}`,
              showroomName: showroom?.name || 'Unknown',
              serviceName: workOrder.serviceName
            },
            jobCard.id
          );
        }
        
        // Fallback to direct WhatsApp method if template failed
        if (!templateSent) {
          const partner = await storage.getPartner(jobCard.partnerId);
          const showroom = await storage.getShowroom(workOrder.showroomId);
          
          await whatsappService.sendJobCardCreated(
            whatsappService.formatPhoneNumber(assignedUser.phone),
            assignedUser.name,
            `${workOrder.vehicleModel} - ${workOrder.customerName}`,
            showroom?.name || 'Unknown',
            workOrder.serviceName,
            jobCard.id
          );
        }
        
        console.log(`📱 WhatsApp notification sent to detailer ${assignedUser.name} for job card ${jobCard.id.slice(0, 8)}`);
      } catch (error) {
        console.error(`❌ Failed to send WhatsApp notification for job card creation:`, error);
      }
    }

    // Also send push notification as backup
    await this.sendNotification(assignedUser.id, 'PUSH', {
      title: 'New Job Assignment',
      message: `Job card ${jobCard.id.slice(0, 8)} assigned for ${workOrder.vehicleModel} - ${workOrder.serviceName}. Please acknowledge within 2 hours.`,
      type: 'WARNING',
      data: { 
        jobCardId: jobCard.id, 
        workOrderId: workOrder.id,
        type: 'job_card_created',
        priority: 'high'
      }
    });
  }

  async sendJobCardCompleted(jobCard: JobCard): Promise<void> {
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder) return;

    // Get showroom managers to notify
    const showroomManagers = await this.getUsersByRole(
      ['SHOWROOM_MANAGER'], 
      { showroomId: workOrder.showroomId }
    );

    const detailerName = jobCard.assignedToUserId 
      ? (await storage.getUser(jobCard.assignedToUserId))?.name || 'Unknown'
      : 'Unknown';

    // Get brand from service
    const service = await storage.getService(workOrder.serviceId);
    const brandId = service?.productBrand ? await this.getBrandIdByName(service.productBrand) : null;

    // Send WhatsApp notifications to showroom managers
    for (const manager of showroomManagers) {
      if (manager.phone) {
        try {
          // Try template-based messaging first if brand is configured
          let templateSent = false;
          if (brandId) {
            templateSent = await whatsappService.sendTemplateMessage(
              whatsappService.formatPhoneNumber(manager.phone),
              brandId,
              'job_card_completed',
              {
                partnerName: detailerName,
                vehicleDetails: `${workOrder.vehicleModel} - ${workOrder.customerName}`,
                serviceName: workOrder.serviceName
              },
              jobCard.id
            );
          }
          
          // Fallback to direct WhatsApp method if template failed
          if (!templateSent) {
            await whatsappService.sendJobCardCompleted(
              whatsappService.formatPhoneNumber(manager.phone),
              detailerName,
              `${workOrder.vehicleModel} - ${workOrder.customerName}`,
              workOrder.serviceName,
              jobCard.id
            );
          }
          
          console.log(`📱 WhatsApp completion notification sent to showroom manager ${manager.name}`);
        } catch (error) {
          console.error(`❌ Failed to send WhatsApp completion notification:`, error);
        }
      }
    }

    // Also send push notifications as backup
    await this.sendBulkNotification(
      showroomManagers.map(manager => manager.id),
      'PUSH',
      {
        title: 'Job Completed',
        message: `PPF installation completed for job ${jobCard.id.slice(0, 8)} by ${detailerName}.`,
        type: 'SUCCESS',
        data: { 
          jobCardId: jobCard.id, 
          workOrderId: workOrder.id,
          detailerName,
          type: 'job_card_completed'
        }
      }
    );
  }

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
  private async getBrandIdByName(brandName: string): Promise<string | null> {
    try {
      const brand = await storage.getBrandByName(brandName);
      return brand?.id || null;
    } catch (error) {
      console.error(`❌ Failed to get brand ID for ${brandName}:`, error);
      return null;
    }
  }

  private async getUsersByRole(
    roles: string[], 
    filters: {
      oemId?: string;
      dealershipId?: string;
      showroomId?: string;
    }
  ): Promise<User[]> {
    try {
      const allUsers = await storage.getUsers();
      
      return allUsers.filter(user => {
        // Check if user has one of the required roles
        if (!roles.includes(user.role)) {
          return false;
        }
        
        // Apply filters
        if (filters.oemId && user.oemId !== filters.oemId) {
          return false;
        }
        if (filters.dealershipId && user.dealershipId !== filters.dealershipId) {
          return false;
        }
        if (filters.showroomId && user.showroomId !== filters.showroomId) {
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error('Error fetching users by role:', error);
      return [];
    }
  }

  private async getPartnerMembers(partnerId: string): Promise<{ userId: string }[]> {
    try {
      const allUsers = await storage.getUsers();
      const partnerUsers = allUsers.filter(user => 
        user.partnerId === partnerId && 
        (user.role === 'PARTNER_ADMIN' || user.role === 'PARTNER_STAFF')
      );
      
      return partnerUsers.map(user => ({ userId: user.id }));
    } catch (error) {
      console.error('Error fetching partner members:', error);
      return [];
    }
  }

  async notifyStakeholders(eventType: string, workOrder: WorkOrder): Promise<void> {
    // Send email notifications to relevant stakeholders based on event type
    try {
      let stakeholders: User[] = [];
      let payload: NotificationPayload | null = null;

      switch (eventType) {
        case 'work_order_created':
          // Notify OEM Admin, Dealership Admin, and Showroom Manager
          stakeholders = await this.getUsersByRole(
            ['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER'],
            {
              oemId: workOrder.oemId,
              dealershipId: workOrder.dealershipId,
              showroomId: workOrder.showroomId
            }
          );
          payload = {
            title: 'New Work Order Created',
            message: `Work Order #${workOrder.woNumber || workOrder.id.slice(0, 8)} has been created for ${workOrder.vehicleModel}. Customer: ${workOrder.customerName}. Service: ${workOrder.serviceName}.`,
            type: 'INFO',
            data: { workOrderId: workOrder.id, type: 'work_order_created' }
          };
          break;

        case 'work_order_completed':
          // Notify all admins and managers
          stakeholders = await this.getUsersByRole(
            ['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER'],
            {
              oemId: workOrder.oemId,
              dealershipId: workOrder.dealershipId,
              showroomId: workOrder.showroomId
            }
          );
          payload = {
            title: 'Work Order Completed',
            message: `Work Order #${workOrder.woNumber || workOrder.id.slice(0, 8)} for ${workOrder.vehicleModel} has been completed.`,
            type: 'SUCCESS',
            data: { workOrderId: workOrder.id, type: 'work_order_completed' }
          };
          break;

        case 'work_order_assigned':
          // Notify showroom manager and sales person
          stakeholders = await this.getUsersByRole(
            ['SHOWROOM_MANAGER', 'SALES_PERSON'],
            {
              oemId: workOrder.oemId,
              showroomId: workOrder.showroomId
            }
          );
          // Add sales person if assigned
          if (workOrder.salesPersonId) {
            const salesPerson = await storage.getUser(workOrder.salesPersonId);
            if (salesPerson && !stakeholders.find(s => s.id === salesPerson.id)) {
              stakeholders.push(salesPerson);
            }
          }
          payload = {
            title: 'Work Order Assigned to Partner',
            message: `Work Order #${workOrder.woNumber || workOrder.id.slice(0, 8)} has been assigned to a partner for installation.`,
            type: 'INFO',
            data: { workOrderId: workOrder.id, type: 'work_order_assigned' }
          };
          break;
      }

      // Send email notifications to all stakeholders
      if (payload && stakeholders.length > 0) {
        // Extract product brand from service for dynamic from email
        let productBrand: string | undefined;
        try {
          const service = await storage.getService(workOrder.serviceId);
          productBrand = service?.productBrand || undefined;
        } catch (error) {
          console.error('Failed to fetch service for product brand:', error);
        }
        
        await this.sendBulkNotification(
          stakeholders.map(s => s.id),
          'EMAIL',
          payload,
          productBrand // Pass product brand for dynamic from email
        );
        console.log(`📧 Sent ${eventType} email notifications to ${stakeholders.length} stakeholders (from: ${productBrand || 'default'})`);
      }
    } catch (error) {
      console.error(`Failed to notify stakeholders for ${eventType}:`, error);
    }

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
