/**
 * List Custom Reports API (US-14.7)
 *
 * GET /api/reports/custom
 *
 * Returns list of custom reports for the current user
 * (own reports + shared reports from the organisation)
 */

import { and, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const customReports = await db.query.customReports.findMany({
    where: and(
      eq(schema.customReports.organisationId, session.user.organisationId),
      eq(schema.customReports.isArchived, false),
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
    orderBy: [desc(schema.customReports.updatedAt)],
  })

  return customReports
})
