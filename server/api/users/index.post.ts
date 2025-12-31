import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { hashPasswordArgon2 } from '../../utils/auth'
import { db, schema } from '../../utils/db'
import { requirePermission } from '../../utils/permissions'

/**
 * Password strength requirements:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  roleId: z.string().uuid('Invalid role ID format'),
  phone: z.string().max(50).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  // Require users:write permission to create users (admin-level operation)
  const currentUser = await requirePermission(event, 'users:write')

  const body = await readBody(event)
  const result = createUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { email, password, firstName, lastName, roleId, phone } = result.data
  const normalizedEmail = email.toLowerCase()

  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, normalizedEmail),
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A user with this email already exists',
    })
  }

  // Verify role exists
  const role = await db.query.roles.findFirst({
    where: eq(schema.roles.id, roleId),
  })

  if (!role) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid role ID: role does not exist',
    })
  }

  // Hash password using Argon2
  const passwordHash = await hashPasswordArgon2(password)

  // Insert user into database
  const [newUser] = await db
    .insert(schema.users)
    .values({
      organisationId: currentUser.organisationId,
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      roleId,
      phone: phone ?? null,
      isActive: true,
      emailVerified: false,
      failedLoginAttempts: 0,
    })
    .returning({
      id: schema.users.id,
      organisationId: schema.users.organisationId,
      roleId: schema.users.roleId,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      avatarUrl: schema.users.avatarUrl,
      hourlyRate: schema.users.hourlyRate,
      isActive: schema.users.isActive,
      emailVerified: schema.users.emailVerified,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    })

  if (!newUser) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user',
    })
  }

  // Log the creation in audit log
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'create',
    entityType: 'user',
    entityId: newUser.id,
    newValues: {
      ...newUser,
      roleName: role.name,
    },
  })

  // Set 201 Created status
  setResponseStatus(event, 201)

  // Return created user with role info (without sensitive fields)
  return {
    ...newUser,
    roleName: role.name,
    roleDisplayName: role.displayName,
  }
})
