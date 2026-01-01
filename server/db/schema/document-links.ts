import { index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { documents } from './documents'
import { users } from './users'

export const documentLinkEntityTypeEnum = pgEnum('document_link_entity_type', [
  'asset',
  'work_order',
  'part',
  'inspection',
  'operator',
  'defect',
])

export const documentLinks = pgTable(
  'document_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    entityType: documentLinkEntityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
    linkedById: uuid('linked_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => [
    index('document_links_document_id_idx').on(table.documentId),
    index('document_links_entity_type_idx').on(table.entityType),
    index('document_links_entity_id_idx').on(table.entityId),
    index('document_links_entity_type_entity_id_idx').on(table.entityType, table.entityId),
    unique('document_links_document_entity_unique').on(
      table.documentId,
      table.entityType,
      table.entityId,
    ),
  ],
)

export type DocumentLink = typeof documentLinks.$inferSelect
export type NewDocumentLink = typeof documentLinks.$inferInsert
