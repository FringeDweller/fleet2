import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
])

export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    totalSize: bigint('total_size', { mode: 'number' }).notNull(),
    chunkSize: integer('chunk_size').notNull(),
    totalChunks: integer('total_chunks').notNull(),
    uploadedChunks: integer('uploaded_chunks').default(0).notNull(),
    status: uploadStatusEnum('status').default('pending').notNull(),
    tempPath: varchar('temp_path', { length: 500 }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('upload_sessions_organisation_id_idx').on(table.organisationId),
    index('upload_sessions_user_id_idx').on(table.userId),
    index('upload_sessions_status_idx').on(table.status),
    index('upload_sessions_expires_at_idx').on(table.expiresAt),
  ],
)

export const uploadChunks = pgTable(
  'upload_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => uploadSessions.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    size: integer('size').notNull(),
    checksum: varchar('checksum', { length: 64 }), // SHA-256 for integrity
    tempPath: varchar('temp_path', { length: 500 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('upload_chunks_session_id_idx').on(table.sessionId),
    index('upload_chunks_session_chunk_idx').on(table.sessionId, table.chunkIndex),
  ],
)

export type UploadSession = typeof uploadSessions.$inferSelect
export type NewUploadSession = typeof uploadSessions.$inferInsert
export type UploadChunk = typeof uploadChunks.$inferSelect
export type NewUploadChunk = typeof uploadChunks.$inferInsert
