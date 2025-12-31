/**
 * US-15.6: Document Expiry Checker Utility
 *
 * Checks for documents expiring soon and creates notifications for users.
 * This utility is designed to be called by a scheduled job/cron.
 *
 * Notification thresholds:
 * - 30 days before: "info" notification
 * - 14 days before: "warning" notification
 * - 7 days before: "critical" notification
 */
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { createNotification } from './notifications'

interface ExpiryCheckResult {
  organisationId: string
  documentsChecked: number
  notificationsCreated: number
  errors: string[]
}

interface DocumentExpiryInfo {
  documentId: string
  documentName: string
  documentType: string
  expiryDate: Date
  assetId: string
  assetNumber: string
  organisationId: string
  daysUntilExpiry: number
  urgency: 'info' | 'warning' | 'critical'
}

/**
 * Determine urgency level based on days until expiry
 */
function getUrgency(daysUntilExpiry: number): 'info' | 'warning' | 'critical' {
  if (daysUntilExpiry <= 7) return 'critical'
  if (daysUntilExpiry <= 14) return 'warning'
  return 'info'
}

/**
 * Get notification title based on urgency
 */
function getNotificationTitle(urgency: 'info' | 'warning' | 'critical'): string {
  switch (urgency) {
    case 'critical':
      return 'Document Expiring Soon - Critical'
    case 'warning':
      return 'Document Expiring - Warning'
    default:
      return 'Document Expiring Notice'
  }
}

/**
 * Get users who should receive expiry notifications for an organisation
 * Returns users with assets:read or assets:write permissions
 */
async function getNotificationRecipients(organisationId: string): Promise<string[]> {
  const users = await db.query.users.findMany({
    where: and(eq(schema.users.organisationId, organisationId), eq(schema.users.isActive, true)),
    with: {
      role: true,
    },
  })

  // Filter for users with relevant permissions
  return users
    .filter((user) => {
      if (!user.role) return false
      const permissions = user.role.permissions as string[] | null
      if (!permissions) return false

      return (
        permissions.includes('*') ||
        permissions.includes('**') ||
        permissions.includes('assets:read') ||
        permissions.includes('assets:write')
      )
    })
    .map((user) => user.id)
}

/**
 * Check if a notification has already been sent for this document and threshold
 * Prevents duplicate notifications for the same expiry warning
 */
async function hasExistingNotification(
  documentId: string,
  urgency: 'info' | 'warning' | 'critical',
  organisationId: string,
): Promise<boolean> {
  // Check for notifications created in the last 24 hours for this document with same urgency
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(schema.notifications.organisationId, organisationId),
      eq(schema.notifications.type, 'document_expiring'),
      // Check if notification body contains the document ID and urgency indicator
      sql`${schema.notifications.body} LIKE ${`%${documentId}%`}`,
      sql`${schema.notifications.body} LIKE ${`%${urgency}%`}`,
      gte(schema.notifications.createdAt, oneDayAgo),
    ),
  })

  return !!existing
}

/**
 * Check a specific organisation's documents for expiring items
 */
