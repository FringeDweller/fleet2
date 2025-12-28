import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'

const createAssignmentSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  targetType: z.enum(['asset', 'work_order', 'inspection', 'operator'], {
    message: 'Invalid target type',
  }),
  categoryFilterId: z.string().uuid().optional().nullable(),
  isRequired: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
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

  const body = await readBody(event)
  const result = createAssignmentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify the form exists and belongs to this organisation
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

  // Verify the category exists if provided
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

  // Check for duplicate assignment (same form, target type, and category)
  const duplicateConditions = [
    eq(schema.customFormAssignments.organisationId, user.organisationId),
    eq(schema.customFormAssignments.formId, result.data.formId),
    eq(schema.customFormAssignments.targetType, result.data.targetType),
  ]

  if (result.data.categoryFilterId) {
    duplicateConditions.push(
      eq(schema.customFormAssignments.categoryFilterId, result.data.categoryFilterId),
    )
  } else {
    duplicateConditions.push(isNull(schema.customFormAssignments.categoryFilterId))
  }

  const existingAssignment = await db.query.customFormAssignments.findFirst({
    where: and(...duplicateConditions),
  })

  if (existingAssignment) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'This form is already assigned to this target type with the same category filter',
    })
  }

  // If no position specified, get the next available position
  let position = result.data.position
  if (position === 0) {
    const maxPositionResult = await db
      .select({
        maxPosition: sql<number>`COALESCE(MAX(${schema.customFormAssignments.position}), -1)`,
      })
      .from(schema.customFormAssignments)
      .where(
        and(
          eq(schema.customFormAssignments.organisationId, user.organisationId),
          eq(schema.customFormAssignments.targetType, result.data.targetType),
        ),
      )
    position = (maxPositionResult[0]?.maxPosition ?? -1) + 1
  }

  // Create the assignment
  const [assignment] = await db
    .insert(schema.customFormAssignments)
    .values({
      organisationId: user.organisationId,
      formId: result.data.formId,
      targetType: result.data.targetType,
      categoryFilterId: result.data.categoryFilterId ?? null,
      isRequired: result.data.isRequired,
      position,
      createdById: user.id,
    })
    .returning()

  // Log audit entry
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entityType: 'custom_form_assignment',
    entityId: assignment!.id,
    newValues: assignment,
  })

  // Return assignment with relations
  const assignmentWithRelations = await db.query.customFormAssignments.findFirst({
    where: eq(schema.customFormAssignments.id, assignment!.id),
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
