import { Resend } from 'resend'

// Initialize Resend client lazily
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  const config = useRuntimeConfig()
  const apiKey = config.resendApiKey || process.env.NUXT_RESEND_API_KEY

  if (!apiKey) {
    console.warn('Email service: NUXT_RESEND_API_KEY not configured')
    return null
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

// Get email configuration from runtime config
function getEmailSettings() {
  const config = useRuntimeConfig()
  return {
    from: config.emailFrom || process.env.NUXT_EMAIL_FROM || 'Fleet2 <noreply@fleet.app>',
    replyTo: config.emailReplyTo || process.env.NUXT_EMAIL_REPLY_TO || undefined,
    appName: config.public.appName || 'Fleet2',
    appUrl: config.public.appUrl || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
  }
}

// Email template types
export type EmailTemplate =
  | 'password-reset'
  | 'work-order-assigned'
  | 'work-order-approval-requested'
  | 'work-order-approved'
  | 'work-order-rejected'
  | 'document-expiring'
  | 'fuel-anomaly'
  | 'geofence-alert'
  | 'notification-digest'

export interface BaseEmailData {
  recipientName?: string
  unsubscribeUrl?: string
}

export interface PasswordResetEmailData extends BaseEmailData {
  resetUrl: string
  expiresIn?: string
}

export interface WorkOrderAssignedEmailData extends BaseEmailData {
  workOrderNumber: string
  workOrderTitle: string
  workOrderUrl: string
  assignedByName: string
  dueDate?: string
  priority?: string
}

export interface WorkOrderApprovalEmailData extends BaseEmailData {
  workOrderNumber: string
  workOrderTitle: string
  workOrderUrl: string
  requestedByName: string
  requestedAt: string
  approvalReason?: string
}

export interface WorkOrderApprovedRejectedEmailData extends BaseEmailData {
  workOrderNumber: string
  workOrderTitle: string
  workOrderUrl: string
  approverName: string
  status: 'approved' | 'rejected'
  reason?: string
}

export interface DocumentExpiringEmailData extends BaseEmailData {
  documentName: string
  documentUrl: string
  expiryDate: string
  daysUntilExpiry: number
  assetNumber?: string
  assetName?: string
}

export interface FuelAnomalyEmailData extends BaseEmailData {
  assetNumber: string
  assetName: string
  assetUrl: string
  anomalyType: 'high_consumption' | 'low_consumption' | 'suspicious_refuel'
  anomalyDescription: string
  detectedAt: string
  fuelLogUrl?: string
}

export interface GeofenceAlertEmailData extends BaseEmailData {
  assetNumber: string
  assetName: string
  assetUrl: string
  geofenceName: string
  alertType: 'entry' | 'exit' | 'after_hours'
  alertTime: string
  locationDescription?: string
}

export interface NotificationDigestEmailData extends BaseEmailData {
  notifications: {
    title: string
    body: string
    link?: string
    type: string
    createdAt: string
  }[]
  digestPeriod: 'daily' | 'weekly'
}

type EmailData =
  | PasswordResetEmailData
  | WorkOrderAssignedEmailData
  | WorkOrderApprovalEmailData
  | WorkOrderApprovedRejectedEmailData
  | DocumentExpiringEmailData
  | FuelAnomalyEmailData
  | GeofenceAlertEmailData
  | NotificationDigestEmailData

interface SendEmailParams {
  to: string | string[]
  subject: string
  template: EmailTemplate
  data: EmailData
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Render email template to HTML
 */
function renderEmailTemplate(
  template: EmailTemplate,
  data: EmailData,
): { html: string; text: string } {
  const baseData = data as BaseEmailData
  const recipientName = baseData.recipientName || 'there'
  const emailSettings = getEmailSettings()
  const { appName, appUrl } = emailSettings

  // Common header/footer HTML
  const wrapHtml = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background-color: #18181b; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; color: #3f3f46; line-height: 1.6; }
    .content h2 { color: #18181b; margin-top: 0; }
    .button { display: inline-block; background-color: #18181b; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0; }
    .button:hover { background-color: #27272a; }
    .info-box { background-color: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .info-box p { margin: 4px 0; }
    .info-label { font-weight: 500; color: #71717a; }
    .footer { padding: 24px; text-align: center; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
    .footer a { color: #18181b; text-decoration: underline; }
    .warning { color: #ca8a04; }
    .error { color: #dc2626; }
    .success { color: #16a34a; }
    .muted { color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${appName}</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>This email was sent by ${appName}</p>
        ${baseData.unsubscribeUrl ? `<p><a href="${baseData.unsubscribeUrl}">Unsubscribe from these emails</a></p>` : ''}
        <p><a href="${appUrl}">${appUrl}</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`

  let html = ''
  let text = ''

  switch (template) {
    case 'password-reset': {
      const d = data as PasswordResetEmailData
      html = wrapHtml(`
        <h2>Reset Your Password</h2>
        <p>Hi ${recipientName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="text-align: center;">
          <a href="${d.resetUrl}" class="button">Reset Password</a>
        </p>
        <p class="muted">This link will expire in ${d.expiresIn || '1 hour'}.</p>
        <p class="muted">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      `)
      text = `Hi ${recipientName},\n\nWe received a request to reset your password. Visit the following link to create a new password:\n\n${d.resetUrl}\n\nThis link will expire in ${d.expiresIn || '1 hour'}.\n\nIf you didn't request this, you can safely ignore this email.`
      break
    }

    case 'work-order-assigned': {
      const d = data as WorkOrderAssignedEmailData
      html = wrapHtml(`
        <h2>Work Order Assigned to You</h2>
        <p>Hi ${recipientName},</p>
        <p>A work order has been assigned to you by <strong>${d.assignedByName}</strong>.</p>
        <div class="info-box">
          <p><span class="info-label">Work Order:</span> ${d.workOrderNumber}</p>
          <p><span class="info-label">Title:</span> ${d.workOrderTitle}</p>
          ${d.priority ? `<p><span class="info-label">Priority:</span> ${d.priority}</p>` : ''}
          ${d.dueDate ? `<p><span class="info-label">Due Date:</span> ${d.dueDate}</p>` : ''}
        </div>
        <p style="text-align: center;">
          <a href="${d.workOrderUrl}" class="button">View Work Order</a>
        </p>
      `)
      text = `Hi ${recipientName},\n\nA work order has been assigned to you by ${d.assignedByName}.\n\nWork Order: ${d.workOrderNumber}\nTitle: ${d.workOrderTitle}${d.priority ? `\nPriority: ${d.priority}` : ''}${d.dueDate ? `\nDue Date: ${d.dueDate}` : ''}\n\nView it here: ${d.workOrderUrl}`
      break
    }

    case 'work-order-approval-requested': {
      const d = data as WorkOrderApprovalEmailData
      html = wrapHtml(`
        <h2>Approval Required</h2>
        <p>Hi ${recipientName},</p>
        <p>A work order requires your approval.</p>
        <div class="info-box">
          <p><span class="info-label">Work Order:</span> ${d.workOrderNumber}</p>
          <p><span class="info-label">Title:</span> ${d.workOrderTitle}</p>
          <p><span class="info-label">Requested by:</span> ${d.requestedByName}</p>
          <p><span class="info-label">Requested at:</span> ${d.requestedAt}</p>
          ${d.approvalReason ? `<p><span class="info-label">Reason:</span> ${d.approvalReason}</p>` : ''}
        </div>
        <p style="text-align: center;">
          <a href="${d.workOrderUrl}" class="button">Review & Approve</a>
        </p>
      `)
      text = `Hi ${recipientName},\n\nA work order requires your approval.\n\nWork Order: ${d.workOrderNumber}\nTitle: ${d.workOrderTitle}\nRequested by: ${d.requestedByName}\nRequested at: ${d.requestedAt}\n\nReview it here: ${d.workOrderUrl}`
      break
    }

    case 'work-order-approved':
    case 'work-order-rejected': {
      const d = data as WorkOrderApprovedRejectedEmailData
      const isApproved = d.status === 'approved'
      html = wrapHtml(`
        <h2>Work Order ${isApproved ? 'Approved' : 'Rejected'}</h2>
        <p>Hi ${recipientName},</p>
        <p>Your work order has been <span class="${isApproved ? 'success' : 'error'}">${d.status}</span> by <strong>${d.approverName}</strong>.</p>
        <div class="info-box">
          <p><span class="info-label">Work Order:</span> ${d.workOrderNumber}</p>
          <p><span class="info-label">Title:</span> ${d.workOrderTitle}</p>
          ${d.reason ? `<p><span class="info-label">Reason:</span> ${d.reason}</p>` : ''}
        </div>
        <p style="text-align: center;">
          <a href="${d.workOrderUrl}" class="button">View Work Order</a>
        </p>
      `)
      text = `Hi ${recipientName},\n\nYour work order has been ${d.status} by ${d.approverName}.\n\nWork Order: ${d.workOrderNumber}\nTitle: ${d.workOrderTitle}${d.reason ? `\nReason: ${d.reason}` : ''}\n\nView it here: ${d.workOrderUrl}`
      break
    }

    case 'document-expiring': {
      const d = data as DocumentExpiringEmailData
      const urgencyClass =
        d.daysUntilExpiry <= 7 ? 'error' : d.daysUntilExpiry <= 14 ? 'warning' : ''
      html = wrapHtml(`
        <h2>Document Expiring Soon</h2>
        <p>Hi ${recipientName},</p>
        <p>A document is <span class="${urgencyClass}">expiring in ${d.daysUntilExpiry} day${d.daysUntilExpiry === 1 ? '' : 's'}</span>.</p>
        <div class="info-box">
          <p><span class="info-label">Document:</span> ${d.documentName}</p>
          <p><span class="info-label">Expiry Date:</span> ${d.expiryDate}</p>
          ${d.assetNumber ? `<p><span class="info-label">Asset:</span> ${d.assetNumber} - ${d.assetName || ''}</p>` : ''}
        </div>
        <p style="text-align: center;">
          <a href="${d.documentUrl}" class="button">View Document</a>
        </p>
        <p class="muted">Please renew or update this document before it expires.</p>
      `)
      text = `Hi ${recipientName},\n\nA document is expiring in ${d.daysUntilExpiry} day(s).\n\nDocument: ${d.documentName}\nExpiry Date: ${d.expiryDate}${d.assetNumber ? `\nAsset: ${d.assetNumber}` : ''}\n\nView it here: ${d.documentUrl}`
      break
    }

    case 'fuel-anomaly': {
      const d = data as FuelAnomalyEmailData
      const anomalyLabel =
        d.anomalyType === 'high_consumption'
          ? 'High Fuel Consumption'
          : d.anomalyType === 'low_consumption'
            ? 'Low Fuel Consumption'
            : 'Suspicious Refuel'
      html = wrapHtml(`
        <h2 class="warning">Fuel Anomaly Detected</h2>
        <p>Hi ${recipientName},</p>
        <p>A fuel anomaly has been detected that requires your attention.</p>
        <div class="info-box">
          <p><span class="info-label">Asset:</span> ${d.assetNumber} - ${d.assetName}</p>
          <p><span class="info-label">Anomaly Type:</span> <span class="warning">${anomalyLabel}</span></p>
          <p><span class="info-label">Description:</span> ${d.anomalyDescription}</p>
          <p><span class="info-label">Detected:</span> ${d.detectedAt}</p>
        </div>
        <p style="text-align: center;">
          <a href="${d.assetUrl}" class="button">View Asset</a>
        </p>
      `)
      text = `Hi ${recipientName},\n\nA fuel anomaly has been detected.\n\nAsset: ${d.assetNumber} - ${d.assetName}\nAnomaly Type: ${anomalyLabel}\nDescription: ${d.anomalyDescription}\nDetected: ${d.detectedAt}\n\nView asset: ${d.assetUrl}`
      break
    }

    case 'geofence-alert': {
      const d = data as GeofenceAlertEmailData
      const alertLabel =
        d.alertType === 'entry'
          ? 'Entered'
          : d.alertType === 'exit'
            ? 'Exited'
            : 'After-Hours Movement'
      const alertClass = d.alertType === 'after_hours' ? 'warning' : ''
      html = wrapHtml(`
        <h2>Geofence Alert</h2>
        <p>Hi ${recipientName},</p>
        <p>A vehicle has triggered a geofence alert.</p>
        <div class="info-box">
          <p><span class="info-label">Asset:</span> ${d.assetNumber} - ${d.assetName}</p>
          <p><span class="info-label">Geofence:</span> ${d.geofenceName}</p>
          <p><span class="info-label">Alert:</span> <span class="${alertClass}">${alertLabel}</span></p>
          <p><span class="info-label">Time:</span> ${d.alertTime}</p>
          ${d.locationDescription ? `<p><span class="info-label">Location:</span> ${d.locationDescription}</p>` : ''}
        </div>
        <p style="text-align: center;">
          <a href="${d.assetUrl}" class="button">View Asset</a>
        </p>
      `)
      text = `Hi ${recipientName},\n\nA vehicle has triggered a geofence alert.\n\nAsset: ${d.assetNumber} - ${d.assetName}\nGeofence: ${d.geofenceName}\nAlert: ${alertLabel}\nTime: ${d.alertTime}\n\nView asset: ${d.assetUrl}`
      break
    }

    case 'notification-digest': {
      const d = data as NotificationDigestEmailData
      const periodLabel = d.digestPeriod === 'daily' ? 'Daily' : 'Weekly'
      const notificationsList = d.notifications
        .map(
          (n) => `
          <div style="border-bottom: 1px solid #e4e4e7; padding: 12px 0;">
            <p style="margin: 0; font-weight: 500;">${n.title}</p>
            <p style="margin: 4px 0; color: #71717a;">${n.body}</p>
            ${n.link ? `<a href="${n.link}" style="color: #18181b; font-size: 14px;">View details →</a>` : ''}
          </div>
        `,
        )
        .join('')

      html = wrapHtml(`
        <h2>${periodLabel} Notification Digest</h2>
        <p>Hi ${recipientName},</p>
        <p>Here's a summary of your notifications:</p>
        <div style="margin: 16px 0;">
          ${notificationsList}
        </div>
        <p style="text-align: center;">
          <a href="${appUrl}" class="button">View All Notifications</a>
        </p>
      `)

      const notificationsText = d.notifications.map((n) => `• ${n.title}: ${n.body}`).join('\n')
      text = `Hi ${recipientName},\n\nHere's your ${d.digestPeriod} notification digest:\n\n${notificationsText}\n\nView all: ${appUrl}`
      break
    }
  }

  return { html, text }
}

/**
 * Send an email using Resend
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResendClient()

  if (!resend) {
    console.warn('Email service not configured, skipping email send')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const emailSettings = getEmailSettings()
    const { html, text } = renderEmailTemplate(params.template, params.data)

    const result = await resend.emails.send({
      from: emailSettings.from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      replyTo: emailSettings.replyTo,
      subject: params.subject,
      html,
      text,
    })

    if (result.error) {
      console.error('Failed to send email:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  const config = useRuntimeConfig()
  return !!(config.resendApiKey || process.env.NUXT_RESEND_API_KEY)
}

/**
 * Get email configuration (for admin display)
 */
export function getEmailConfig() {
  const settings = getEmailSettings()
  return {
    configured: isEmailConfigured(),
    from: settings.from,
    appName: settings.appName,
  }
}
