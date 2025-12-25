import { pgTable, uuid, varchar, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core'
import { workOrders } from './work-orders'
import { users } from './users'

export const photoTypeEnum = pgEnum('photo_type', ['before', 'during', 'after', 'issue', 'other'])

export const workOrderPhotos = pgTable(
  'work_order_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    photoUrl: varchar('photo_url', { length: 500 }).notNull(),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    photoType: photoTypeEnum('photo_type').default('other').notNull(),
    caption: text('caption'),
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index('work_order_photos_work_order_id_idx').on(table.workOrderId),
    index('work_order_photos_photo_type_idx').on(table.photoType)
  ]
)

export type WorkOrderPhoto = typeof workOrderPhotos.$inferSelect
export type NewWorkOrderPhoto = typeof workOrderPhotos.$inferInsert
