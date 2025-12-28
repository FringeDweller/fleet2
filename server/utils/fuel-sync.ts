/**
 * Fuel Sync Service
 *
 * Handles synchronization of fuel transactions from external backend systems.
 * Matches incoming transactions to authorizations and flags discrepancies.
 */

import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { db, schema } from './db'
import type { ExternalFuelTransaction } from './fuel-backend-client'
import { FuelBackendClient, FuelBackendError, getFuelBackendClient } from './fuel-backend-client'

/**
 * Thresholds for discrepancy detection
 */
export const DISCREPANCY_THRESHOLDS = {
  /** Percentage variance in quantity that triggers a discrepancy */
  quantityVariancePercent: 5,
  /** Percentage variance in amount that triggers a discrepancy */
  amountVariancePercent: 10,
  /** Time window (in minutes) for matching transactions to authorizations */
  authorizationWindowMinutes: 60,
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean
  recordsFetched: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  recordsWithErrors: number
  discrepanciesFound: number
  errors: Array<{
    externalId: string
    error: string
  }>
  durationMs: number
}

/**
 * Configuration for sync operation
 */
export interface SyncConfig {
  /** Start of date range to sync */
  fromDate: Date
  /** End of date range to sync */
  toDate: Date
  /** Organisation ID to sync for */
  organisationId: string
  /** Optional batch size for pagination */
  batchSize?: number
  /** Whether to skip duplicate detection */
  skipDuplicates?: boolean
  /** Triggered by (user ID or 'system') */
  triggeredBy?: string
}

/**
 * Match result when trying to find an authorization for a transaction
 */
interface AuthorizationMatch {
  found: boolean
  authorizationId?: string
  authorization?: {
    id: string
    authCode: string
    assetId: string
    operatorId: string
    maxQuantityLitres: string | null
    maxAmountDollars: string | null
  }
  matchType?: 'auth_code' | 'vehicle_time' | 'none'
}

/**
 * Map external fuel type to internal enum
 */
function mapFuelType(externalType?: string): 'diesel' | 'petrol' | 'electric' | 'lpg' | 'other' {
  if (!externalType) return 'diesel'

  const normalized = externalType.toLowerCase()
  if (normalized.includes('diesel')) return 'diesel'
  if (
    normalized.includes('petrol') ||
    normalized.includes('gasoline') ||
    normalized.includes('unleaded')
  ) {
    return 'petrol'
  }
  if (normalized.includes('electric')) return 'electric'
  if (normalized.includes('lpg') || normalized.includes('gas')) return 'lpg'

  return 'other'
}

/**
 * Try to match an external transaction to an internal asset
 */
async function matchAsset(
  organisationId: string,
  externalTransaction: ExternalFuelTransaction,
): Promise<{ assetId: string; userId: string } | null> {
  // Try to match by vehicle registration (license plate) first
  if (externalTransaction.vehicleRegistration) {
    const asset = await db.query.assets.findFirst({
      where: and(
        eq(schema.assets.organisationId, organisationId),
        eq(schema.assets.licensePlate, externalTransaction.vehicleRegistration),
      ),
      columns: { id: true },
    })

    if (asset) {
      // Get a default user (fleet manager or first admin)
      const defaultUser = await db.query.users.findFirst({
        where: and(
          eq(schema.users.organisationId, organisationId),
          eq(schema.users.isActive, true),
        ),
        columns: { id: true },
      })

      if (defaultUser) {
        return { assetId: asset.id, userId: defaultUser.id }
      }
    }
  }

  // Try to match by asset number
  if (externalTransaction.vehicleId) {
    const asset = await db.query.assets.findFirst({
      where: and(
        eq(schema.assets.organisationId, organisationId),
        or(
          eq(schema.assets.assetNumber, externalTransaction.vehicleId),
          eq(schema.assets.id, externalTransaction.vehicleId),
        ),
      ),
      columns: { id: true },
    })

    if (asset) {
      const defaultUser = await db.query.users.findFirst({
        where: and(
          eq(schema.users.organisationId, organisationId),
          eq(schema.users.isActive, true),
        ),
        columns: { id: true },
      })

      if (defaultUser) {
        return { assetId: asset.id, userId: defaultUser.id }
      }
    }
  }

  return null
}

