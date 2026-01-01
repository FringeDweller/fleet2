import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

// List of all available permissions in the system
const AVAILABLE_PERMISSIONS = [
  'assets:read',
  'assets:write',
  'assets:delete',
  'work_orders:read',
  'work_orders:write',
  'work_orders:delete',
  'reports:read',
  'reports:write',
  'users:read',
  'users:write',
  'users:delete',
  'settings:read',
  'settings:write',
  'parts:read',
  'parts:write',
  'parts:delete',
  'maintenance:read',
  'maintenance:write',
  'maintenance:delete',
  'organisations:read',
  'organisations:write',
  'organisations:delete',
] as const

const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be 50 characters or less')
    .regex(/^[a-z_]+$/, 'Name must be lowercase with underscores only'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  permissions: z.array(z.string()).default([]),
})

/**
 * Create a new role
 * POST /api/admin/roles
 * Requires admin permissions
 */
export default defineEventHandler(async (event) => {
  // Require users:write permission
  const currentUser = await requirePermission(event, 'users:write')

  // Additional check: must be admin to create roles
  if (!isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    })
  }

  const body = await readBody(event)
  const result = createRoleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { name, displayName, description, permissions } = result.data

  // Validate permissions - filter out invalid ones
  const validPermissions = permissions.filter(
    (p) =>
      AVAILABLE_PERMISSIONS.includes(p as (typeof AVAILABLE_PERMISSIONS)[number]) ||
      p === '*' ||
      p === '**',
  )

  // Prevent non-super-admins from creating roles with super admin permissions
  if (validPermissions.includes('**') && currentUser.roleName !== 'super_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only super admins can create roles with cross-tenant access',
    })
  }

  // Prevent non-super-admins from creating roles with wildcard permissions
  if (validPermissions.includes('*') && currentUser.roleName !== 'super_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only super admins can create roles with full admin permissions',
    })
  }

  // Check if role name already exists
  const existingRole = await db.query.roles.findFirst({
    where: eq(schema.roles.name, name),
  })

  if (existingRole) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A role with this name already exists',
    })
  }

  // Create the role
  const [newRole] = await db
    .insert(schema.roles)
    .values({
      name,
      displayName,
      description: description || null,
      permissions: validPermissions,
    })
    .returning()

  if (!newRole) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create role',
    })
  }

  // Log the creation in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'create',
    entityType: 'role',
    entityId: newRole.id,
    oldValues: null,
    newValues: {
      name: newRole.name,
      displayName: newRole.displayName,
      description: newRole.description,
      permissions: newRole.permissions,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  return {
    success: true,
    role: {
      id: newRole.id,
      name: newRole.name,
      displayName: newRole.displayName,
      description: newRole.description,
      permissions: newRole.permissions,
      createdAt: newRole.createdAt,
      updatedAt: newRole.updatedAt,
    },
  }
})
