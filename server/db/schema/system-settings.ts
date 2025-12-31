import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'
import { users } from './users'

/**
 * US-17.4: System Configuration Management
 * Categories for organizing system settings
 */
export const systemSettingCategoryEnum = pgEnum('system_setting_category', [
  'maintenance',
  'approval',
  'certification',
  'fuel',
  'notifications',
  'general',
])

/**
 * System-wide settings table for configuration management
 * Each organisation has its own set of configurable settings
 */
export const systemSettings = pgTable(
  'system_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    value: jsonb('value').notNull(),
    description: text('description'),
    category: systemSettingCategoryEnum('category').notNull().default('general'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    // Each setting key must be unique per organisation
    index('system_settings_org_key_unique_idx').on(table.organisationId, table.key),
    index('system_settings_org_id_idx').on(table.organisationId),
    index('system_settings_category_idx').on(table.category),
  ],
)

export type SystemSetting = typeof systemSettings.$inferSelect
export type NewSystemSetting = typeof systemSettings.$inferInsert

/**
 * Default system settings with their descriptions
 * These will be seeded when an organisation is created or when settings are first accessed
 */
export const DEFAULT_SYSTEM_SETTINGS = [
  {
    key: 'maintenance_schedule_default_interval',
    value: 90, // days
    description: 'Default interval in days between scheduled maintenance tasks',
    category: 'maintenance' as const,
  },
  {
    key: 'approval_threshold_amount',
    value: 500, // currency amount
    description: 'Work orders with estimated costs at or above this amount require approval',
    category: 'approval' as const,
  },
  {
    key: 'certification_expiry_warning_days',
    value: 30,
    description: 'Number of days before certification expiry to start sending warnings',
    category: 'certification' as const,
  },
  {
    key: 'pre_start_check_required',
    value: true,
    description: 'Require operators to complete a pre-start check before beginning a session',
    category: 'certification' as const,
  },
  {
    key: 'fuel_variance_threshold_percent',
    value: 15,
    description: 'Percentage variance in fuel consumption that triggers an alert',
    category: 'fuel' as const,
  },
  {
    key: 'notification_email_enabled',
    value: true,
    description: 'Enable sending notification emails to users',
    category: 'notifications' as const,
  },
  {
    key: 'document_expiry_warning_days',
    value: 14,
    description: 'Number of days before document expiry to start sending warnings',
    category: 'general' as const,
  },
  {
    key: 'max_work_order_attachments',
    value: 10,
    description: 'Maximum number of attachments allowed per work order',
    category: 'maintenance' as const,
  },
]
