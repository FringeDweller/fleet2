import { eq } from 'drizzle-orm'
import type { DashboardLayoutConfig } from '../../db/schema/dashboard-layouts'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

/**
 * GET /api/dashboard/layout
 *
 * Retrieves the authenticated user's dashboard layout configuration.
 * Returns the default layout if user has not customized it.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Try to find user's saved layout
  const savedLayout = await db.query.dashboardLayouts.findFirst({
    where: eq(schema.dashboardLayouts.userId, user.id),
  })

  if (savedLayout) {
    return {
      id: savedLayout.id,
      layoutConfig: savedLayout.layoutConfig,
      isDefault: false,
      createdAt: savedLayout.createdAt,
      updatedAt: savedLayout.updatedAt,
    }
  }

  // Return default layout if user has not customized
  const defaultLayout: DashboardLayoutConfig = {
    columns: 12,
    rowHeight: 100,
    widgets: [
      {
        id: 'stats-1',
        type: 'stats',
        position: { x: 0, y: 0, w: 12, h: 1 },
        options: {},
      },
      {
        id: 'chart-1',
        type: 'chart',
        position: { x: 0, y: 1, w: 12, h: 4 },
        options: {},
      },
      {
        id: 'lowStock-1',
        type: 'lowStock',
        position: { x: 0, y: 5, w: 6, h: 4 },
        options: {},
      },
      {
        id: 'fuelAnomalies-1',
        type: 'fuelAnomalies',
        position: { x: 6, y: 5, w: 6, h: 4 },
        options: {},
      },
      {
        id: 'sales-1',
        type: 'sales',
        position: { x: 0, y: 9, w: 6, h: 4 },
        options: {},
      },
    ],
  }

  return {
    id: null,
    layoutConfig: defaultLayout,
    isDefault: true,
    createdAt: null,
    updatedAt: null,
  }
})
