/**
 * List scheduled exports (US-17.7)
 *
 * GET /api/admin/export/scheduled - Get all scheduled exports for the organisation
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const exports = await db.query.scheduledExports.findMany({
    where: eq(schema.scheduledExports.organisationId, session.user.organisationId),
    with: {
      createdBy: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: (scheduledExports, { desc }) => [desc(scheduledExports.createdAt)],
  })

  return exports
})
