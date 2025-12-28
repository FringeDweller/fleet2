import { and, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const assetId = query.assetId as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const groupBy = (query.groupBy as string) || 'asset' // 'asset', 'month', 'assignee'

  const conditions = [
    eq(schema.workOrders.organisationId, session.user.organisationId),
    eq(schema.workOrders.status, 'completed'),
  ]

  if (assetId) {
    conditions.push(eq(schema.workOrders.assetId, assetId))
  }

  if (dateFrom) {
    conditions.push(gte(schema.workOrders.completedAt, new Date(dateFrom)))
  }

  if (dateTo) {
    conditions.push(lte(schema.workOrders.completedAt, new Date(dateTo)))
  }

  const whereClause = and(...conditions)

  // Get overall summary
  const summaryResult = await db
    .select({
      totalLaborCost: sum(schema.workOrders.laborCost),
      totalPartsCost: sum(schema.workOrders.partsCost),
      totalCost: sum(schema.workOrders.totalCost),
      workOrderCount: sql<number>`count(*)::int`,
    })
    .from(schema.workOrders)
    .where(whereClause)

  const summary = {
    totalLaborCost: Number.parseFloat(summaryResult[0]?.totalLaborCost || '0'),
    totalPartsCost: Number.parseFloat(summaryResult[0]?.totalPartsCost || '0'),
    totalCost: Number.parseFloat(summaryResult[0]?.totalCost || '0'),
    workOrderCount: summaryResult[0]?.workOrderCount || 0,
  }

  // Group by the requested dimension
  interface BreakdownRow {
    id: string
    name: string
    laborCost: number
    partsCost: number
    totalCost: number
    workOrderCount: number
  }

  let breakdown: BreakdownRow[] = []

  if (groupBy === 'asset') {
    const assetCosts = await db
      .select({
        assetId: schema.workOrders.assetId,
        assetNumber: schema.assets.assetNumber,
        make: schema.assets.make,
        model: schema.assets.model,
        laborCost: sum(schema.workOrders.laborCost),
        partsCost: sum(schema.workOrders.partsCost),
        totalCost: sum(schema.workOrders.totalCost),
        workOrderCount: sql<number>`count(*)::int`,
      })
      .from(schema.workOrders)
      .leftJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
      .where(whereClause)
      .groupBy(
        schema.workOrders.assetId,
        schema.assets.assetNumber,
        schema.assets.make,
        schema.assets.model,
      )
      .orderBy(desc(sum(schema.workOrders.totalCost)))

    breakdown = assetCosts.map((row) => {
      const nameParts = [row.assetNumber]
      if (row.make) nameParts.push(` - ${row.make}`)
      if (row.model) nameParts.push(` ${row.model}`)
      return {
        id: row.assetId,
        name: nameParts.join(''),
        laborCost: Number.parseFloat(row.laborCost || '0'),
        partsCost: Number.parseFloat(row.partsCost || '0'),
        totalCost: Number.parseFloat(row.totalCost || '0'),
        workOrderCount: row.workOrderCount,
      }
    })
  } else if (groupBy === 'month') {
    const monthlyCosts = await db
      .select({
        month: sql<string>`to_char(${schema.workOrders.completedAt}, 'YYYY-MM')`,
        laborCost: sum(schema.workOrders.laborCost),
        partsCost: sum(schema.workOrders.partsCost),
        totalCost: sum(schema.workOrders.totalCost),
        workOrderCount: sql<number>`count(*)::int`,
      })
      .from(schema.workOrders)
      .where(whereClause)
      .groupBy(sql`to_char(${schema.workOrders.completedAt}, 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(${schema.workOrders.completedAt}, 'YYYY-MM')`))

    breakdown = monthlyCosts.map((row) => ({
      id: row.month!,
      name: row.month!,
      laborCost: Number.parseFloat(row.laborCost || '0'),
      partsCost: Number.parseFloat(row.partsCost || '0'),
      totalCost: Number.parseFloat(row.totalCost || '0'),
      workOrderCount: row.workOrderCount,
    }))
  } else if (groupBy === 'assignee') {
    const assigneeCosts = await db
      .select({
        userId: schema.workOrders.assignedToId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        laborCost: sum(schema.workOrders.laborCost),
        partsCost: sum(schema.workOrders.partsCost),
        totalCost: sum(schema.workOrders.totalCost),
        workOrderCount: sql<number>`count(*)::int`,
      })
      .from(schema.workOrders)
      .leftJoin(schema.users, eq(schema.workOrders.assignedToId, schema.users.id))
      .where(whereClause)
      .groupBy(schema.workOrders.assignedToId, schema.users.firstName, schema.users.lastName)
      .orderBy(desc(sum(schema.workOrders.totalCost)))

    breakdown = assigneeCosts.map((row) => ({
      id: row.userId || 'unassigned',
      name: row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : 'Unassigned',
      laborCost: Number.parseFloat(row.laborCost || '0'),
      partsCost: Number.parseFloat(row.partsCost || '0'),
      totalCost: Number.parseFloat(row.totalCost || '0'),
      workOrderCount: row.workOrderCount,
    }))
  }

  // Get recent completed work orders with costs
  const recentWorkOrders = await db.query.workOrders.findMany({
    where: whereClause,
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
        },
      },
    },
    orderBy: (wo, { desc }) => [desc(wo.completedAt)],
    limit: 20,
  })

  return {
    summary,
    breakdown,
    recentWorkOrders,
  }
})
