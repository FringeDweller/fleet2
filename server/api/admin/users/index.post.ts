import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ROLES, type RoleName } from '../../../db/schema/roles'
import { hashPasswordArgon2 } from '../../../utils/auth'
import { db, schema } from '../../../utils/db'
import { isAdmin, requirePermission } from '../../../utils/permissions'

const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(50).nullable().optional(),
  roleId: z.string().uuid('Invalid role ID'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  isActive: z.boolean().default(true),
  sendWelcomeEmail: z.boolean().default(true),
})

/**
 * Create a new user in the current organisation
 * POST /api/admin/users
 * Requires admin permissions
 */
export default defineEventHandler(async (event) => {
  // Require users:write permission
  const currentUser = await requirePermission(event, 'users:write')

  // Additional check: must be admin to create users
  if (!isAdmin(currentUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    })
  }

  const body = await readBody(event)
  const result = createUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { email, firstName, lastName, phone, roleId, password, isActive, sendWelcomeEmail } =
    result.data

  // Check if email is already in use
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email already in use',
    })
  }

  // Verify the role exists and is valid
  const role = await db.query.roles.findFirst({
    where: eq(schema.roles.id, roleId),
  })

  if (!role) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid role ID',
    })
  }

  // Prevent non-super-admins from creating super admin users
  if (role.name === ROLES.SUPER_ADMIN && currentUser.roleName !== ROLES.SUPER_ADMIN) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only super admins can create super admin users',
    })
  }

  // Hash the password
  const passwordHash = await hashPasswordArgon2(password)

  // Create the user
  const [newUser] = await db
    .insert(schema.users)
    .values({
      organisationId: currentUser.organisationId,
      roleId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone: phone || null,
      isActive,
      emailVerified: false,
    })
    .returning()

  if (!newUser) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user',
    })
  }

  // Log the creation in audit log
  const headers = getHeaders(event)
  await db.insert(schema.auditLog).values({
    organisationId: currentUser.organisationId,
    userId: currentUser.id,
    action: 'create',
    entityType: 'user',
    entityId: newUser.id,
    oldValues: null,
    newValues: {
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      roleId: newUser.roleId,
      isActive: newUser.isActive,
    },
    ipAddress: headers['x-forwarded-for']?.split(',')[0] || headers['x-real-ip'] || null,
    userAgent: headers['user-agent'] || null,
  })

  // Send welcome email (mocked for now)
  if (sendWelcomeEmail) {
    // TODO: Implement actual email sending
    console.log(`[MOCK] Welcome email would be sent to ${newUser.email}`)
    console.log(`[MOCK] Email content:`)
    console.log(`  To: ${newUser.email}`)
    console.log(`  Subject: Welcome to Fleet Management`)
    console.log(`  Body: Your account has been created. Please set up your password.`)
  }

  // Create a notification for the new user
  await db.insert(schema.notifications).values({
    organisationId: currentUser.organisationId,
    userId: newUser.id,
    title: 'Welcome to Fleet Management',
    body: 'Your account has been created. Please complete your profile setup.',
    type: 'system',
    isRead: false,
  })

  return {
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      name: `${newUser.firstName} ${newUser.lastName}`,
      phone: newUser.phone,
      isActive: newUser.isActive,
      emailVerified: newUser.emailVerified,
      createdAt: newUser.createdAt,
      role: {
        id: role.id,
        name: role.name as RoleName,
        displayName: role.displayName,
      },
    },
    welcomeEmailSent: sendWelcomeEmail,
  }
})
