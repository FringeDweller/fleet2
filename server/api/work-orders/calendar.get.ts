import { and, between, eq, gte, inArray, lte } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Require work_orders:read permission
  const user = await requirePermission(event, 'work_orders:read')

  const query = getQuery(event)
  const start = query.start as string | undefined
  const end = query.end as string | undefined
  const assetId = query.asset_id as string | undefined
  const categoryId = query.category_id as string | undefined
  const technicianId = query.technician_id as string | undefined

  // Validate date range parameters
  if (!start || !end) {
    throw createError({
      statusCode: 400,
      message: 'start and end date parameters are required',
    })
  }

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw createError({
      statusCode: 400,
      message: 'Invalid date format',
    })
  }

  // Build conditions for filtering
  const conditions = [
    eq(schema.workOrders.organisationId, user.organisationId),
    eq(schema.workOrders.isArchived, false),
  ]

  // Filter by date range - work orders with dueDate in the range
  // OR work orders that are scheduled/open/in_progress (for visibility)
  conditions.push(
    and(gte(schema.workOrders.dueDate, startDate), lte(schema.workOrders.dueDate, endDate))!,
  )

  // Filter by asset
  if (assetId) {
    conditions.push(eq(schema.workOrders.assetId, assetId))
  }

  // Filter by asset category (through asset relationship)
  let filteredAssetIds: string[] | undefined
  if (categoryId) {
    const assetsInCategory = await db.query.assets.findMany({
      where: and(
        eq(schema.assets.organisationId, user.organisationId),
        eq(schema.assets.categoryId, categoryId),
      ),
      columns: { id: true },
    })
    filteredAssetIds = assetsInCategory.map((a) => a.id)
    if (filteredAssetIds.length > 0) {
      conditions.push(inArray(schema.workOrders.assetId, filteredAssetIds))
    } else {
      // No assets in this category, return empty
      return []
    }
  }

  // Filter by assigned technician
  if (technicianId) {
    if (technicianId === 'null') {
      // Filter for unassigned work orders - skip this since we can't use isNull in AND array
      // Will handle separately below
    } else {
      conditions.push(eq(schema.workOrders.assignedToId, technicianId))
    }
  }

  // Fetch work orders with related data
  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      assignee: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: (workOrders, { asc }) => [asc(workOrders.dueDate)],
  })

  // Filter out unassigned if technicianId is 'null'
  const filteredWorkOrders =
    technicianId === 'null' ? workOrders.filter((wo) => wo.assignedToId === null) : workOrders

  // Return work orders formatted for calendar display
  return filteredWorkOrders.map((wo) => ({
    id: wo.id,
    workOrderNumber: wo.workOrderNumber,
    title: wo.title,
    description: wo.description,
    status: wo.status,
    priority: wo.priority,
    dueDate: wo.dueDate,
    startedAt: wo.startedAt,
    completedAt: wo.completedAt,
    asset: wo.asset,
    assignee: wo.assignee,
  }))
})