/**
 * Try to find a matching authorization for the transaction
 */
async function findMatchingAuthorization(
  organisationId: string,
  externalTransaction: ExternalFuelTransaction,
  assetId: string,
): Promise<AuthorizationMatch> {
  const transactionDate = new Date(externalTransaction.transactionDate)

  // First try: match by authorization code if provided
  if (externalTransaction.authorizationCode) {
    const auth = await db.query.fuelAuthorizations.findFirst({
      where: and(
        eq(schema.fuelAuthorizations.organisationId, organisationId),
        eq(schema.fuelAuthorizations.authCode, externalTransaction.authorizationCode.toUpperCase()),
        inArray(schema.fuelAuthorizations.status, ['authorized', 'completed']),
      ),
      columns: {
        id: true,
        authCode: true,
        assetId: true,
        operatorId: true,
        maxQuantityLitres: true,
        maxAmountDollars: true,
      },
    })

    if (auth) {
      return {
        found: true,
        authorizationId: auth.id,
        authorization: auth,
        matchType: 'auth_code',
      }
    }
  }

  // Second try: match by asset and time window
  const windowStart = new Date(
    transactionDate.getTime() - DISCREPANCY_THRESHOLDS.authorizationWindowMinutes * 60 * 1000,
  )
  const windowEnd = new Date(
    transactionDate.getTime() + DISCREPANCY_THRESHOLDS.authorizationWindowMinutes * 60 * 1000,
  )

  const auth = await db.query.fuelAuthorizations.findFirst({
    where: and(
      eq(schema.fuelAuthorizations.organisationId, organisationId),
      eq(schema.fuelAuthorizations.assetId, assetId),
      gte(schema.fuelAuthorizations.requestedAt, windowStart),
      lte(schema.fuelAuthorizations.requestedAt, windowEnd),
      inArray(schema.fuelAuthorizations.status, ['authorized', 'pending']),
      isNull(schema.fuelAuthorizations.fuelTransactionId), // Not yet completed
    ),
    columns: {
      id: true,
      authCode: true,
      assetId: true,
      operatorId: true,
      maxQuantityLitres: true,
      maxAmountDollars: true,
    },
    orderBy: desc(schema.fuelAuthorizations.requestedAt),
  })

  if (auth) {
    return {
      found: true,
      authorizationId: auth.id,
      authorization: auth,
      matchType: 'vehicle_time',
    }
  }

  return { found: false, matchType: 'none' }
}

/**
 * Detect discrepancies between external transaction and authorization
 */
