import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

// Channel override type matching the database schema
type ChannelOverrides = Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>

const updatePreferencesSchema = z.object({
  // Global channel preferences
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),

  // Per-category notification preferences
  workOrderAssigned: z.boolean().optional(),
  workOrderStatusChanged: z.boolean().optional(),
  workOrderApprovalRequested: z.boolean().optional(),
  workOrderApproved: z.boolean().optional(),
  workOrderRejected: z.boolean().optional(),
  workOrderDueSoon: z.boolean().optional(),
  workOrderOverdue: z.boolean().optional(),
  geofenceAlerts: z.boolean().optional(),
  fuelAnomalies: z.boolean().optional(),
  documentExpiring: z.boolean().optional(),
  defectReported: z.boolean().optional(),
  shiftHandover: z.boolean().optional(),
  systemNotifications: z.boolean().optional(),

  // Quiet hours settings
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(), // Time string like "22:00:00"
  quietHoursEnd: z.string().nullable().optional(),
  quietHoursDays: z.array(z.number().min(0).max(6)).optional(),

  // Email digest preferences
  emailDigestEnabled: z.boolean().optional(),
  emailDigestFrequency: z.enum(['daily', 'weekly', 'never']).optional(),

  // Channel overrides per category (not used in current UI, but available for future use)
  channelOverrides: z
    .record(
      z.string(),
      z.object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        inApp: z.boolean().optional(),
      }),
    )
    .nullable()
    .optional()
    .transform((val): ChannelOverrides | null | undefined => val),
})

/**
 * PUT /api/user/notification-preferences
 *
 * Update the current user's notification preferences.
 * Creates preferences if they don't exist (upsert).
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const body = await readBody(event)

  const result = updatePreferencesSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const updates = result.data

  // Check if preferences exist
  const existing = await db.query.notificationPreferences.findFirst({
    where: eq(schema.notificationPreferences.userId, user.id),
    columns: { id: true },
  })

  if (existing) {
    // Update existing preferences
    const [updated] = await db
      .update(schema.notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationPreferences.userId, user.id))
      .returning()

    return updated
  } else {
    // Create new preferences
    const [created] = await db
      .insert(schema.notificationPreferences)
      .values({
        userId: user.id,
        organisationId: user.organisationId,
        ...updates,
      })
      .returning()

    return created
  }
})
