import { bigint, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { documents } from './documents'
import { users } from './users'

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    versionNumber: varchar('version_number', { length: 20 }).notNull(), // e.g., "1.0", "1.1", "2.0"
    filePath: varchar('file_path', { length: 500 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    changeNotes: text('change_notes'),
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('document_versions_document_id_idx').on(table.documentId),
    index('document_versions_uploaded_by_id_idx').on(table.uploadedById),
    index('document_versions_created_at_idx').on(table.createdAt),
  ],
)

export type DocumentVersion = typeof documentVersions.$inferSelect
export type NewDocumentVersion = typeof documentVersions.$inferInsert
