import { and, eq, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const updateAssignmentSchema = z.object({
  formId: z.string().uuid('Invalid form ID').optional(),
  targetType: z
    .enum(['asset', 'work_order', 'inspection', 'operator'], {
      message: 'Invalid target type',
    })
    .optional(),
  categoryFilterId: z.string().uuid().optional().nullable(),
  isRequired: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment ID is required',
    })
  }

  const body = await readBody(event)
  const result = updateAssignmentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Fetch existing assignment
  const existingAssignment = await db.query.customFormAssignments.findFirst({
    where: and(
      eq(schema.customFormAssignments.id, id),
      eq(schema.customFormAssignments.organisationId, user.organisationId),
    ),
  })

  if (!existingAssignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Form assignment not found',
    })
  }

  // Verify the form exists if being updated
  if (result.data.formId) {
    const form = await db.query.customForms.findFirst({
      where: and(
        eq(schema.customForms.id, result.data.formId),
        eq(schema.customForms.organisationId, user.organisationId),
      ),
    })

    if (!form) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Form not found',
      })
    }
  }

  // Verify the category exists if being updated
  if (result.data.categoryFilterId) {
    const category = await db.query.assetCategories.findFirst({
      where: and(
        eq(schema.assetCategories.id, result.data.categoryFilterId),
        eq(schema.assetCategories.organisationId, user.organisationId),
      ),
    })

    if (!category) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Category not found',
      })
    }
  }

  // Check for duplicate assignment if form, target type, or category are changing
  const newFormId = result.data.formId ?? existingAssignment.formId
  const newTargetType = result.data.targetType ?? existingAssignment.targetType
  const newCategoryFilterId =
    result.data.categoryFilterId === undefined
      ? existingAssignment.categoryFilterId
      : result.data.categoryFilterId

  if (
    newFormId !== existingAssignment.formId ||
    newTargetType !== existingAssignment.targetType ||
    newCategoryFilterId !== existingAssignment.categoryFilterId
  ) {
    const duplicateConditions = [
      eq(schema.customFormAssignments.organisationId, user.organisationId),
      eq(schema.customFormAssignments.formId, newFormId),
      eq(schema.customFormAssignments.targetType, newTargetType),
      ne(schema.customFormAssignments.id, id),
    ]

    if (newCategoryFilterId) {
      duplicateConditions.push(
        eq(schema.customFormAssignments.categoryFilterId, newCategoryFilterId),
      )
    } else {
      duplicateConditions.push(isNull(schema.customFormAssignments.categoryFilterId))
    }

    const existingDuplicate = await db.query.customFormAssignments.findFirst({
      where: and(...duplicateConditions),
    })

    if (existingDuplicate) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'This form is already assigned to this target type with the same category filter',
      })
    }
  }

  // Build update values
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (result.data.formId !== undefined) {
    updateValues.formId = result.data.formId
  }
  if (result.data.targetType !== undefined) {
    updateValues.targetType = result.data.targetType
  }
  if (result.data.categoryFilterId !== undefined) {
    updateValues.categoryFilterId = result.data.categoryFilterId
  }
  if (result.data.isRequired !== undefined) {
    updateValues.isRequired = result.data.isRequired
  }
  if (result.data.position !== undefined) {
    updateValues.position = result.data.position
  }

  const [updatedAssignment] = await db
    .update(schema.customFormAssignments)
    .set(updateValues)
    .where(
      and(
        eq(schema.customFormAssignments.id, id),
        eq(schema.customFormAssignments.organisationId, user.organisationId),
      ),
    )
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entityType: 'custom_form_assignment',
    entityId: id,
    oldValues: existingAssignment,
    newValues: updatedAssignment,
  })

  // Return updated assignment with relations
  const assignmentWithRelations = await db.query.customFormAssignments.findFirst({
    where: eq(schema.customFormAssignments.id, id),
    with: {
      form: {
        columns: {
          id: true,
          name: true,
          status: true,
        },
      },
      categoryFilter: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  })

  return assignmentWithRelations
})
