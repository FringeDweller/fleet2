import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assetCategories } from './asset-categories'
import { inspections } from './inspections'
import { organisations } from './organisations'
import { users } from './users'

/**
 * Checkpoint definitions that define which physical positions on an asset
 * require NFC/QR scanning during a walk-around inspection.
 * These are configured per asset category.
 */
export const inspectionCheckpointDefinitions = pgTable(
  'inspection_checkpoint_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),

    // Link to asset category - checkpoints are configured per category/vehicle type
    assetCategoryId: uuid('asset_category_id')
      .notNull()
      .references(() => assetCategories.id, { onDelete: 'cascade' }),

    // Checkpoint identification
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),

    // Physical position on the asset (e.g., 'front', 'rear', 'left_side', 'right_side', 'engine_bay')
    position: varchar('position', { length: 50 }).notNull(),

    // Unique identifiers for QR code and NFC tag at this checkpoint
    // These are what gets encoded in the physical tags
    qrCode: varchar('qr_code', { length: 255 }),
    nfcTag: varchar('nfc_tag', { length: 255 }),

    // Whether this checkpoint must be scanned to complete the inspection
    required: boolean('required').default(true).notNull(),

    // Display order for the checkpoint list
    displayOrder: integer('display_order').default(0).notNull(),

    // Whether this checkpoint definition is active
    isActive: boolean('is_active').default(true).notNull(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inspection_checkpoint_defs_org_id_idx').on(table.organisationId),
    index('inspection_checkpoint_defs_category_id_idx').on(table.assetCategoryId),
    index('inspection_checkpoint_defs_position_idx').on(table.position),
    index('inspection_checkpoint_defs_qr_code_idx').on(table.qrCode),
    index('inspection_checkpoint_defs_nfc_tag_idx').on(table.nfcTag),
    index('inspection_checkpoint_defs_active_idx').on(table.isActive),
  ],
)

export type InspectionCheckpointDefinition = typeof inspectionCheckpointDefinitions.$inferSelect
export type NewInspectionCheckpointDefinition = typeof inspectionCheckpointDefinitions.$inferInsert

/**
 * Records of when each checkpoint was scanned during an inspection.
 * Provides audit trail and enables enforcement of checkpoint completion.
 */
export const inspectionCheckpointScans = pgTable(
  'inspection_checkpoint_scans',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Link to the inspection being performed
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id, { onDelete: 'cascade' }),

    // Link to the checkpoint definition
    checkpointDefinitionId: uuid('checkpoint_definition_id')
      .notNull()
      .references(() => inspectionCheckpointDefinitions.id, { onDelete: 'restrict' }),

    // When the checkpoint was scanned
    scannedAt: timestamp('scanned_at', { withTimezone: true }).notNull().defaultNow(),

    // Who performed the scan (should match the inspection operator, but recorded for audit)
    scannedById: uuid('scanned_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // The raw scan data received (for audit/debugging)
    scanData: text('scan_data'),

    // How the checkpoint was scanned
    scanMethod: varchar('scan_method', { length: 20 }).notNull(), // 'qr_code' | 'nfc' | 'manual_override'

    // GPS coordinates at scan time (optional, for location verification)
    latitude: varchar('latitude', { length: 20 }),
    longitude: varchar('longitude', { length: 20 }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inspection_checkpoint_scans_inspection_id_idx').on(table.inspectionId),
    index('inspection_checkpoint_scans_checkpoint_def_id_idx').on(table.checkpointDefinitionId),
    index('inspection_checkpoint_scans_scanned_at_idx').on(table.scannedAt),
    index('inspection_checkpoint_scans_scanned_by_idx').on(table.scannedById),
  ],
)

export type InspectionCheckpointScan = typeof inspectionCheckpointScans.$inferSelect
export type NewInspectionCheckpointScan = typeof inspectionCheckpointScans.$inferInsert
