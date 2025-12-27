import {
  boolean,
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { partCategories } from './part-categories'

export const partUnitEnum = pgEnum('part_unit', [
  'each',
  'liters',
  'gallons',
  'kg',
  'lbs',
  'meters',
  'feet',
  'box',
  'set',
  'pair',
])

export const parts = pgTable(
  'parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => partCategories.id, { onDelete: 'set null' }),
    sku: varchar('sku', { length: 50 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    unit: partUnitEnum('unit').default('each').notNull(),
    quantityInStock: decimal('quantity_in_stock', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    minimumStock: decimal('minimum_stock', { precision: 12, scale: 2 }).default('0'),
    reorderThreshold: decimal('reorder_threshold', { precision: 12, scale: 2 }),
    reorderQuantity: decimal('reorder_quantity', { precision: 12, scale: 2 }),
    unitCost: decimal('unit_cost', { precision: 12, scale: 2 }),
    supplier: varchar('supplier', { length: 200 }),
    supplierPartNumber: varchar('supplier_part_number', { length: 100 }),
    location: varchar('location', { length: 100 }),
    onOrderQuantity: decimal('on_order_quantity', { precision: 12, scale: 2 }).default('0'),
    onOrderDate: timestamp('on_order_date', { withTimezone: true }),
    onOrderNotes: text('on_order_notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('parts_organisation_id_idx').on(table.organisationId),
    index('parts_category_id_idx').on(table.categoryId),
    index('parts_sku_idx').on(table.sku),
  ],
)

export type Part = typeof parts.$inferSelect
export type NewPart = typeof parts.$inferInsert
