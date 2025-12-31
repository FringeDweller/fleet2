import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const documentFolders = pgTable(
  'document_folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    path: varchar('path', { length: 1000 }).notNull(), // Materialized path for hierarchy e.g., /folder1/folder2
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('document_folders_organisation_id_idx').on(table.organisationId),
    index('document_folders_parent_id_idx').on(table.parentId),
    index('document_folders_path_idx').on(table.path),
  ],
)

export type DocumentFolder = typeof documentFolders.$inferSelect
export type NewDocumentFolder = typeof documentFolders.$inferInsert
