import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { slaMonitor } from './sla-monitor';
import { notificationService } from '../services/notification';
import { webhookService } from '../services/webhook';

// Redis connection
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
});

// Define job types
export interface NotificationJob {
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  recipient: string;
  subject?: string;
  message: string;
  data?: Record<string, any>;
}

export interface WebhookJob {
  event: string;
  data: Record<string, any>;
  timestamp: string;
  tenantId?: string;
}

export interface SLACheckJob {
  timestamp: string;
}

// Create queues
export const notificationQueue = new Queue<NotificationJob>('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const webhookQueue = new Queue<WebhookJob>('webhooks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const slaQueue = new Queue<SLACheckJob>('sla-monitoring', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 10,
    removeOnFail: 10,
  },
});

// Workers
const notificationWorker = new Worker<NotificationJob>(
  'notifications',
  async (job: Job<NotificationJob>) => {
    const { type, recipient, subject, message, data } = job.data;
    
    console.log(`Processing notification job ${job.id} - ${type} to ${recipient}`);
    
    await notificationService.sendNotification({
      type: type.toUpperCase() as any,
      recipient,
      subject,
      message,
      data
    });
    
    console.log(`Notification job ${job.id} completed`);
  },
  { connection: redisConnection, concurrency: 10 }
);

const webhookWorker = new Worker<WebhookJob>(
  'webhooks',
  async (job: Job<WebhookJob>) => {
    const { event, data, timestamp, tenantId } = job.data;
    
    console.log(`Processing webhook job ${job.id} - ${event}`);
    
    await webhookService.emitEvent({
      event,
      data,
      timestamp,
      tenantId
    });
    
    console.log(`Webhook job ${job.id} completed`);
  },
  { connection: redisConnection, concurrency: 5 }
);

const slaWorker = new Worker<SLACheckJob>(
  'sla-monitoring',
  async (job: Job<SLACheckJob>) => {
    console.log(`Processing SLA check job ${job.id}`);
    
    await slaMonitor.checkSLABreaches();
    
    console.log(`SLA check job ${job.id} completed`);
  },
  { connection: redisConnection, concurrency: 1 }
);

// Error handling
notificationWorker.on('failed', (job, err) => {
  console.error(`Notification job ${job?.id} failed:`, err);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`Webhook job ${job?.id} failed:`, err);
});

slaWorker.on('failed', (job, err) => {
  console.error(`SLA job ${job?.id} failed:`, err);
});

// Success logging
notificationWorker.on('completed', (job) => {
  console.log(`Notification job ${job.id} completed successfully`);
});

webhookWorker.on('completed', (job) => {
  console.log(`Webhook job ${job.id} completed successfully`);
});

slaWorker.on('completed', (job) => {
  console.log(`SLA job ${job.id} completed successfully`);
});

// Schedule recurring SLA checks (every hour)
export async function scheduleRecurringSLAChecks() {
  await slaQueue.add(
    'sla-check',
    { timestamp: new Date().toISOString() },
    {
      repeat: { pattern: '0 * * * *' }, // Every hour
      jobId: 'recurring-sla-check'
    }
  );
  console.log('Scheduled recurring SLA checks');
}

// Queue management functions
export class QueueManager {
  static async addNotificationJob(data: NotificationJob, delay?: number) {
    return await notificationQueue.add('send-notification', data, {
      delay
    });
  }

  static async addWebhookJob(data: WebhookJob, delay?: number) {
    return await webhookQueue.add('send-webhook', data, {
      delay
    });
  }

  static async addSLACheckJob() {
    return await slaQueue.add('sla-check', {
      timestamp: new Date().toISOString()
    });
  }

  static async getQueueStats() {
    const [notificationStats, webhookStats, slaStats] = await Promise.all([
      notificationQueue.getJobs(['waiting', 'active', 'completed', 'failed']),
      webhookQueue.getJobs(['waiting', 'active', 'completed', 'failed']),
      slaQueue.getJobs(['waiting', 'active', 'completed', 'failed'])
    ]);

    return {
      notifications: {
        waiting: notificationStats.filter(job => job.opts.delay ? Date.now() < job.timestamp + job.opts.delay : job.finishedOn === undefined).length,
        active: notificationStats.filter(job => job.processedOn && !job.finishedOn).length,
        completed: notificationStats.filter(job => job.finishedOn && job.failedReason === undefined).length,
        failed: notificationStats.filter(job => job.failedReason).length
      },
      webhooks: {
        waiting: webhookStats.filter(job => job.opts.delay ? Date.now() < job.timestamp + job.opts.delay : job.finishedOn === undefined).length,
        active: webhookStats.filter(job => job.processedOn && !job.finishedOn).length,
        completed: webhookStats.filter(job => job.finishedOn && job.failedReason === undefined).length,
        failed: webhookStats.filter(job => job.failedReason).length
      },
      sla: {
        waiting: slaStats.filter(job => job.opts.delay ? Date.now() < job.timestamp + job.opts.delay : job.finishedOn === undefined).length,
        active: slaStats.filter(job => job.processedOn && !job.finishedOn).length,
        completed: slaStats.filter(job => job.finishedOn && job.failedReason === undefined).length,
        failed: slaStats.filter(job => job.failedReason).length
      }
    };
  }

  static async gracefulShutdown() {
    console.log('Shutting down workers gracefully...');
    
    await Promise.all([
      notificationWorker.close(),
      webhookWorker.close(),
      slaWorker.close()
    ]);
    
    await redisConnection.quit();
    console.log('All workers shut down successfully');
  }
}

// Initialize recurring jobs
scheduleRecurringSLAChecks().catch(console.error);

export { redisConnection };
