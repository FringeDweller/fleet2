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
  const partId = getRouterParam(event, 'partId')

  if (!templateId || !partId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID and Part ID are required',
    })
  }

  // Verify template exists and belongs to organisation
  const template = await db.query.taskTemplates.findFirst({
    where: and(
      eq(schema.taskTemplates.id, templateId),
      eq(schema.taskTemplates.organisationId, session.user.organisationId),
    ),
    columns: { id: true, name: true },
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found',
    })
  }

  // Get existing template part
  const existingPart = await db.query.taskTemplateParts.findFirst({
    where: and(
      eq(schema.taskTemplateParts.id, partId),
      eq(schema.taskTemplateParts.templateId, templateId),
    ),
    with: {
      part: {
        columns: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  })

  if (!existingPart) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template part not found',
    })
  }

  // Delete the template part
  await db.delete(schema.taskTemplateParts).where(eq(schema.taskTemplateParts.id, partId))

  // Log the action
  await db.insert(schema.auditLog).values({
    organisationId: session.user.organisationId,
    userId: session.user.id,
    action: 'delete',
    entityType: 'task_template_part',
    entityId: partId,
    oldValues: {
      templateId,
      templateName: template.name,
      partId: existingPart.part.id,
      partName: existingPart.part.name,
      quantity: existingPart.quantity,
    },
  })

  return { success: true }
})
