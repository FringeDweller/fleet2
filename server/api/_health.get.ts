import { sql } from 'drizzle-orm'
import { db } from '../utils/db'

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  checks: {
    database: {
      status: 'healthy' | 'unhealthy'
      latencyMs?: number
      error?: string
    }
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      heapUsedMB: number
      heapTotalMB: number
      rssMB: number
      percentUsed: number
    }
  }
}

export default defineEventHandler(async (): Promise<HealthResponse> => {
  const startTime = Date.now()

  // Database connectivity check
  let dbStatus: HealthResponse['checks']['database']
  try {
    const dbStart = Date.now()
    await db.execute(sql`SELECT 1`)
    const dbLatency = Date.now() - dbStart

    dbStatus = {
      status: 'healthy',
      latencyMs: dbLatency,
    }
  } catch (error) {
    dbStatus = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    }
  }

  // Memory usage check
  const memUsage = process.memoryUsage()
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const rssMB = Math.round(memUsage.rss / 1024 / 1024)
  const percentUsed = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

  let memoryStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (percentUsed > 90) {
    memoryStatus = 'unhealthy'
  } else if (percentUsed > 75) {
    memoryStatus = 'degraded'
  }

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (dbStatus.status === 'unhealthy' || memoryStatus === 'unhealthy') {
    overallStatus = 'unhealthy'
  } else if (memoryStatus === 'degraded') {
    overallStatus = 'degraded'
  }

  // Get version from package.json (hardcoded fallback for runtime)
  const version = process.env.npm_package_version || '1.0.0'

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version,
    checks: {
      database: dbStatus,
      memory: {
        status: memoryStatus,
        heapUsedMB,
        heapTotalMB,
        rssMB,
        percentUsed,
      },
    },
  }
})
