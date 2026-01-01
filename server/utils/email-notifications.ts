/**
 * Email Notification Dispatcher
 *
 * This module provides helpers to queue email notifications alongside in-app notifications.
 * It integrates with the email queue and will check user notification preferences
 * when that feature is implemented.
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from './db'
import type {
  DocumentExpiringEmailData,
  EmailTemplate,
  FuelAnomalyEmailData,
  GeofenceAlertEmailData,
  WorkOrderApprovalEmailData,
  WorkOrderApprovedRejectedEmailData,
  WorkOrderAssignedEmailData,
} from './email-service'
import { isEmailConfigured } from './email-service'
import { jobs } from './queue'

// Get user info for email
async function getUserEmailInfo(
  userId: string,
): Promise<{ email: string; firstName: string; lastName: string } | null> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      email: true,
      firstName: true,
      lastName: true,
    },
  })
  return user || null
}

// Get app URL for links
function getAppUrl(): string {
  const config = useRuntimeConfig()
  return config.public.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Generate unsubscribe URL for user
function getUnsubscribeUrl(userId: string): string {
  return `${getAppUrl()}/settings/notifications?unsubscribe=${userId}`
}

/**
 * Queue work order assigned email notification
 */
export async function queueWorkOrderAssignedEmail(params: {
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  assignedByName: string
  dueDate?: Date
  priority?: string
}): Promise<boolean> {
  if (!isEmailConfigured()) return false

  const user = await getUserEmailInfo(params.userId)
  if (!user) return false

  // TODO: Check user notification preferences when implemented
  // const prefs = await getUserNotificationPreferences(params.userId)
  // if (!prefs.emailEnabled || !prefs.workOrderNotificationsEnabled) return false

  const appUrl = getAppUrl()
  const emailData: WorkOrderAssignedEmailData = {
    recipientName: user.firstName || 'there',
    unsubscribeUrl: getUnsubscribeUrl(params.userId),
    workOrderNumber: params.workOrderNumber,
    workOrderTitle: params.workOrderTitle,
    workOrderUrl: `${appUrl}/work-orders/${params.workOrderId}`,
    assignedByName: params.assignedByName,
    dueDate: params.dueDate?.toLocaleDateString() || undefined,
    priority: params.priority,
  }

  await jobs.sendEmail({
    to: user.email,
    subject: `Work Order Assigned: ${params.workOrderNumber}`,
    template: 'work-order-assigned',
    data: emailData,
  })

  return true
}

/**
 * Queue work order approval requested email notification
 */
export async function queueWorkOrderApprovalEmail(params: {
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  requestedByName: string
  approvalReason?: string
}): Promise<boolean> {
  if (!isEmailConfigured()) return false

  const user = await getUserEmailInfo(params.userId)
  if (!user) return false

  const appUrl = getAppUrl()
  const emailData: WorkOrderApprovalEmailData = {
    recipientName: user.firstName || 'there',
    unsubscribeUrl: getUnsubscribeUrl(params.userId),
    workOrderNumber: params.workOrderNumber,
    workOrderTitle: params.workOrderTitle,
    workOrderUrl: `${appUrl}/work-orders/${params.workOrderId}`,
    requestedByName: params.requestedByName,
    requestedAt: new Date().toLocaleString(),
    approvalReason: params.approvalReason,
  }

  await jobs.sendEmail({
    to: user.email,
    subject: `Approval Required: ${params.workOrderNumber}`,
    template: 'work-order-approval-requested',
    data: emailData,
  })

  return true
}

/**
 * Queue work order approved/rejected email notification
 */
export async function queueWorkOrderDecisionEmail(params: {
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  approverName: string
  status: 'approved' | 'rejected'
  reason?: string
}): Promise<boolean> {
  if (!isEmailConfigured()) return false

  const user = await getUserEmailInfo(params.userId)
  if (!user) return false

  const appUrl = getAppUrl()
  const emailData: WorkOrderApprovedRejectedEmailData = {
    recipientName: user.firstName || 'there',
    unsubscribeUrl: getUnsubscribeUrl(params.userId),
    workOrderNumber: params.workOrderNumber,
    workOrderTitle: params.workOrderTitle,
    workOrderUrl: `${appUrl}/work-orders/${params.workOrderId}`,
    approverName: params.approverName,
    status: params.status,
    reason: params.reason,
  }

  const template: EmailTemplate =
    params.status === 'approved' ? 'work-order-approved' : 'work-order-rejected'
  const subject =
    params.status === 'approved'
      ? `Work Order Approved: ${params.workOrderNumber}`
      : `Work Order Rejected: ${params.workOrderNumber}`

  await jobs.sendEmail({
    to: user.email,
    subject,
    template,
    data: emailData,
  })

  return true
}

