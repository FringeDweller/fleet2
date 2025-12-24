import { pgTable, uuid, varchar, timestamp, text, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { organisations } from './organisations'

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id'),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('audit_log_organisation_id_idx').on(table.organisationId),
    index('audit_log_user_id_idx').on(table.userId),
    index('audit_log_entity_type_idx').on(table.entityType),
    index('audit_log_created_at_idx').on(table.createdAt)
  ]
)

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
