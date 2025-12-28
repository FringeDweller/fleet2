import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { db, schema } from '../../utils/db'

/**
 * Get custom forms assigned to a specific entity
 *
 * Query params:
 * - type: 'asset' | 'work_order' | 'inspection' | 'operator' (required)
 * - id: Entity ID (required for asset and work_order to determine category)
 *
 * For assets/work_orders: Returns forms that either:
 * - Have no category filter (apply to all)
 * - Have a category filter matching the entity's category
 *
 * For inspections/operators: Returns all forms assigned to that type
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const type = query.type as string
  const entityId = query.id as string | undefined

  if (!type || !['asset', 'work_order', 'inspection', 'operator'].includes(type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid type parameter is required (asset, work_order, inspection, operator)',
    })
  }

  const targetType = type as 'asset' | 'work_order' | 'inspection' | 'operator'

  // For asset and work_order, we need to determine the category
  let categoryId: string | null = null

  if (targetType === 'asset' && entityId) {
    const asset = await db.query.assets.findFirst({
      where: and(
        eq(schema.assets.id, entityId),
        eq(schema.assets.organisationId, session.user.organisationId),
      ),
      columns: {
        categoryId: true,
      },
    })

    if (asset) {
      categoryId = asset.categoryId
    }
  } else if (targetType === 'work_order' && entityId) {
    // Get the work order and its associated asset's category
    const workOrder = await db.query.workOrders.findFirst({
      where: and(
        eq(schema.workOrders.id, entityId),
        eq(schema.workOrders.organisationId, session.user.organisationId),
      ),
      with: {
        asset: {
          columns: {
            categoryId: true,
          },
        },
      },
    })

    if (workOrder?.asset) {
      categoryId = workOrder.asset.categoryId
    }
  }

  // Build the query conditions
  const baseConditions = [
    eq(schema.customFormAssignments.organisationId, session.user.organisationId),
    eq(schema.customFormAssignments.targetType, targetType),
  ]

  let categoryCondition
  if (categoryId) {
    // Return assignments with no category filter OR matching category filter
    categoryCondition = or(
      isNull(schema.customFormAssignments.categoryFilterId),
      eq(schema.customFormAssignments.categoryFilterId, categoryId),
    )
  } else {
    // No category specified, only return assignments with no category filter
    categoryCondition = isNull(schema.customFormAssignments.categoryFilterId)
  }

  const whereClause = and(...baseConditions, categoryCondition)

  const assignments = await db.query.customFormAssignments.findMany({
    where: whereClause,
    with: {
      form: {
        columns: {
          id: true,
          name: true,
          description: true,
          status: true,
          fields: true,
          settings: true,
        },
      },
      categoryFilter: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [asc(schema.customFormAssignments.position)],
  })

  // Filter out archived forms and draft forms (unless they are required)
  const activeAssignments = assignments.filter(
    (assignment) =>
      assignment.form?.status === 'active' ||
      (assignment.form?.status === 'draft' && assignment.isRequired),
  )

  return {
    data: activeAssignments.map((assignment) => ({
      id: assignment.id,
      form: assignment.form,
      isRequired: assignment.isRequired,
      position: assignment.position,
      categoryFilter: assignment.categoryFilter,
    })),
  }
})
