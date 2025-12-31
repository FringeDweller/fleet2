import { sql } from 'drizzle-orm'
import { db } from '../utils/db'

interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  database: {
    connected: boolean
    latency_ms: number
  }
  memory: {
    used_mb: number
    total_mb: number
    percentage: number
  }
  uptime_seconds: number
  timestamp: string
}

export default defineEventHandler(async (): Promise<HealthResponse> => {
  // Check database connectivity
  let dbConnected = false
  let dbLatency = 0

  try {
    const startTime = performance.now()
    await db.execute(sql`SELECT 1`)
    dbLatency = Math.round((performance.now() - startTime) * 100) / 100
    dbConnected = true
  } catch {
    dbConnected = false
    dbLatency = 0
  }

  // Get memory usage
  const memoryUsage = process.memoryUsage()
  const usedMb = Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100
  const totalMb = Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100
  const memoryPercentage = Math.round((usedMb / totalMb) * 10000) / 100

  // Get uptime
  const uptimeSeconds = Math.round(process.uptime() * 100) / 100

  // Determine overall health status
  const status: 'healthy' | 'unhealthy' = dbConnected ? 'healthy' : 'unhealthy'

  return {
    status,
    database: {
      connected: dbConnected,
      latency_ms: dbLatency,
    },
    memory: {
      used_mb: usedMb,
      total_mb: totalMb,
      percentage: memoryPercentage,
    },
    uptime_seconds: uptimeSeconds,
    timestamp: new Date().toISOString(),
  }
})
