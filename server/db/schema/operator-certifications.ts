import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

export const operatorCertifications = pgTable(
  'operator_certifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    certificationName: varchar('certification_name', { length: 100 }).notNull(),
    certificationNumber: varchar('certification_number', { length: 100 }),
    issuer: varchar('issuer', { length: 255 }),
    issuedDate: timestamp('issued_date', { withTimezone: true }),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    documentUrl: varchar('document_url', { length: 500 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('operator_certifications_organisation_id_idx').on(table.organisationId),
    index('operator_certifications_operator_id_idx').on(table.operatorId),
    index('operator_certifications_expiry_date_idx').on(table.expiryDate),
    index('operator_certifications_org_active_idx').on(table.organisationId, table.isActive),
  ],
)

export type OperatorCertification = typeof operatorCertifications.$inferSelect
export type NewOperatorCertification = typeof operatorCertifications.$inferInsert
