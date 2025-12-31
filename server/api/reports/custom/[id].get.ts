/**
 * Get Custom Report API (US-14.7)
 *
 * GET /api/reports/custom/:id
 *
 * Returns a specific custom report by ID
 */

import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Report ID is required',
    })
  }

  const customReport = await db.query.customReports.findFirst({
    where: and(
      eq(schema.customReports.id, id),
      eq(schema.customReports.organisationId, session.user.organisationId),
      or(eq(schema.customReports.userId, session.user.id), eq(schema.customReports.isShared, true)),
    ),
    with: {
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  if (!customReport) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Custom report not found',
    })
  }

  return customReport
})
