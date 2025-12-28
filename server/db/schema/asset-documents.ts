import { bigint, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { users } from './users'

export const documentTypeEnum = pgEnum('document_type', [
  'registration',
  'insurance',
  'inspection',
  'certification',
  'manual',
  'warranty',
  'other',
])

export const assetDocuments = pgTable(
  'asset_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    filePath: varchar('file_path', { length: 500 }).notNull(),
    fileType: varchar('file_type', { length: 100 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    description: text('description'),
    documentType: documentTypeEnum('document_type').default('other').notNull(),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asset_documents_asset_id_idx').on(table.assetId),
    index('asset_documents_document_type_idx').on(table.documentType),
    index('asset_documents_expiry_date_idx').on(table.expiryDate),
    index('asset_documents_created_at_idx').on(table.createdAt),
  ],
)

export type AssetDocument = typeof assetDocuments.$inferSelect
export type NewAssetDocument = typeof assetDocuments.$inferInsert
