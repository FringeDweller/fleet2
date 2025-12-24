import { z } from 'zod'
import { db, schema } from '../../utils/db'

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createCategorySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const [category] = await db
    .insert(schema.assetCategories)
    .values({
      organisationId: session.user.organisationId,
      name: result.data.name,
      description: result.data.description,
      parentId: result.data.parentId
    })
    .returning()

  return category
})