/**
 * Queue document expiring email notification
 */
export async function queueDocumentExpiringEmail(params: {
  userId: string
  documentName: string
  documentId: string
  assetId: string
  assetNumber?: string
  assetName?: string
  daysUntilExpiry: number
  expiryDate: Date
}): Promise<boolean> {
  if (!isEmailConfigured()) return false

  const user = await getUserEmailInfo(params.userId)
  if (!user) return false

  const appUrl = getAppUrl()
  const emailData: DocumentExpiringEmailData = {
    recipientName: user.firstName || 'there',
    unsubscribeUrl: getUnsubscribeUrl(params.userId),
    documentName: params.documentName,
    documentUrl: `${appUrl}/assets/${params.assetId}?tab=documents`,
    expiryDate: params.expiryDate.toLocaleDateString(),
    daysUntilExpiry: params.daysUntilExpiry,
    assetNumber: params.assetNumber,
    assetName: params.assetName,
  }

  const urgencyPrefix =
    params.daysUntilExpiry <= 7 ? '[URGENT] ' : params.daysUntilExpiry <= 14 ? '[Warning] ' : ''

  await jobs.sendEmail({
    to: user.email,
    subject: `${urgencyPrefix}Document Expiring: ${params.documentName}`,
    template: 'document-expiring',
    data: emailData,
  })

  return true
}

/**
 * Queue fuel anomaly email notification
 */
export async function queueFuelAnomalyEmail(params: {
  userId: string
  assetNumber: string
  assetName: string
  assetId: string
  anomalyType: 'high_consumption' | 'low_consumption' | 'suspicious_refuel'
  anomalyDescription: string
  detectedAt: Date
}): Promise<boolean> {
  if (!isEmailConfigured()) return false

  const user = await getUserEmailInfo(params.userId)
  if (!user) return false

  const appUrl = getAppUrl()
  const emailData: FuelAnomalyEmailData = {
    recipientName: user.firstName || 'there',
    unsubscribeUrl: getUnsubscribeUrl(params.userId),
    assetNumber: params.assetNumber,
    assetName: params.assetName,
    assetUrl: `${appUrl}/assets/${params.assetId}`,
    anomalyType: params.anomalyType,
    anomalyDescription: params.anomalyDescription,
    detectedAt: params.detectedAt.toLocaleString(),
    fuelLogUrl: `${appUrl}/fuel/analytics?assetId=${params.assetId}`,
  }

  await jobs.sendEmail({
    to: user.email,
    subject: `Fuel Anomaly Detected: ${params.assetNumber}`,
    template: 'fuel-anomaly',
    data: emailData,
  })

  return true
}

/**
 * Queue geofence alert email notification
 */
export async function queueGeofenceAlertEmail(params: {
  userId: string
  assetNumber: string
  assetName: string
  assetId: string
  geofenceName: string
  alertType: 'entry' | 'exit' | 'after_hours'
  alertTime: Date
  locationDescription?: string
}): Promise<boolean> {
  if (!isEmailConfigured()) return false

  const user = await getUserEmailInfo(params.userId)
  if (!user) return false

  const appUrl = getAppUrl()
  const emailData: GeofenceAlertEmailData = {
    recipientName: user.firstName || 'there',
    unsubscribeUrl: getUnsubscribeUrl(params.userId),
    assetNumber: params.assetNumber,
    assetName: params.assetName,
    assetUrl: `${appUrl}/assets/${params.assetId}`,
    geofenceName: params.geofenceName,
    alertType: params.alertType,
    alertTime: params.alertTime.toLocaleString(),
    locationDescription: params.locationDescription,
  }

  const alertLabels = {
    entry: 'Geofence Entry',
    exit: 'Geofence Exit',
    after_hours: 'After-Hours Movement',
  }

  await jobs.sendEmail({
    to: user.email,
    subject: `${alertLabels[params.alertType]}: ${params.assetNumber}`,
    template: 'geofence-alert',
    data: emailData,
  })

  return true
}

// Note: A generic queueBulkAlertEmails function can be added here when needed
// for bulk email notifications. Each email type should use its specific
// queue function (e.g., queueGeofenceAlertEmail) to ensure proper typing.
