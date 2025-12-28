import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'

const photoSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  caption: z.string().optional(),
  takenAt: z.string(),
})

const itemResponseSchema = z.object({
  checklistItemId: z.string().min(1),
  result: z.enum(['pass', 'fail', 'na']),
  numericValue: z.number().optional(),
  textValue: z.string().optional(),
  photos: z.array(photoSchema).optional(),
  signature: z.string().optional(), // Base64 encoded
  notes: z.string().optional(),
})

const submitItemsSchema = z.object({
  items: z.array(itemResponseSchema).min(1),
  // Mark inspection as complete if all items are submitted
  complete: z.boolean().default(false),
  // Overall notes for the inspection
  notes: z.string().optional(),
  // Overall result (pass/fail) - computed from items if not provided
  overallResult: z.string().max(50).optional(),
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
  const inspectionId = getRouterParam(event, 'id')

  if (!inspectionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Inspection ID is required',
    })
  }

  const body = await readBody(event)
  const result = submitItemsSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Verify inspection exists and belongs to organisation
  const inspection = await db.query.inspections.findFirst({
    where: and(
      eq(schema.inspections.id, inspectionId),
      eq(schema.inspections.organisationId, user.organisationId),
    ),
  })

  if (!inspection) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Inspection not found',
    })
  }

  // Check if inspection is still in progress
  if (inspection.status !== 'in_progress') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot update items for inspection with status: ${inspection.status}`,
    })
  }

  // Get existing items for this inspection
  const existingItems = await db.query.inspectionItems.findMany({
    where: eq(schema.inspectionItems.inspectionId, inspectionId),
  })

  const existingItemMap = new Map(existingItems.map((item) => [item.checklistItemId, item]))

  // Validate all submitted items exist in the inspection
  const submittedIds = result.data.items.map((item) => item.checklistItemId)
  const invalidIds = submittedIds.filter((id) => !existingItemMap.has(id))

  if (invalidIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid checklist item IDs: ${invalidIds.join(', ')}`,
    })
  }

  const now = new Date()

  // Update inspection items in a transaction
  const updatedInspection = await db.transaction(async (tx) => {
    // Update each item
    for (const itemResponse of result.data.items) {
      const existingItem = existingItemMap.get(itemResponse.checklistItemId)

      if (existingItem) {
        await tx
          .update(schema.inspectionItems)
          .set({
            result: itemResponse.result,
            numericValue: itemResponse.numericValue?.toString(),
            textValue: itemResponse.textValue,
            photos: itemResponse.photos || [],
            signature: itemResponse.signature,
            notes: itemResponse.notes,
            respondedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.inspectionItems.id, existingItem.id))
      }
    }

    // If marking as complete, update inspection status
    if (result.data.complete) {
      // Calculate overall result if not provided
      let overallResult = result.data.overallResult

      if (!overallResult) {
        // Get all items to determine overall result
        const allItems = await tx.query.inspectionItems.findMany({
          where: eq(schema.inspectionItems.inspectionId, inspectionId),
        })

        const hasFailures = allItems.some((item) => item.result === 'fail')
        const hasPending = allItems.some((item) => item.result === 'pending')

        if (hasPending) {
          overallResult = 'incomplete'
        } else if (hasFailures) {
          overallResult = 'fail'
        } else {
          overallResult = 'pass'
        }
      }

      await tx
        .update(schema.inspections)
        .set({
          status: 'completed',
          completedAt: now,
          notes: result.data.notes,
          overallResult,
          updatedAt: now,
        })
        .where(eq(schema.inspections.id, inspectionId))
    } else if (result.data.notes) {
      // Just update notes
      await tx
        .update(schema.inspections)
        .set({
          notes: result.data.notes,
          updatedAt: now,
        })
        .where(eq(schema.inspections.id, inspectionId))
    }

    // Log audit entry
    await tx.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entityType: 'inspection',
      entityId: inspectionId,
      newValues: {
        itemsUpdated: result.data.items.length,
        completed: result.data.complete,
      },
    })

    // Return updated inspection
    return tx.query.inspections.findFirst({
      where: eq(schema.inspections.id, inspectionId),
      with: {
        items: true,
      },
    })
  })

  return updatedInspection
})
