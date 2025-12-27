import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireSuperAdmin } from '../../utils/permissions'

const createOrganisationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
  preventNegativeStock: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  // Only super admins can create organisations
  const user = await requireSuperAdmin(event)

  const body = await readBody(event)
  const result = createOrganisationSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  // Check for slug uniqueness
  const existing = await db.query.organisations.findFirst({
    where: eq(schema.organisations.slug, result.data.slug),
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Organisation slug already exists',
    })
  }

  // Create organisation
  const [organisation] = await db
    .insert(schema.organisations)
    .values({
      name: result.data.name,
      slug: result.data.slug,
      description: result.data.description,
      logoUrl: result.data.logoUrl,
      primaryColor: result.data.primaryColor || '#0066cc',
      preventNegativeStock: result.data.preventNegativeStock || false,
    })
    .returning()

  if (!organisation) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create organisation',
    })
  }

  // Log creation in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: organisation.id,
    userId: user.id,
    action: 'create',
    entityType: 'organisation',
    entityId: organisation.id,
    newValues: organisation,
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return organisation
})
