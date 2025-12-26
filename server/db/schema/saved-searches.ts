import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index, pgEnum } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const savedSearchEntityEnum = pgEnum('saved_search_entity', ['asset', 'work_order'])

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    entity: savedSearchEntityEnum('entity').notNull().default('asset'),
    filters: jsonb('filters').notNull().$type<SavedSearchFilters>(),
    isDefault: boolean('is_default').default(false).notNull(),
    isShared: boolean('is_shared').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('saved_searches_organisation_id_idx').on(table.organisationId),
    index('saved_searches_user_id_idx').on(table.userId),
    index('saved_searches_entity_idx').on(table.entity)
  ]
)

export interface SavedSearchFilters {
  search?: string
  status?: string
  categoryId?: string
  make?: string
  model?: string
  yearMin?: number
  yearMax?: number
  mileageMin?: number
  mileageMax?: number
  hoursMin?: number
  hoursMax?: number
  includeArchived?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export type SavedSearch = typeof savedSearches.$inferSelect
export type NewSavedSearch = typeof savedSearches.$inferInsert
