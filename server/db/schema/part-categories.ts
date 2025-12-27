import { pgTable, uuid, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const partCategories = pgTable(
  'part_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('part_categories_organisation_id_idx').on(table.organisationId),
    index('part_categories_parent_id_idx').on(table.parentId)
  ]
)

export type PartCategory = typeof partCategories.$inferSelect
export type NewPartCategory = typeof partCategories.$inferInsert
