import {
  bigint,
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { documentFolders } from './document-folders'
import { organisations } from './organisations'
import { users } from './users'

// Custom tsvector type for full-text search
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

export const documentCategoryEnum = pgEnum('document_category', [
  'registration',
  'insurance',
  'inspection',
  'certification',
  'manual',
  'warranty',
  'invoice',
  'contract',
  'report',
  'other',
])

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => documentFolders.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    filePath: varchar('file_path', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    description: text('description'),
    category: documentCategoryEnum('category').default('other').notNull(),
    tags: text('tags').array(),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    currentVersionId: uuid('current_version_id'), // Points to the active version
    searchVector: tsvector('search_vector'), // For full-text search
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('documents_organisation_id_idx').on(table.organisationId),
    index('documents_folder_id_idx').on(table.folderId),
    index('documents_category_idx').on(table.category),
    index('documents_expiry_date_idx').on(table.expiryDate),
    index('documents_uploaded_by_id_idx').on(table.uploadedById),
    index('documents_created_at_idx').on(table.createdAt),
    index('documents_tags_idx').using('gin', table.tags),
  ],
)

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
