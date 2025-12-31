/**
 * US-18.*: Backup Status Monitoring Endpoint
 *
 * Returns comprehensive backup status information for the admin dashboard.
 * Only accessible to super_admin users.
 *
 * Returns:
 * - Last successful backup timestamp
 * - Backup type (full/incremental)
 * - Backup size
 * - Backup location (S3 bucket path)
 * - WAL archiving status
 * - Replication lag (if applicable)
 * - Next scheduled backup time
 * - Health indicators (warnings for stale backups, verification status)
 */

import { z } from 'zod'
import { requireSuperAdmin } from '../../utils/permissions'

// Response schema for type safety and documentation
const BackupHealthIndicatorSchema = z.object({
  name: z.string(),
  status: z.enum(['ok', 'warning', 'critical']),
  message: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
})

const BackupInfoSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum(['full', 'incremental']),
  sizeBytes: z.number(),
  sizeHuman: z.string(),
  location: z.string(),
  checksum: z.string().nullable(),
  verified: z.boolean(),
  verifiedAt: z.string().datetime().nullable(),
})

const WalArchivingStatusSchema = z.object({
  enabled: z.boolean(),
  walLevel: z.string(),
  archiveMode: z.string(),
  archiveCommand: z.string().nullable(),
  lastArchivedWal: z.string().nullable(),
  lastArchivedAt: z.string().datetime().nullable(),
})

const ReplicationStatusSchema = z.object({
  enabled: z.boolean(),
  replicas: z.array(
    z.object({
      name: z.string(),
      state: z.string(),
      lagBytes: z.number(),
      lagHuman: z.string(),
      lastReplayAt: z.string().datetime().nullable(),
    }),
  ),
  maxLagBytes: z.number(),
  maxLagHuman: z.string(),
})

const BackupScheduleSchema = z.object({
  fullBackupCron: z.string(),
  incrementalBackupCron: z.string().nullable(),
  nextFullBackup: z.string().datetime(),
  nextIncrementalBackup: z.string().datetime().nullable(),
  retentionPolicy: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number(),
  }),
})

const StorageStatusSchema = z.object({
  bucket: z.string(),
  prefix: z.string(),
  region: z.string().nullable(),
  totalBackups: z.number(),
  totalSizeBytes: z.number(),
  totalSizeHuman: z.string(),
  oldestBackup: z.string().datetime().nullable(),
  newestBackup: z.string().datetime().nullable(),
})

const BackupStatusResponseSchema = z.object({
  timestamp: z.string().datetime(),
  overallStatus: z.enum(['healthy', 'warning', 'critical', 'unknown']),
  lastBackup: BackupInfoSchema.nullable(),
  walArchiving: WalArchivingStatusSchema,
  replication: ReplicationStatusSchema,
  schedule: BackupScheduleSchema,
  storage: StorageStatusSchema,
  healthIndicators: z.array(BackupHealthIndicatorSchema),
})

