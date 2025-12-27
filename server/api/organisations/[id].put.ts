import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { isSuperAdmin, requireAuth, requirePermission } from '../../utils/permissions'

const updateOrganisationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
  isActive: z.boolean().optional(),
  preventNegativeStock: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const orgId = getRouterParam(event, 'id')

  if (!orgId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Organisation ID is required',
    })
  }

  // Regular users can only update their own organisation with settings:write
  // Super admins can update any organisation
  if (orgId === user.organisationId) {
    await requirePermission(event, 'settings:write')
  } else if (!isSuperAdmin(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Cannot update other organisations',
    })
  }

  const body = await readBody(event)
  const result = updateOrganisationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Get current organisation
  const currentOrg = await db.query.organisations.findFirst({
    where: eq(schema.organisations.id, orgId),
  })

  if (!currentOrg) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organisation not found',
    })
  }

  const updates = result.data

  // Only super admins can change slug or isActive
  if (!isSuperAdmin(user)) {
    delete updates.slug
    delete updates.isActive
  }

  // Check for slug uniqueness if changing
  if (updates.slug && updates.slug !== currentOrg.slug) {
    const existing = await db.query.organisations.findFirst({
      where: eq(schema.organisations.slug, updates.slug),
    })
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Organisation slug already exists',
      })
    }
  }

  // Update organisation
  const [updatedOrg] = await db
    .update(schema.organisations)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(schema.organisations.id, orgId))
    .returning()

  if (!updatedOrg) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update organisation',
    })
  }

  // Log update in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: orgId,
    userId: user.id,
    action: 'update',
    entityType: 'organisation',
    entityId: orgId,
    oldValues: currentOrg,
    newValues: updates,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return updatedOrg
})
