import {
  boolean,
  decimal,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

// Geofence types: polygon or circle
export const geofenceTypeEnum = pgEnum('geofence_type', ['polygon', 'circle'])

// Geofence categories
export const geofenceCategoryEnum = pgEnum('geofence_category', [
  'work_site',
  'depot',
  'restricted_zone',
  'customer_location',
  'fuel_station',
  'other',
])

export const geofences = pgTable(
  'geofences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    type: geofenceTypeEnum('type').notNull(),
    category: geofenceCategoryEnum('category').default('other'),
    // For circle: center point + radius
    centerLatitude: decimal('center_latitude', { precision: 10, scale: 7 }),
    centerLongitude: decimal('center_longitude', { precision: 10, scale: 7 }),
    radiusMeters: decimal('radius_meters', { precision: 10, scale: 2 }),
    // For polygon: array of coordinates as JSONB
    polygonCoordinates: jsonb('polygon_coordinates').$type<{ lat: number; lng: number }[]>(),
    // Active hours (null = always active)
    activeStartTime: time('active_start_time'),
    activeEndTime: time('active_end_time'),
    activeDays: jsonb('active_days').$type<number[]>(), // 0-6 for Sun-Sat
    isActive: boolean('is_active').default(true).notNull(),
    color: varchar('color', { length: 7 }).default('#3B82F6'), // Hex color for map display
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('geofences_organisation_id_idx').on(table.organisationId),
    index('geofences_category_idx').on(table.category),
    index('geofences_is_active_idx').on(table.isActive),
  ],
)

export type Geofence = typeof geofences.$inferSelect
export type NewGeofence = typeof geofences.$inferInsert