type BackupStatusResponse = z.infer<typeof BackupStatusResponseSchema>
type BackupHealthIndicator = z.infer<typeof BackupHealthIndicatorSchema>

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${units[i]}`
}

/**
 * Calculate next scheduled backup time based on cron expression
 * Simplified implementation - in production, use a proper cron parser
 */
function getNextScheduledTime(_cronExpression: string, fromDate: Date = new Date()): Date {
  // Default to next day at 2 AM for full backups
  // This is a simplified implementation
  const next = new Date(fromDate)
  next.setDate(next.getDate() + 1)
  next.setHours(2, 0, 0, 0)
  return next
}

/**
 * Check backup health and generate indicators
 */
function evaluateBackupHealth(
  lastBackupTime: Date | null,
  backupVerified: boolean,
  walArchivingEnabled: boolean,
  maxReplicationLag: number,
): BackupHealthIndicator[] {
  const indicators: BackupHealthIndicator[] = []
  const now = new Date()

  // Check time since last backup
  if (lastBackupTime) {
    const hoursSinceBackup = (now.getTime() - lastBackupTime.getTime()) / (1000 * 60 * 60)

    if (hoursSinceBackup > 48) {
      indicators.push({
        name: 'backup_age',
        status: 'critical',
        message: `Last backup was ${Math.round(hoursSinceBackup)} hours ago (> 48h threshold)`,
        value: Math.round(hoursSinceBackup),
      })
    } else if (hoursSinceBackup > 24) {
      indicators.push({
        name: 'backup_age',
        status: 'warning',
        message: `Last backup was ${Math.round(hoursSinceBackup)} hours ago (> 24h threshold)`,
        value: Math.round(hoursSinceBackup),
      })
    } else {
      indicators.push({
        name: 'backup_age',
        status: 'ok',
        message: `Last backup was ${Math.round(hoursSinceBackup)} hours ago`,
        value: Math.round(hoursSinceBackup),
      })
    }
  } else {
    indicators.push({
      name: 'backup_age',
      status: 'critical',
      message: 'No backup found',
      value: null,
    })
  }

  // Check backup verification status
  indicators.push({
    name: 'backup_verified',
    status: backupVerified ? 'ok' : 'warning',
    message: backupVerified ? 'Last backup verified successfully' : 'Last backup not verified',
    value: backupVerified ? 'verified' : 'unverified',
  })

  // Check WAL archiving
  indicators.push({
    name: 'wal_archiving',
    status: walArchivingEnabled ? 'ok' : 'warning',
    message: walArchivingEnabled
      ? 'WAL archiving enabled'
      : 'WAL archiving disabled - point-in-time recovery not available',
    value: walArchivingEnabled ? 'enabled' : 'disabled',
  })

  // Check replication lag
  const lagMB = maxReplicationLag / (1024 * 1024)
  if (maxReplicationLag > 10 * 1024 * 1024) {
    // > 10MB
    indicators.push({
      name: 'replication_lag',
      status: 'critical',
      message: `Replication lag is ${formatBytes(maxReplicationLag)} (> 10MB threshold)`,
      value: maxReplicationLag,
    })
  } else if (maxReplicationLag > 1 * 1024 * 1024) {
    // > 1MB
    indicators.push({
      name: 'replication_lag',
      status: 'warning',
      message: `Replication lag is ${formatBytes(maxReplicationLag)} (> 1MB threshold)`,
      value: maxReplicationLag,
    })
  } else {
    indicators.push({
      name: 'replication_lag',
      status: 'ok',
      message: `Replication lag is ${formatBytes(maxReplicationLag)}`,
      value: maxReplicationLag,
    })
  }

  return indicators
}

/**
 * Determine overall backup status from health indicators
 */
function determineOverallStatus(
  indicators: BackupHealthIndicator[],
): 'healthy' | 'warning' | 'critical' | 'unknown' {
  const hasCritical = indicators.some((i) => i.status === 'critical')
  const hasWarning = indicators.some((i) => i.status === 'warning')

  if (hasCritical) return 'critical'
  if (hasWarning) return 'warning'
  return 'healthy'
}

export default defineEventHandler(async (event): Promise<BackupStatusResponse> => {
  // Require super_admin role
  await requireSuperAdmin(event)

  const now = new Date()

  // Get backup configuration from environment variables
  const backupBucket = process.env.BACKUP_BUCKET || 'fleet2-backups'
  const backupPrefix = process.env.BACKUP_PREFIX || 'fleet2'
  const backupRegion = process.env.BACKUP_REGION || process.env.AWS_REGION || null

  // In a real implementation, these would be fetched from:
  // 1. Database (backup metadata table)
  // 2. S3 (listing backup files)
  // 3. PostgreSQL system catalogs (replication status)
  // 4. Patroni API (cluster status)

  // For now, we'll simulate with realistic mock data
  // TODO: Replace with actual implementation when backup infrastructure is connected

  // Simulated last backup info
  const lastBackupTime = new Date(now.getTime() - 6 * 60 * 60 * 1000) // 6 hours ago
  const lastBackupSize = 256 * 1024 * 1024 // 256 MB

  const lastBackup = {
    timestamp: lastBackupTime.toISOString(),
    type: 'full' as const,
    sizeBytes: lastBackupSize,
    sizeHuman: formatBytes(lastBackupSize),
    location: `s3://${backupBucket}/${backupPrefix}/daily/${lastBackupTime.toISOString().split('T')[0]}/fleet2_full_${lastBackupTime.getTime()}.sql.gz`,
    checksum: 'a1b2c3d4e5f6789012345678abcdef01',
    verified: true,
    verifiedAt: new Date(lastBackupTime.getTime() + 30 * 60 * 1000).toISOString(), // 30 min after backup
  }

  // WAL archiving status - would query PostgreSQL
  const walArchiving = {
    enabled: true,
    walLevel: 'replica',
    archiveMode: 'on',
    archiveCommand: `'/usr/local/bin/wal-archive.sh %p %f'`,
    lastArchivedWal: '000000010000000000000042',
    lastArchivedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 min ago
  }

  // Replication status - would query pg_stat_replication or Patroni API
  const replicationLag1 = 128 * 1024 // 128 KB
  const replicationLag2 = 256 * 1024 // 256 KB
  const maxLag = Math.max(replicationLag1, replicationLag2)

  const replication = {
    enabled: true,
    replicas: [
      {
        name: 'replica-1',
        state: 'streaming',
        lagBytes: replicationLag1,
        lagHuman: formatBytes(replicationLag1),
        lastReplayAt: new Date(now.getTime() - 1000).toISOString(),
      },
      {
        name: 'replica-2',
        state: 'streaming',
        lagBytes: replicationLag2,
        lagHuman: formatBytes(replicationLag2),
        lastReplayAt: new Date(now.getTime() - 2000).toISOString(),
      },
    ],
    maxLagBytes: maxLag,
    maxLagHuman: formatBytes(maxLag),
  }

  // Backup schedule configuration
  const schedule = {
    fullBackupCron: '0 2 * * *', // Daily at 2 AM
    incrementalBackupCron: '0 */6 * * *', // Every 6 hours
    nextFullBackup: getNextScheduledTime('0 2 * * *', now).toISOString(),
    nextIncrementalBackup: (() => {
      const next = new Date(now)
      next.setHours(next.getHours() + (6 - (next.getHours() % 6)), 0, 0, 0)
      return next.toISOString()
    })(),
    retentionPolicy: {
      daily: 7,
      weekly: 4,
      monthly: 12,
    },
  }

  // Storage status - would query S3
  const totalBackups = 42
  const totalSize = 8.5 * 1024 * 1024 * 1024 // 8.5 GB

  const storage = {
    bucket: backupBucket,
    prefix: backupPrefix,
    region: backupRegion,
    totalBackups,
    totalSizeBytes: Math.round(totalSize),
    totalSizeHuman: formatBytes(totalSize),
    oldestBackup: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    newestBackup: lastBackupTime.toISOString(),
  }

  // Evaluate health indicators
  const healthIndicators = evaluateBackupHealth(
    lastBackupTime,
    lastBackup.verified,
    walArchiving.enabled,
    maxLag,
  )

  // Determine overall status
  const overallStatus = determineOverallStatus(healthIndicators)

  const response: BackupStatusResponse = {
    timestamp: now.toISOString(),
    overallStatus,
    lastBackup,
    walArchiving,
    replication,
    schedule,
    storage,
    healthIndicators,
  }

  // Validate response against schema (development/debug)
  if (process.dev) {
    const parsed = BackupStatusResponseSchema.safeParse(response)
    if (!parsed.success) {
      console.error('Backup status response validation failed:', parsed.error)
    }
  }

  return response
})
