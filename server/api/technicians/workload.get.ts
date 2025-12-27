import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // First get the technician role ID
  const technicianRole = await db.query.roles.findFirst({
    where: eq(schema.roles.name, 'Technician'),
    columns: { id: true },
  })

  if (!technicianRole) {
    return []
  }

  // Get all technicians in the organisation
  const technicians = await db.query.users.findMany({
    where: and(
      eq(schema.users.organisationId, session.user.organisationId),
      eq(schema.users.isActive, true),
      eq(schema.users.roleId, technicianRole.id),
    ),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  })

  // Get work order counts by technician
  const activeStatuses = ['open', 'in_progress', 'pending_parts'] as const
  const technicianIds = technicians.map((t) => t.id)

  if (technicianIds.length === 0) {
    return []
  }

  // Get counts per technician
  const workloadCounts = await db
    .select({
      assignedToId: schema.workOrders.assignedToId,
      status: schema.workOrders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, session.user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, activeStatuses),
        inArray(schema.workOrders.assignedToId, technicianIds),
      ),
    )
    .groupBy(schema.workOrders.assignedToId, schema.workOrders.status)

  // Get overdue counts per technician
  const overdueCounts = await db
    .select({
      assignedToId: schema.workOrders.assignedToId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.organisationId, session.user.organisationId),
        eq(schema.workOrders.isArchived, false),
        inArray(schema.workOrders.status, activeStatuses),
        inArray(schema.workOrders.assignedToId, technicianIds),
        sql`${schema.workOrders.dueDate} < now()`,
      ),
    )
    .groupBy(schema.workOrders.assignedToId)

  // Build workload map
  const workloadMap = new Map<
    string,
    {
      open: number
      in_progress: number
      pending_parts: number
      overdue: number
      total: number
    }
  >()

  for (const row of workloadCounts) {
    if (!row.assignedToId) continue
    if (!workloadMap.has(row.assignedToId)) {
      workloadMap.set(row.assignedToId, {
        open: 0,
        in_progress: 0,
        pending_parts: 0,
        overdue: 0,
        total: 0,
      })
    }
    const entry = workloadMap.get(row.assignedToId)!
    const status = row.status as keyof typeof entry
    if (status in entry) {
      entry[status] = row.count
      entry.total += row.count
    }
  }

  for (const row of overdueCounts) {
    if (!row.assignedToId) continue
    const entry = workloadMap.get(row.assignedToId)
    if (entry) {
      entry.overdue = row.count
    }
  }

  // Build response
  return technicians.map((tech) => ({
    ...tech,
    workload: workloadMap.get(tech.id) || {
      open: 0,
      in_progress: 0,
      pending_parts: 0,
      overdue: 0,
      total: 0,
    },
  }))
})