function detectDiscrepancies(
  externalTransaction: ExternalFuelTransaction,
  authorization: AuthorizationMatch['authorization'],
  assetId: string,
): {
  hasDiscrepancy: boolean
  discrepancyType:
    | 'quantity_mismatch'
    | 'amount_mismatch'
    | 'asset_mismatch'
    | 'unauthorized'
    | 'multiple'
    | null
  details: {
    authorizedQuantity?: number
    actualQuantity?: number
    authorizedAmount?: number
    actualAmount?: number
    authorizedAssetId?: string
    actualAssetId?: string
    quantityVariancePercent?: number
    amountVariancePercent?: number
    notes?: string
  }
} {
  // No authorization found - flag as unauthorized
  if (!authorization) {
    return {
      hasDiscrepancy: true,
      discrepancyType: 'unauthorized',
      details: {
        actualQuantity: externalTransaction.quantityLitres,
        actualAmount: externalTransaction.totalCost,
        notes: 'No matching authorization found for this transaction',
      },
    }
  }

  const issues: string[] = []
  const details: ReturnType<typeof detectDiscrepancies>['details'] = {
    actualQuantity: externalTransaction.quantityLitres,
    actualAmount: externalTransaction.totalCost,
  }

  // Check asset mismatch
  if (authorization.assetId !== assetId) {
    issues.push('asset_mismatch')
    details.authorizedAssetId = authorization.assetId
    details.actualAssetId = assetId
    details.notes = `${details.notes || ''}Transaction for different asset than authorized. `
  }

  // Check quantity mismatch
  if (authorization.maxQuantityLitres) {
    const maxLitres = Number.parseFloat(authorization.maxQuantityLitres)
    details.authorizedQuantity = maxLitres

    if (externalTransaction.quantityLitres > maxLitres) {
      const variance = ((externalTransaction.quantityLitres - maxLitres) / maxLitres) * 100
      details.quantityVariancePercent = variance

      if (variance > DISCREPANCY_THRESHOLDS.quantityVariancePercent) {
        issues.push('quantity_mismatch')
        details.notes = `${details.notes || ''}Quantity exceeds authorized amount by ${variance.toFixed(1)}%. `
      }
    }
  }

  // Check amount mismatch
  if (authorization.maxAmountDollars && externalTransaction.totalCost) {
    const maxAmount = Number.parseFloat(authorization.maxAmountDollars)
    details.authorizedAmount = maxAmount

    if (externalTransaction.totalCost > maxAmount) {
      const variance = ((externalTransaction.totalCost - maxAmount) / maxAmount) * 100
      details.amountVariancePercent = variance

      if (variance > DISCREPANCY_THRESHOLDS.amountVariancePercent) {
        issues.push('amount_mismatch')
        details.notes = `${details.notes || ''}Cost exceeds authorized amount by ${variance.toFixed(1)}%. `
      }
    }
  }

  if (issues.length === 0) {
    return { hasDiscrepancy: false, discrepancyType: null, details }
  }

  return {
    hasDiscrepancy: true,
    discrepancyType:
      issues.length > 1
        ? 'multiple'
        : (issues[0] as ReturnType<typeof detectDiscrepancies>['discrepancyType']),
    details,
  }
}

/**
 * Process a single external transaction
 */
async function processTransaction(
  organisationId: string,
  externalTransaction: ExternalFuelTransaction,
  skipDuplicates: boolean,
): Promise<{
  status: 'created' | 'updated' | 'skipped' | 'error'
  transactionId?: string
  hasDiscrepancy?: boolean
  error?: string
}> {
  // Check for duplicate
  if (skipDuplicates) {
    const existing = await db.query.fuelTransactions.findFirst({
      where: and(
        eq(schema.fuelTransactions.organisationId, organisationId),
        eq(schema.fuelTransactions.externalTransactionId, externalTransaction.transactionId),
      ),
      columns: { id: true },
    })

    if (existing) {
      return { status: 'skipped', transactionId: existing.id }
    }
  }

  // Match to internal asset
  const assetMatch = await matchAsset(organisationId, externalTransaction)
  if (!assetMatch) {
    return {
      status: 'error',
      error: `Could not match vehicle ${externalTransaction.vehicleId || externalTransaction.vehicleRegistration} to an asset`,
    }
  }

  // Find matching authorization
  const authMatch = await findMatchingAuthorization(
    organisationId,
    externalTransaction,
    assetMatch.assetId,
  )

  // Detect discrepancies
  const discrepancy = detectDiscrepancies(
    externalTransaction,
    authMatch.authorization,
    assetMatch.assetId,
  )

  // Create the fuel transaction
  const transactionDate = new Date(externalTransaction.transactionDate)

  const [created] = await db
    .insert(schema.fuelTransactions)
    .values({
      organisationId,
      assetId: assetMatch.assetId,
      userId: authMatch.authorization?.operatorId || assetMatch.userId,
      quantity: externalTransaction.quantityLitres.toString(),
      unitCost: externalTransaction.unitPrice?.toString() || null,
      totalCost: externalTransaction.totalCost?.toString() || null,
      fuelType: mapFuelType(externalTransaction.fuelType),
      odometer: externalTransaction.odometer?.toString() || null,
      latitude: externalTransaction.latitude?.toString() || null,
      longitude: externalTransaction.longitude?.toString() || null,
      locationName: externalTransaction.locationName || null,
      locationAddress: externalTransaction.locationAddress || null,
      vendor: externalTransaction.stationId || null,
      transactionDate,
      syncStatus: 'synced',
      source: 'external_sync',
      externalTransactionId: externalTransaction.transactionId,
      externalSystemId: 'fuel_backend',
      authorizationId: authMatch.authorizationId || null,
      hasDiscrepancy: discrepancy.hasDiscrepancy,
      discrepancyType: discrepancy.discrepancyType,
      discrepancyDetails: discrepancy.hasDiscrepancy ? discrepancy.details : null,
    })
    .returning({ id: schema.fuelTransactions.id })

  // If we matched an authorization, mark it as completed
  if (authMatch.authorizationId && authMatch.authorization) {
    await db
      .update(schema.fuelAuthorizations)
      .set({
        status: 'completed',
        fuelTransactionId: created!.id,
        completedAt: transactionDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.fuelAuthorizations.id, authMatch.authorizationId))
  }

  return {
    status: 'created',
    transactionId: created!.id,
    hasDiscrepancy: discrepancy.hasDiscrepancy,
  }
}

