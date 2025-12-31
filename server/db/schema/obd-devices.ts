import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assets } from './assets'
import { organisations } from './organisations'
import { users } from './users'

/**
 * OBD Device Pairing Schema (US-10.1, US-10.2)
 *
 * Stores Bluetooth OBD dongle pairing information for assets.
 * Supports ELM327 and compatible OBD-II dongles.
 */

export const obdDeviceTypeEnum = pgEnum('obd_device_type', [
  'elm327', // Standard ELM327 chipset
  'obd_link', // OBDLink devices
  'vgate', // Vgate devices
  'other', // Other compatible devices
])

export const obdDevices = pgTable(
  'obd_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Bluetooth device identifier (stored from Web Bluetooth API)
    bluetoothDeviceId: varchar('bluetooth_device_id', { length: 255 }).notNull(),
    // User-friendly device name from Bluetooth
    deviceName: varchar('device_name', { length: 255 }).notNull(),
    // Device type for protocol handling
    deviceType: obdDeviceTypeEnum('device_type').default('elm327').notNull(),
    // Service UUID used for connection (SPP or custom)
    serviceUuid: varchar('service_uuid', { length: 36 }),
    // Whether this pairing is currently active
    isActive: boolean('is_active').default(true).notNull(),
    // Last successful connection timestamp
    lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
    // Connection metadata (firmware version, protocol detected, etc.)
    metadata: text('metadata'), // JSON stored as text
    // User who paired the device
    pairedById: uuid('paired_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('obd_devices_organisation_id_idx').on(table.organisationId),
    index('obd_devices_asset_id_idx').on(table.assetId),
    index('obd_devices_bluetooth_device_id_idx').on(table.bluetoothDeviceId),
    index('obd_devices_is_active_idx').on(table.isActive),
  ],
)

export type ObdDevice = typeof obdDevices.$inferSelect
export type NewObdDevice = typeof obdDevices.$inferInsert
