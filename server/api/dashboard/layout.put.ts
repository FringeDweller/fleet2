import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { DashboardLayoutConfig, DashboardWidgetType } from '../../db/schema/dashboard-layouts'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

// Valid widget types
const VALID_WIDGET_TYPES: DashboardWidgetType[] = [
  'stats',
  'chart',
  'lowStock',
  'fuelAnomalies',
  'sales',
  'recentWorkOrders',
]

// Validation schema for widget position
const widgetPositionSchema = z.object({
  x: z.number().min(0).max(11),
  y: z.number().min(0),
  w: z.number().min(1).max(12),
  h: z.number().min(1).max(12),
})

// Validation schema for widget options
const widgetOptionsSchema = z
  .object({
    dateRange: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .optional(),
    period: z.enum(['daily', 'weekly', 'monthly']).optional(),
    limit: z.number().min(1).max(100).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .optional()

// Validation schema for individual widget
const widgetSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(VALID_WIDGET_TYPES as [DashboardWidgetType, ...DashboardWidgetType[]]),
  position: widgetPositionSchema,
  options: widgetOptionsSchema,
})

// Validation schema for layout config
const layoutConfigSchema = z.object({
  widgets: z.array(widgetSchema).min(0).max(20),
  columns: z.number().min(1).max(24).default(12),
  rowHeight: z.number().min(50).max(500).optional(),
})

/**
 * PUT /api/dashboard/layout
 *
 * Saves the authenticated user's dashboard layout configuration.
 * Creates a new record if none exists, otherwise updates the existing one.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  // Validate the layout configuration
  const parseResult = layoutConfigSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid layout configuration',
      data: parseResult.error.flatten(),
    })
  }

  const layoutConfig: DashboardLayoutConfig = parseResult.data

  // Check for duplicate widget IDs
  const widgetIds = layoutConfig.widgets.map((w) => w.id)
  const uniqueIds = new Set(widgetIds)
  if (uniqueIds.size !== widgetIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Duplicate widget IDs are not allowed',
    })
  }

  // Try to find existing layout
  const existingLayout = await db.query.dashboardLayouts.findFirst({
    where: eq(schema.dashboardLayouts.userId, user.id),
  })

  const now = new Date()

  if (existingLayout) {
    // Update existing layout
    const results = await db
      .update(schema.dashboardLayouts)
      .set({
        layoutConfig,
        updatedAt: now,
      })
      .where(eq(schema.dashboardLayouts.id, existingLayout.id))
      .returning()

    const updated = results[0]
    if (!updated) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update dashboard layout',
      })
    }

    return {
      id: updated.id,
      layoutConfig: updated.layoutConfig,
      isDefault: false,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  // Create new layout
  const results = await db
    .insert(schema.dashboardLayouts)
    .values({
      userId: user.id,
      layoutConfig,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  const created = results[0]
  if (!created) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create dashboard layout',
    })
  }

  return {
    id: created.id,
    layoutConfig: created.layoutConfig,
    isDefault: false,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  }
})