/**
 * Synchronize fuel transactions from external backend
 */
export async function syncFuelTransactions(config: SyncConfig): Promise<SyncResult> {
  const startTime = Date.now()
  const result: SyncResult = {
    success: false,
    recordsFetched: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsWithErrors: 0,
    discrepanciesFound: 0,
    errors: [],
    durationMs: 0,
  }

  const client = getFuelBackendClient()

  // Check if client is configured
  if (!client.isConfigured()) {
    result.errors.push({
      externalId: 'config',
      error: 'Fuel backend client is not configured',
    })
    result.durationMs = Date.now() - startTime
    return result
  }

  // Get or create integration health record
  let healthRecord = await db.query.integrationHealth.findFirst({
    where: and(
      eq(schema.integrationHealth.organisationId, config.organisationId),
      eq(schema.integrationHealth.integrationType, 'fuel_backend'),
    ),
  })

  if (!healthRecord) {
    const [created] = await db
      .insert(schema.integrationHealth)
      .values({
        organisationId: config.organisationId,
        integrationType: 'fuel_backend',
        integrationName: 'Fuel Backend Integration',
        status: 'unknown',
      })
      .returning()
    healthRecord = created!
  }

  // Create sync history record
  const [syncHistory] = await db
    .insert(schema.integrationSyncHistory)
    .values({
      integrationHealthId: healthRecord.id,
      organisationId: config.organisationId,
      syncType: config.triggeredBy === 'system' ? 'scheduled' : 'manual',
      startedAt: new Date(),
      metadata: {
        triggeredBy: config.triggeredBy,
        syncWindow: {
          from: config.fromDate.toISOString(),
          to: config.toDate.toISOString(),
        },
      },
    })
    .returning()

  try {
    let cursor: string | undefined
    const batchSize = config.batchSize || 100

    // Fetch all transactions using pagination
    do {
      const response = await client.fetchTransactions(
        config.fromDate.toISOString(),
        config.toDate.toISOString(),
        cursor,
        batchSize,
      )

      if (!response.success) {
        throw new FuelBackendError(
          response.error?.message || 'Failed to fetch transactions',
          (response.error?.code as 'UNKNOWN') || 'UNKNOWN',
          undefined,
          response.error?.details,
        )
      }

      result.recordsFetched += response.transactions.length

      // Process each transaction
      for (const externalTx of response.transactions) {
        try {
          const processResult = await processTransaction(
            config.organisationId,
            externalTx,
            config.skipDuplicates !== false,
          )

          switch (processResult.status) {
            case 'created':
              result.recordsCreated++
              if (processResult.hasDiscrepancy) {
                result.discrepanciesFound++
              }
              break
            case 'updated':
              result.recordsUpdated++
              break
            case 'skipped':
              result.recordsSkipped++
              break
            case 'error':
              result.recordsWithErrors++
              result.errors.push({
                externalId: externalTx.transactionId,
                error: processResult.error || 'Unknown error',
              })
              break
          }
        } catch (error) {
          result.recordsWithErrors++
          result.errors.push({
            externalId: externalTx.transactionId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      cursor = response.nextCursor
    } while (cursor)

    result.success = true

    // Update integration health - success
    await db
      .update(schema.integrationHealth)
      .set({
        status: result.recordsWithErrors > 0 ? 'degraded' : 'healthy',
        lastSuccessfulSync: new Date(),
        lastSyncAttempt: new Date(),
        consecutiveErrors: 0,
        totalSuccesses: healthRecord.totalSuccesses + 1,
        totalRecordsSynced: healthRecord.totalRecordsSynced + result.recordsCreated,
        lastSyncRecordCount: result.recordsCreated,
        lastSyncDurationMs: Date.now() - startTime,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationHealth.id, healthRecord.id))
  } catch (error) {
    result.success = false
    const errorMessage = error instanceof Error ? error.message : String(error)

    result.errors.push({
      externalId: 'sync',
      error: errorMessage,
    })

    // Update integration health - failure
    await db
      .update(schema.integrationHealth)
      .set({
        status: healthRecord.consecutiveErrors >= 2 ? 'unhealthy' : 'degraded',
        lastSyncAttempt: new Date(),
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage,
        consecutiveErrors: healthRecord.consecutiveErrors + 1,
        totalErrors: healthRecord.totalErrors + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationHealth.id, healthRecord.id))
  }

  result.durationMs = Date.now() - startTime

  // Update sync history record
  await db
    .update(schema.integrationSyncHistory)
    .set({
      completedAt: new Date(),
      durationMs: result.durationMs,
      success: result.success,
      recordsFetched: result.recordsFetched,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsWithErrors: result.recordsWithErrors,
      discrepanciesFound: result.discrepanciesFound,
      errorMessage: result.errors[0]?.error ?? null,
      errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
    })
    .where(eq(schema.integrationSyncHistory.id, syncHistory!.id))

  return result
}

/**
 * Get integration health status for an organisation
 */
export async function getIntegrationHealth(organisationId: string): Promise<{
  configured: boolean
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline' | 'unknown'
  lastSync: Date | null
  lastError: string | null
  stats: {
    totalRecordsSynced: number
    consecutiveErrors: number
    totalSuccesses: number
    totalErrors: number
  }
} | null> {
  const client = getFuelBackendClient()
  const configured = client.isConfigured()

  const healthRecord = await db.query.integrationHealth.findFirst({
    where: and(
      eq(schema.integrationHealth.organisationId, organisationId),
      eq(schema.integrationHealth.integrationType, 'fuel_backend'),
    ),
  })

  if (!healthRecord) {
    return {
      configured,
      status: configured ? 'unknown' : 'offline',
      lastSync: null,
      lastError: configured ? null : 'Integration not configured',
      stats: {
        totalRecordsSynced: 0,
        consecutiveErrors: 0,
        totalSuccesses: 0,
        totalErrors: 0,
      },
    }
  }

  return {
    configured,
    status: configured ? healthRecord.status : 'offline',
    lastSync: healthRecord.lastSuccessfulSync,
    lastError: healthRecord.lastErrorMessage,
    stats: {
      totalRecordsSynced: healthRecord.totalRecordsSynced,
      consecutiveErrors: healthRecord.consecutiveErrors,
      totalSuccesses: healthRecord.totalSuccesses,
      totalErrors: healthRecord.totalErrors,
    },
  }
}

/**
 * Get recent sync history for an organisation
 */
export async function getSyncHistory(
  organisationId: string,
  limit = 10,
): Promise<
  Array<{
    id: string
    syncType: string
    startedAt: Date
    completedAt: Date | null
    success: boolean | null
    recordsCreated: number | null
    discrepanciesFound: number | null
    errorMessage: string | null
  }>
> {
  const records = await db.query.integrationSyncHistory.findMany({
    where: eq(schema.integrationSyncHistory.organisationId, organisationId),
    orderBy: desc(schema.integrationSyncHistory.startedAt),
    limit,
    columns: {
      id: true,
      syncType: true,
      startedAt: true,
      completedAt: true,
      success: true,
      recordsCreated: true,
      discrepanciesFound: true,
      errorMessage: true,
    },
  })

  return records
}
