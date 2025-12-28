import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const templateId = getRouterParam(event, 'id')

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required',
    })
  }

  // Verify the template exists and belongs to the organization
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, templateId),
      eq(schema.taskTemplates.organisationId, session.user.organisationId),
    ),
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Fetch all overrides for this template
  const overrides = await db.query.taskOverrides.findMany({
    where: and(
      eq(schema.taskOverrides.taskTemplateId, templateId),
      eq(schema.taskOverrides.organisationId, session.user.organisationId),
    ),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      category: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: (taskOverrides, { desc }) => [desc(taskOverrides.createdAt)],
  })

  return overrides
})