export async function checkOrganisationDocumentExpiry(
  organisationId: string,
): Promise<ExpiryCheckResult> {
  const result: ExpiryCheckResult = {
    organisationId,
    documentsChecked: 0,
    notificationsCreated: 0,
    errors: [],
  }

  try {
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    // Find all documents expiring within 30 days for this organisation
    const expiringDocuments = await db
      .select({
        id: schema.assetDocuments.id,
        name: schema.assetDocuments.name,
        documentType: schema.assetDocuments.documentType,
        expiryDate: schema.assetDocuments.expiryDate,
        assetId: schema.assetDocuments.assetId,
        assetNumber: schema.assets.assetNumber,
      })
      .from(schema.assetDocuments)
      .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
      .where(
        and(
          eq(schema.assets.organisationId, organisationId),
          isNotNull(schema.assetDocuments.expiryDate),
          gte(schema.assetDocuments.expiryDate, now),
          lte(schema.assetDocuments.expiryDate, thirtyDaysFromNow),
        ),
      )

    result.documentsChecked = expiringDocuments.length

    if (expiringDocuments.length === 0) {
      return result
    }

    // Get users to notify
    const recipientIds = await getNotificationRecipients(organisationId)

    if (recipientIds.length === 0) {
      return result
    }

    // Process each expiring document
    for (const doc of expiringDocuments) {
      if (!doc.expiryDate) continue

      const daysUntilExpiry = Math.ceil(
        (doc.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )

      // Only send notifications at specific thresholds: 30, 14, 7 days
      const isNotificationThreshold =
        daysUntilExpiry === 30 || daysUntilExpiry === 14 || daysUntilExpiry === 7

      if (!isNotificationThreshold) continue

      const urgency = getUrgency(daysUntilExpiry)

      // Check if we already sent this notification recently
      const alreadyNotified = await hasExistingNotification(doc.id, urgency, organisationId)
      if (alreadyNotified) continue

      const title = getNotificationTitle(urgency)
      const body = `Document "${doc.name}" (${doc.documentType}) for asset ${doc.assetNumber} expires in ${daysUntilExpiry} days (${doc.expiryDate.toLocaleDateString()}). [${urgency}] [${doc.id}]`

      // Create notification for each recipient
      for (const userId of recipientIds) {
        try {
          await createNotification({
            organisationId,
            userId,
            type: 'document_expiring',
            title,
            body,
            link: `/assets/${doc.assetId}?tab=documents`,
            isRead: false,
          })
          result.notificationsCreated++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to create notification'
          result.errors.push(
            `Failed to notify user ${userId} about document ${doc.id}: ${errorMessage}`,
          )
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Error checking organisation ${organisationId}: ${errorMessage}`)
  }

  return result
}

/**
 * Check all organisations for expiring documents
 * This is the main entry point for a scheduled job
 */
export async function checkAllDocumentExpiry(): Promise<{
  totalOrganisations: number
  totalDocumentsChecked: number
  totalNotificationsCreated: number
  results: ExpiryCheckResult[]
}> {
  // Get all active organisations
  const organisations = await db.query.organisations.findMany({
    columns: { id: true },
  })

  const results: ExpiryCheckResult[] = []
  let totalDocumentsChecked = 0
  let totalNotificationsCreated = 0

  for (const org of organisations) {
    const result = await checkOrganisationDocumentExpiry(org.id)
    results.push(result)
    totalDocumentsChecked += result.documentsChecked
    totalNotificationsCreated += result.notificationsCreated
  }

  return {
    totalOrganisations: organisations.length,
    totalDocumentsChecked,
    totalNotificationsCreated,
    results,
  }
}

/**
 * Get a summary of expiring documents for an organisation
 * Useful for dashboard widgets
 */
export async function getExpiryDashboardSummary(organisationId: string): Promise<{
  expiredCount: number
  criticalCount: number // 7 days or less
  warningCount: number // 8-14 days
  infoCount: number // 15-30 days
  total: number
}> {
  const now = new Date()
  const sevenDays = new Date()
  sevenDays.setDate(sevenDays.getDate() + 7)
  const fourteenDays = new Date()
  fourteenDays.setDate(fourteenDays.getDate() + 14)
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)

  // Count expired documents
  const expiredResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.assets.organisationId, organisationId),
        isNotNull(schema.assetDocuments.expiryDate),
        sql`${schema.assetDocuments.expiryDate} < ${now}`,
      ),
    )

  // Count critical (0-7 days)
  const criticalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.assets.organisationId, organisationId),
        isNotNull(schema.assetDocuments.expiryDate),
        gte(schema.assetDocuments.expiryDate, now),
        lte(schema.assetDocuments.expiryDate, sevenDays),
      ),
    )

  // Count warning (8-14 days)
  const warningResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.assets.organisationId, organisationId),
        isNotNull(schema.assetDocuments.expiryDate),
        sql`${schema.assetDocuments.expiryDate} > ${sevenDays}`,
        lte(schema.assetDocuments.expiryDate, fourteenDays),
      ),
    )

  // Count info (15-30 days)
  const infoResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        eq(schema.assets.organisationId, organisationId),
        isNotNull(schema.assetDocuments.expiryDate),
        sql`${schema.assetDocuments.expiryDate} > ${fourteenDays}`,
        lte(schema.assetDocuments.expiryDate, thirtyDays),
      ),
    )

  const expiredCount = expiredResult[0]?.count ?? 0
  const criticalCount = criticalResult[0]?.count ?? 0
  const warningCount = warningResult[0]?.count ?? 0
  const infoCount = infoResult[0]?.count ?? 0

  return {
    expiredCount,
    criticalCount,
    warningCount,
    infoCount,
    total: expiredCount + criticalCount + warningCount + infoCount,
  }
}
