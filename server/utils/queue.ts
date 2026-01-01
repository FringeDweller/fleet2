import { type Job, type Processor, Queue, Worker } from 'bullmq'
import type {
  DocumentExpiringEmailData,
  EmailTemplate,
  FuelAnomalyEmailData,
  GeofenceAlertEmailData,
  NotificationDigestEmailData,
  PasswordResetEmailData,
  WorkOrderApprovalEmailData,
  WorkOrderApprovedRejectedEmailData,
  WorkOrderAssignedEmailData,
} from './email-service'
import { redis } from './redis'

// Union of all email data types
type EmailDataType =
  | PasswordResetEmailData
  | WorkOrderAssignedEmailData
  | WorkOrderApprovalEmailData
  | WorkOrderApprovedRejectedEmailData
  | DocumentExpiringEmailData
  | FuelAnomalyEmailData
  | GeofenceAlertEmailData
  | NotificationDigestEmailData

// Queue configuration
const defaultQueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
}

// Job queues
export const queues = {
  email: new Queue('email', defaultQueueOptions),
  notifications: new Queue('notifications', defaultQueueOptions),
  reports: new Queue('reports', defaultQueueOptions),
  maintenance: new Queue('maintenance', defaultQueueOptions),
}

// Worker factory function
export function createWorker<T>(
  queueName: keyof typeof queues,
  processor: Processor<T>,
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: redis,
    concurrency: 5,
  })
}

// Job types
export interface EmailJobData {
  to: string | string[]
  subject: string
  template: EmailTemplate
  data: EmailDataType
}

export interface NotificationJobData {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
}

// Helper functions to add jobs
export const jobs = {
  async sendEmail(data: EmailJobData): Promise<Job<EmailJobData>> {
    return queues.email.add('send', data)
  },

  async sendNotification(data: NotificationJobData): Promise<Job<NotificationJobData>> {
    return queues.notifications.add('send', data)
  },

  async generateReport(reportType: string, params: Record<string, unknown>): Promise<Job> {
    return queues.reports.add('generate', { reportType, params })
  },

  async scheduleMaintenanceCheck(assetId: string): Promise<Job> {
    return queues.maintenance.add('check', { assetId })
  },
}
