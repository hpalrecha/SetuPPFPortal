import { notificationService } from '../services/notificationService';
import { storage } from '../storage';

interface Job {
  id: string;
  type: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date;
}

interface JobProcessor {
  (data: any): Promise<void>;
}

export class QueueWorker {
  private processors: Map<string, JobProcessor> = new Map();
  private running = false;
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    this.registerProcessors();
  }

  private registerProcessors() {
    // Notification processing
    this.processors.set('notification.email', this.processEmailNotification.bind(this));
    this.processors.set('notification.sms', this.processSMSNotification.bind(this));
    this.processors.set('notification.push', this.processPushNotification.bind(this));

    // SLA monitoring
    this.processors.set('sla.check', this.processSLACheck.bind(this));
    this.processors.set('sla.alert', this.processSLAAlert.bind(this));

    // Payment processing
    this.processors.set('payment.payout', this.processPayoutJob.bind(this));
    this.processors.set('payment.commission', this.processCommissionJob.bind(this));

    // Data cleanup
    this.processors.set('cleanup.audit_logs', this.processAuditLogCleanup.bind(this));
    this.processors.set('cleanup.notifications', this.processNotificationCleanup.bind(this));

    // Reporting
    this.processors.set('report.daily', this.processDailyReport.bind(this));
    this.processors.set('report.weekly', this.processWeeklyReport.bind(this));
    this.processors.set('report.monthly', this.processMonthlyReport.bind(this));

    // Webhook delivery
    this.processors.set('webhook.deliver', this.processWebhookDelivery.bind(this));
    
    // Auto-assignment
    this.processors.set('assignment.auto', this.processAutoAssignment.bind(this));
  }

  async start() {
    if (this.running) {
      console.log('Queue worker is already running');
      return;
    }

    this.running = true;
    console.log('🚀 Queue worker started');

    // Process jobs every 5 seconds
    this.interval = setInterval(async () => {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('Error processing jobs:', error);
      }
    }, 5000);

    // Set up SLA monitoring
    this.setupSLAMonitoring();
  }

  async stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('⏹️ Queue worker stopped');
  }

  private async processJobs() {
    const jobs = await this.getNextJobs();
    
    for (const job of jobs) {
      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        await this.handleJobFailure(job, error);
      }
    }
  }

  private async processJob(job: Job) {
    const processor = this.processors.get(job.type);
    
    if (!processor) {
      throw new Error(`No processor found for job type: ${job.type}`);
    }

    console.log(`Processing job ${job.id} of type ${job.type}`);
    await processor(job.data);
    await this.markJobCompleted(job);
  }

  private async getNextJobs(): Promise<Job[]> {
    // In a real implementation, this would fetch from Redis/database queue
    // For now, we'll return an empty array
    return [];
  }

  private async markJobCompleted(job: Job) {
    // Mark job as completed in the queue storage
    console.log(`✅ Job ${job.id} completed successfully`);
  }

  private async handleJobFailure(job: Job, error: any) {
    job.attempts++;
    
    if (job.attempts >= job.maxAttempts) {
      console.error(`❌ Job ${job.id} failed permanently after ${job.attempts} attempts:`, error);
      await this.markJobFailed(job);
    } else {
      console.warn(`⚠️ Job ${job.id} failed, attempt ${job.attempts}/${job.maxAttempts}. Retrying...`);
      await this.scheduleRetry(job);
    }
  }

  private async markJobFailed(job: Job) {
    // Mark job as permanently failed
    console.log(`💀 Job ${job.id} marked as failed`);
  }

  private async scheduleRetry(job: Job) {
    // Schedule job for retry with exponential backoff
    const delay = Math.pow(2, job.attempts) * 1000; // Exponential backoff
    job.scheduledFor = new Date(Date.now() + delay);
    console.log(`🔄 Job ${job.id} scheduled for retry in ${delay}ms`);
  }

  // Job Processors
  private async processEmailNotification(data: any) {
    const { userId, subject, message, template, variables } = data;
    
    try {
      // Integration with email service (SendGrid, AWS SES, etc.)
      console.log(`📧 Sending email notification to user ${userId}: ${subject}`);
      
      // TODO: Implement actual email sending
      // await emailService.send({
      //   to: userEmail,
      //   subject,
      //   template,
      //   variables
      // });
      
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  private async processSMSNotification(data: any) {
    const { userId, message, phoneNumber } = data;
    
    try {
      console.log(`📱 Sending SMS notification to ${phoneNumber}: ${message}`);
      
      // TODO: Implement actual SMS sending via Twilio, AWS SNS, etc.
      // await smsService.send({
      //   to: phoneNumber,
      //   message
      // });
      
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
      throw error;
    }
  }

  private async processPushNotification(data: any) {
    const { userId, title, message, data: pushData } = data;
    
    try {
      console.log(`🔔 Sending push notification to user ${userId}: ${title}`);
      
      // TODO: Implement actual push notification via Firebase, OneSignal, etc.
      // await pushService.send({
      //   userId,
      //   title,
      //   message,
      //   data: pushData
      // });
      
    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }

  private async processSLACheck(data: any) {
    const { entityType, entityId } = data;
    
    try {
      console.log(`⏰ Checking SLA for ${entityType} ${entityId}`);
      
      switch (entityType) {
        case 'job_card':
          await this.checkJobCardSLA(entityId);
          break;
        case 'work_order':
          await this.checkWorkOrderSLA(entityId);
          break;
        default:
          console.warn(`Unknown entity type for SLA check: ${entityType}`);
      }
      
    } catch (error) {
      console.error('Failed to check SLA:', error);
      throw error;
    }
  }

  private async checkJobCardSLA(jobCardId: string) {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) return;

    const now = new Date();
    const slaHours = {
      acknowledgment: 2,
      completion: 72,
      approval: 24
    };

    // Check acknowledgment SLA
    if (jobCard.status === 'AWAITING_ACK') {
      const hoursOverdue = this.getHoursOverdue(jobCard.createdAt, now, slaHours.acknowledgment);
      if (hoursOverdue > 0) {
        await this.scheduleJob('sla.alert', {
          type: 'ACK_OVERDUE',
          entityId: jobCardId,
          overdueDuration: `${hoursOverdue.toFixed(1)} hours`
        });
      }
    }

    // Check completion SLA
    if (['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'].includes(jobCard.status)) {
      const startTime = jobCard.acknowledgedAt || jobCard.createdAt;
      const hoursOverdue = this.getHoursOverdue(startTime, now, slaHours.completion);
      if (hoursOverdue > 0) {
        await this.scheduleJob('sla.alert', {
          type: 'COMPLETION_OVERDUE',
          entityId: jobCardId,
          overdueDuration: `${hoursOverdue.toFixed(1)} hours`
        });
      }
    }

    // Check approval SLA
    if (jobCard.status === 'PENDING_APPROVAL') {
      const hoursOverdue = this.getHoursOverdue(
        jobCard.approvalRequestedAt || jobCard.completedAt || jobCard.createdAt, 
        now, 
        slaHours.approval
      );
      if (hoursOverdue > 0) {
        await this.scheduleJob('sla.alert', {
          type: 'APPROVAL_OVERDUE',
          entityId: jobCardId,
          overdueDuration: `${hoursOverdue.toFixed(1)} hours`
        });
      }
    }
  }

  private async checkWorkOrderSLA(workOrderId: string) {
    // Implementation for work order SLA checks
    console.log(`Checking work order SLA for ${workOrderId}`);
  }

  private getHoursOverdue(startTime: string | Date, currentTime: Date, slaHours: number): number {
    const start = new Date(startTime);
    const elapsedMs = currentTime.getTime() - start.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    return Math.max(0, elapsedHours - slaHours);
  }

  private async processSLAAlert(data: any) {
    const { type, entityId, overdueDuration } = data;
    
    try {
      await notificationService.sendSLAAlert(type, entityId, overdueDuration);
    } catch (error) {
      console.error('Failed to send SLA alert:', error);
      throw error;
    }
  }

  private async processPayoutJob(data: any) {
    const { jobCardId, partnerId, amount } = data;
    
    try {
      console.log(`💰 Processing payout for partner ${partnerId}: ₹${amount}`);
      
      // TODO: Integrate with payment gateway
      // await paymentService.processPayout({
      //   partnerId,
      //   amount,
      //   reference: jobCardId
      // });
      
      await notificationService.sendPayoutProcessed(jobCardId, partnerId, amount);
      
    } catch (error) {
      console.error('Failed to process payout:', error);
      throw error;
    }
  }

  private async processCommissionJob(data: any) {
    const { commissionId, salesPersonId, amount } = data;
    
    try {
      console.log(`💼 Processing commission for sales person ${salesPersonId}: ₹${amount}`);
      
      // TODO: Update commission status and notify
      await notificationService.sendCommissionEarned(commissionId, salesPersonId, amount);
      
    } catch (error) {
      console.error('Failed to process commission:', error);
      throw error;
    }
  }

  private async processAuditLogCleanup(data: any) {
    const { retentionDays = 90 } = data;
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      console.log(`🧹 Cleaning up audit logs older than ${retentionDays} days`);
      
      // TODO: Implement audit log cleanup
      // await storage.deleteOldAuditLogs(cutoffDate);
      
    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
      throw error;
    }
  }

  private async processNotificationCleanup(data: any) {
    const { retentionDays = 30 } = data;
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      console.log(`🧹 Cleaning up notifications older than ${retentionDays} days`);
      
      // TODO: Implement notification cleanup
      // await storage.deleteOldNotifications(cutoffDate);
      
    } catch (error) {
      console.error('Failed to cleanup notifications:', error);
      throw error;
    }
  }

  private async processDailyReport(data: any) {
    try {
      console.log('📊 Generating daily report');
      
      // TODO: Generate and send daily reports
      // const report = await reportService.generateDailyReport();
      // await emailService.sendReport(report);
      
    } catch (error) {
      console.error('Failed to generate daily report:', error);
      throw error;
    }
  }

  private async processWeeklyReport(data: any) {
    try {
      console.log('📈 Generating weekly report');
      
      // TODO: Generate and send weekly reports
      
    } catch (error) {
      console.error('Failed to generate weekly report:', error);
      throw error;
    }
  }

  private async processMonthlyReport(data: any) {
    try {
      console.log('📋 Generating monthly report');
      
      // TODO: Generate and send monthly reports
      
    } catch (error) {
      console.error('Failed to generate monthly report:', error);
      throw error;
    }
  }

  private async processWebhookDelivery(data: any) {
    const { url, payload, signature, attempt = 1 } = data;
    
    try {
      console.log(`🔗 Delivering webhook to ${url} (attempt ${attempt})`);
      
      // TODO: Implement webhook delivery with retries
      // await webhookService.deliver({
      //   url,
      //   payload,
      //   signature
      // });
      
    } catch (error) {
      console.error('Failed to deliver webhook:', error);
      throw error;
    }
  }

  private async processAutoAssignment(data: any) {
    const { workOrderId } = data;
    
    try {
      console.log(`🎯 Processing auto-assignment for work order ${workOrderId}`);
      
      // TODO: Implement auto-assignment logic
      // await workOrderService.autoAssignPartner(workOrderId);
      
    } catch (error) {
      console.error('Failed to process auto-assignment:', error);
      throw error;
    }
  }

  // Public methods for scheduling jobs
  async scheduleJob(type: string, data: any, delay?: number): Promise<void> {
    const job: Job = {
      id: this.generateJobId(),
      type,
      data,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      scheduledFor: delay ? new Date(Date.now() + delay) : undefined
    };

    // TODO: Add job to queue storage (Redis, database, etc.)
    console.log(`📋 Scheduled job ${job.id} of type ${type}`);
  }

  async scheduleRecurringJob(type: string, data: any, cronExpression: string): Promise<void> {
    // TODO: Implement recurring job scheduling
    console.log(`🔄 Scheduled recurring job of type ${type} with cron: ${cronExpression}`);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupSLAMonitoring() {
    // Schedule SLA checks every 30 minutes
    setInterval(async () => {
      try {
        await this.scheduleJob('sla.check', { entityType: 'job_card' });
        await this.scheduleJob('sla.check', { entityType: 'work_order' });
      } catch (error) {
        console.error('Error scheduling SLA checks:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Schedule daily cleanup at 2 AM
    this.scheduleRecurringJob('cleanup.audit_logs', {}, '0 2 * * *');
    this.scheduleRecurringJob('cleanup.notifications', {}, '0 2 * * *');

    // Schedule reports
    this.scheduleRecurringJob('report.daily', {}, '0 8 * * *'); // 8 AM daily
    this.scheduleRecurringJob('report.weekly', {}, '0 9 * * 1'); // 9 AM Monday
    this.scheduleRecurringJob('report.monthly', {}, '0 10 1 * *'); // 10 AM 1st of month
  }
}

// Singleton instance
export const queueWorker = new QueueWorker();

// Start worker if this is the main module
if (require.main === module) {
  queueWorker.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await queueWorker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await queueWorker.stop();
    process.exit(0);
  });
}
