import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

// Create PostgreSQL connection with connection pooling
const connectionString =
  process.env.NUXT_DATABASE_URL || 'postgresql://fleet:fleet_dev_password@localhost:54837/fleet'

// Connection pool configuration
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false // Disable prepared statements for serverless compatibility
})

export const db = drizzle(client, { schema })

export { schema }
