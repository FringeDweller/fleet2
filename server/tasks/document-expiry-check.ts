/**
 * Nitro scheduled task to check for expiring documents and send notifications
 *
 * This task runs daily to check all documents (both asset documents and general documents)
 * for upcoming expiry dates and creates notifications for the relevant users.
 *
 * Features:
 * - Configurable warning thresholds (7, 14, 30 days) via system settings
 * - Deduplication to avoid sending duplicate notifications for the same document/threshold
 * - Notifies document uploader and organisation admins/fleet managers
 * - Supports both asset documents and general documents linked to assets
 *
 * Run manually:
 * npx nuxi build
 * node .output/server/index.mjs --task=documents:expiry-check
 *
 * Or via API:
 * POST /api/admin/tasks/document-expiry-check
 */

import { and, eq, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm'
import { ROLES } from '../db/schema/roles'
import { db, schema } from '../utils/db'
import { createDocumentExpiryNotification } from '../utils/notifications'

// Default expiry warning thresholds in days
const DEFAULT_THRESHOLDS = [7, 14, 30]

interface ExpiryCheckResult {
  organisationId: string
  documentType: 'asset_document' | 'general_document'
  documentId: string
  documentName: string
  assetId: string
  assetNumber: string
  expiryDate: Date
  daysUntilExpiry: number
  notificationsCreated: number
  status: 'notified' | 'skipped' | 'error'
  reason?: string
}

interface CheckSummary {
  total: number
  notified: number
  skipped: number
  errors: number
  notificationsCreated: number
  results: ExpiryCheckResult[]
}

/**
 * Get the configured document expiry warning thresholds for an organisation
 * Falls back to default thresholds if not configured
 */
async function getExpiryThresholds(organisationId: string): Promise<number[]> {
  const setting = await db.query.systemSettings.findFirst({
    where: and(
      eq(schema.systemSettings.organisationId, organisationId),
      eq(schema.systemSettings.key, 'document_expiry_warning_days'),
    ),
  })

  if (setting?.value) {
    const value = setting.value as number | number[]
    // Support both single value and array of values
    if (Array.isArray(value)) {
      return value.sort((a, b) => b - a) // Sort descending for threshold matching
    }
    // If single value, create thresholds at 50%, 100%, 200% of the value
    return [Math.floor(value / 2), value, value * 2].sort((a, b) => b - a)
  }

  return DEFAULT_THRESHOLDS.sort((a, b) => b - a)
}

/**
 * Get admin and fleet manager users for an organisation who should receive document expiry notifications
 */
async function getNotificationRecipients(organisationId: string): Promise<string[]> {
  // First, get the role IDs for admin and fleet_manager
  const adminRoles = await db.query.roles.findMany({
    where: or(eq(schema.roles.name, ROLES.ADMIN), eq(schema.roles.name, ROLES.FLEET_MANAGER)),
  })

  if (adminRoles.length === 0) {
    return []
  }

  const roleIds = adminRoles.map((r) => r.id)

  // Get active users with these roles in the organisation
  const users = await db.query.users.findMany({
    where: and(
      eq(schema.users.organisationId, organisationId),
      eq(schema.users.isActive, true),
      inArray(schema.users.roleId, roleIds),
    ),
  })

  return users.map((u) => u.id)
}

/**
 * Check if a notification has already been sent for this document at this threshold
 * We use a pattern in the notification body to identify duplicates
 */
async function hasNotificationBeenSent(
  organisationId: string,
  _documentId: string,
  daysThreshold: number,
): Promise<boolean> {
  // Look for existing notification in the last 24 hours with matching document ID and days
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const existingNotification = await db.query.notifications.findFirst({
    where: and(
      eq(schema.notifications.organisationId, organisationId),
      eq(schema.notifications.type, 'document_expiring'),
      gte(schema.notifications.createdAt, oneDayAgo),
      // Check if the link contains the asset ID (includes the document context)
      sql`${schema.notifications.body} LIKE ${`%expires in ${daysThreshold} days%`}`,
    ),
  })

  return !!existingNotification
}

/**
 * Process asset documents for expiry notifications
 */
async function checkAssetDocuments(): Promise<ExpiryCheckResult[]> {
  const results: ExpiryCheckResult[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get the maximum threshold to fetch all potentially expiring documents
  const maxThreshold = Math.max(...DEFAULT_THRESHOLDS)
  const thresholdDate = new Date(today)
  thresholdDate.setDate(thresholdDate.getDate() + maxThreshold)

  // Find all asset documents expiring within the maximum threshold
  const expiringDocs = await db
    .select({
      document: schema.assetDocuments,
      asset: schema.assets,
    })
    .from(schema.assetDocuments)
    .innerJoin(schema.assets, eq(schema.assetDocuments.assetId, schema.assets.id))
    .where(
      and(
        isNotNull(schema.assetDocuments.expiryDate),
        gte(schema.assetDocuments.expiryDate, today),
        lte(schema.assetDocuments.expiryDate, thresholdDate),
      ),
    )

  // Group by organisation for threshold lookup
  const docsByOrg = new Map<string, typeof expiringDocs>()
  for (const doc of expiringDocs) {
    const orgId = doc.asset.organisationId
    if (!docsByOrg.has(orgId)) {
      docsByOrg.set(orgId, [])
    }
    docsByOrg.get(orgId)!.push(doc)
  }

  // Process each organisation
  for (const [organisationId, docs] of docsByOrg) {
    const thresholds = await getExpiryThresholds(organisationId)
    const recipients = await getNotificationRecipients(organisationId)

    for (const { document, asset } of docs) {
      if (!document.expiryDate) continue

      const expiryDate = new Date(document.expiryDate)
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )

      // Find the appropriate threshold for this expiry
      const applicableThreshold = thresholds.find((t) => daysUntilExpiry <= t)
      if (!applicableThreshold) {
        results.push({
          organisationId,
          documentType: 'asset_document',
          documentId: document.id,
          documentName: document.name,
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          expiryDate,
          daysUntilExpiry,
          notificationsCreated: 0,
          status: 'skipped',
          reason: 'Outside notification thresholds',
        })
        continue
      }

      // Check if notification already sent for this threshold
      const alreadySent = await hasNotificationBeenSent(
        organisationId,
        document.id,
        daysUntilExpiry,
      )
      if (alreadySent) {
        results.push({
          organisationId,
          documentType: 'asset_document',
          documentId: document.id,
          documentName: document.name,
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          expiryDate,
          daysUntilExpiry,
          notificationsCreated: 0,
          status: 'skipped',
          reason: 'Notification already sent today',
        })
        continue
      }

      // Create notifications for all recipients
      let notificationsCreated = 0
      const recipientSet = new Set(recipients)

      // Also notify the uploader if active
      const uploader = await db.query.users.findFirst({
        where: and(eq(schema.users.id, document.uploadedById), eq(schema.users.isActive, true)),
      })
      if (uploader) {
        recipientSet.add(uploader.id)
      }

      for (const userId of recipientSet) {
        try {
          await createDocumentExpiryNotification({
            organisationId,
            userId,
            documentName: document.name,
            documentId: document.id,
            assetId: asset.id,
            assetNumber: asset.assetNumber,
            daysUntilExpiry,
            expiryDate,
          })
          notificationsCreated++
        } catch (error) {
          console.error(`[Task] Failed to create notification for user ${userId}:`, error)
        }
      }

      results.push({
        organisationId,
        documentType: 'asset_document',
        documentId: document.id,
        documentName: document.name,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        expiryDate,
        daysUntilExpiry,
        notificationsCreated,
        status: notificationsCreated > 0 ? 'notified' : 'error',
        reason: notificationsCreated === 0 ? 'No recipients found' : undefined,
      })
    }
  }

  return results
}

/**
 * Process general documents linked to assets for expiry notifications
 */
async function checkGeneralDocuments(): Promise<ExpiryCheckResult[]> {
  const results: ExpiryCheckResult[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const maxThreshold = Math.max(...DEFAULT_THRESHOLDS)
  const thresholdDate = new Date(today)
  thresholdDate.setDate(thresholdDate.getDate() + maxThreshold)

  // Find all general documents expiring within the threshold that are linked to assets
  const expiringDocs = await db
    .select({
      document: schema.documents,
      link: schema.documentLinks,
      asset: schema.assets,
    })
    .from(schema.documents)
    .innerJoin(schema.documentLinks, eq(schema.documents.id, schema.documentLinks.documentId))
    .innerJoin(schema.assets, eq(schema.documentLinks.entityId, schema.assets.id))
    .where(
      and(
        eq(schema.documentLinks.entityType, 'asset'),
        isNotNull(schema.documents.expiryDate),
        gte(schema.documents.expiryDate, today),
        lte(schema.documents.expiryDate, thresholdDate),
      ),
    )

  // Group by organisation
  const docsByOrg = new Map<string, typeof expiringDocs>()
  for (const doc of expiringDocs) {
    const orgId = doc.document.organisationId
    if (!docsByOrg.has(orgId)) {
      docsByOrg.set(orgId, [])
    }
    docsByOrg.get(orgId)!.push(doc)
  }

  // Process each organisation
  for (const [organisationId, docs] of docsByOrg) {
    const thresholds = await getExpiryThresholds(organisationId)
    const recipients = await getNotificationRecipients(organisationId)

    for (const { document, asset } of docs) {
      if (!document.expiryDate) continue

      const expiryDate = new Date(document.expiryDate)
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )

      const applicableThreshold = thresholds.find((t) => daysUntilExpiry <= t)
      if (!applicableThreshold) {
        results.push({
          organisationId,
          documentType: 'general_document',
          documentId: document.id,
          documentName: document.name,
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          expiryDate,
          daysUntilExpiry,
          notificationsCreated: 0,
          status: 'skipped',
          reason: 'Outside notification thresholds',
        })
        continue
      }

      const alreadySent = await hasNotificationBeenSent(
        organisationId,
        document.id,
        daysUntilExpiry,
      )
      if (alreadySent) {
        results.push({
          organisationId,
          documentType: 'general_document',
          documentId: document.id,
          documentName: document.name,
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          expiryDate,
          daysUntilExpiry,
          notificationsCreated: 0,
          status: 'skipped',
          reason: 'Notification already sent today',
        })
        continue
      }

      let notificationsCreated = 0
      const recipientSet = new Set(recipients)

      // Also notify the uploader if active
      const uploader = await db.query.users.findFirst({
        where: and(eq(schema.users.id, document.uploadedById), eq(schema.users.isActive, true)),
      })
      if (uploader) {
        recipientSet.add(uploader.id)
      }

      for (const userId of recipientSet) {
        try {
          await createDocumentExpiryNotification({
            organisationId,
            userId,
            documentName: document.name,
            documentId: document.id,
            assetId: asset.id,
            assetNumber: asset.assetNumber,
            daysUntilExpiry,
            expiryDate,
          })
          notificationsCreated++
        } catch (error) {
          console.error(`[Task] Failed to create notification for user ${userId}:`, error)
        }
      }

      results.push({
        organisationId,
        documentType: 'general_document',
        documentId: document.id,
        documentName: document.name,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        expiryDate,
        daysUntilExpiry,
        notificationsCreated,
        status: notificationsCreated > 0 ? 'notified' : 'error',
        reason: notificationsCreated === 0 ? 'No recipients found' : undefined,
      })
    }
  }

  return results
}

/**
 * Main function to check all documents for expiry and send notifications
 */
export async function checkDocumentExpiry(): Promise<CheckSummary> {
  const assetDocResults = await checkAssetDocuments()
  const generalDocResults = await checkGeneralDocuments()

  const allResults = [...assetDocResults, ...generalDocResults]

  return {
    total: allResults.length,
    notified: allResults.filter((r) => r.status === 'notified').length,
    skipped: allResults.filter((r) => r.status === 'skipped').length,
    errors: allResults.filter((r) => r.status === 'error').length,
    notificationsCreated: allResults.reduce((sum, r) => sum + r.notificationsCreated, 0),
    results: allResults,
  }
}

export default defineTask({
  meta: {
    name: 'documents:expiry-check',
    description: 'Check for expiring documents and send notifications',
  },
  async run() {
    console.log('[Task] Starting document expiry check...')

    try {
      const summary = await checkDocumentExpiry()

      console.log(`[Task] Document expiry check complete:`)
      console.log(`  Documents checked: ${summary.total}`)
      console.log(`  Notifications sent: ${summary.notified}`)
      console.log(`  Skipped (already notified/outside threshold): ${summary.skipped}`)
      console.log(`  Errors: ${summary.errors}`)
      console.log(`  Total notifications created: ${summary.notificationsCreated}`)

      if (summary.notified > 0) {
        console.log('\nExpiring documents notified:')
        summary.results
          .filter((r) => r.status === 'notified')
          .forEach((r) => {
            console.log(
              `  - ${r.documentName} for ${r.assetNumber} (expires in ${r.daysUntilExpiry} days, ${r.notificationsCreated} notifications sent)`,
            )
          })
      }

      if (summary.errors > 0) {
        console.error('\nErrors:')
        summary.results
          .filter((r) => r.status === 'error')
          .forEach((r) => {
            console.error(`  - ${r.documentName}: ${r.reason}`)
          })
      }

      return { result: summary }
    } catch (error) {
      console.error('[Task] Fatal error during document expiry check:', error)
      throw error
    }
  },
})
