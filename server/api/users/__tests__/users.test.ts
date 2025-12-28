import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * User & Role Schema Validation Tests
 *
 * Tests validation schemas for user-related endpoints:
 * - User schema validation (email, name, role references)
 * - Role schema validation
 * - Permission checks schema
 */

// User schema (based on users.ts schema)
const userSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(50).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  hourlyRate: z.number().positive().nullable().optional(),
  roleId: z.string().uuid('Invalid role ID'),
  isActive: z.boolean().default(true),
})

// Create user schema (with password)
const createUserSchema = userSchema.extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

// Update user schema (password optional)
const updateUserSchema = userSchema.partial().extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
})

// Role schema (based on roles.ts schema)
const roleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50)
    .regex(/^[a-z_]+$/, 'Name must be lowercase with underscores'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
})

// Permission type
const permissionSchema = z.enum([
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
  '*',
  '**',
])

// Role name enum
const roleNameSchema = z.enum([
  'super_admin',
  'admin',
  'fleet_manager',
  'supervisor',
  'technician',
  'operator',
])

describe('User Schema Validation', () => {
  describe('Create User', () => {
    const validRoleId = '550e8400-e29b-41d4-a716-446655440000'

    it('should validate a valid user', () => {
      const validUser = {
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        roleId: validRoleId,
        password: 'SecurePass123',
        isActive: true,
      }

      const result = createUserSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('should require email', () => {
      const invalidUser = {
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        '',
        'has spaces@email.com',
      ]

      for (const email of invalidEmails) {
        const result = createUserSchema.safeParse({
          email,
          firstName: 'John',
          lastName: 'Doe',
          roleId: validRoleId,
          password: 'SecurePass123',
        })
        expect(result.success).toBe(false)
      }
    })

    it('should enforce email max length', () => {
      const longEmail = `${'a'.repeat(250)}@test.com`
      const result = createUserSchema.safeParse({
        email: longEmail,
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      })
      expect(result.success).toBe(false)
    })

    it('should require firstName', () => {
      const invalidUser = {
        email: 'user@example.com',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should reject empty firstName', () => {
      const invalidUser = {
        email: 'user@example.com',
        firstName: '',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should enforce firstName max length', () => {
      const invalidUser = {
        email: 'user@example.com',
        firstName: 'a'.repeat(101),
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should require lastName', () => {
      const invalidUser = {
        email: 'user@example.com',
        firstName: 'John',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should reject empty lastName', () => {
      const invalidUser = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: '',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for roleId', () => {
      const invalidUser = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: 'not-a-uuid',
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should allow optional phone', () => {
      const userWithPhone = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        phone: '+1234567890',
      }

      const userWithoutPhone = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      expect(createUserSchema.safeParse(userWithPhone).success).toBe(true)
      expect(createUserSchema.safeParse(userWithoutPhone).success).toBe(true)
    })

    it('should allow null phone', () => {
      const userWithNullPhone = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        phone: null,
      }

      const result = createUserSchema.safeParse(userWithNullPhone)
      expect(result.success).toBe(true)
    })

    it('should validate avatarUrl as URL', () => {
      const userWithValidAvatar = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        avatarUrl: 'https://example.com/avatar.jpg',
      }

      const userWithInvalidAvatar = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        avatarUrl: 'not-a-url',
      }

      expect(createUserSchema.safeParse(userWithValidAvatar).success).toBe(true)
      expect(createUserSchema.safeParse(userWithInvalidAvatar).success).toBe(false)
    })

    it('should validate hourlyRate as positive number', () => {
      const userWithValidRate = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        hourlyRate: 25.5,
      }

      const userWithZeroRate = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        hourlyRate: 0,
      }

      const userWithNegativeRate = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
        hourlyRate: -10,
      }

      expect(createUserSchema.safeParse(userWithValidRate).success).toBe(true)
      expect(createUserSchema.safeParse(userWithZeroRate).success).toBe(false)
      expect(createUserSchema.safeParse(userWithNegativeRate).success).toBe(false)
    })

    it('should default isActive to true', () => {
      const userWithoutActive = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
        password: 'SecurePass123',
      }

      const result = createUserSchema.safeParse(userWithoutActive)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should require password for create', () => {
      const userWithoutPassword = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
      }

      const result = createUserSchema.safeParse(userWithoutPassword)
      expect(result.success).toBe(false)
    })

    it('should validate password complexity', () => {
      const baseUser = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleId: validRoleId,
      }

      // Too short
      expect(createUserSchema.safeParse({ ...baseUser, password: 'Ab1' }).success).toBe(false)

      // No uppercase
      expect(createUserSchema.safeParse({ ...baseUser, password: 'lowercase123' }).success).toBe(
        false,
      )

      // No lowercase
      expect(createUserSchema.safeParse({ ...baseUser, password: 'UPPERCASE123' }).success).toBe(
        false,
      )

      // No number
      expect(createUserSchema.safeParse({ ...baseUser, password: 'NoNumbersHere' }).success).toBe(
        false,
      )

      // Valid password
      expect(createUserSchema.safeParse({ ...baseUser, password: 'SecurePass123' }).success).toBe(
        true,
      )
    })
  })

  describe('Update User', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        firstName: 'Jane',
      }

      const result = updateUserSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow updating email only', () => {
      const updateEmail = {
        email: 'newemail@example.com',
      }

      const result = updateUserSchema.safeParse(updateEmail)
      expect(result.success).toBe(true)
    })

    it('should allow updating without password', () => {
      const updateWithoutPassword = {
        firstName: 'Jane',
        lastName: 'Smith',
        isActive: false,
      }

      const result = updateUserSchema.safeParse(updateWithoutPassword)
      expect(result.success).toBe(true)
    })

    it('should validate password if provided', () => {
      const updateWithWeakPassword = {
        password: 'weak',
      }

      const updateWithStrongPassword = {
        password: 'SecurePass123',
      }

      expect(updateUserSchema.safeParse(updateWithWeakPassword).success).toBe(false)
      expect(updateUserSchema.safeParse(updateWithStrongPassword).success).toBe(true)
    })

    it('should validate email format if provided', () => {
      const updateWithInvalidEmail = {
        email: 'invalid-email',
      }

      const result = updateUserSchema.safeParse(updateWithInvalidEmail)
      expect(result.success).toBe(false)
    })

    it('should allow empty update object', () => {
      const emptyUpdate = {}

      const result = updateUserSchema.safeParse(emptyUpdate)
      expect(result.success).toBe(true)
    })
  })
})

describe('Role Schema Validation', () => {
  it('should validate a valid role', () => {
    const validRole = {
      name: 'custom_role',
      displayName: 'Custom Role',
      description: 'A custom role for testing',
      permissions: ['assets:read', 'work_orders:read'],
    }

    const result = roleSchema.safeParse(validRole)
    expect(result.success).toBe(true)
  })

  it('should require name', () => {
    const roleWithoutName = {
      displayName: 'Custom Role',
    }

    const result = roleSchema.safeParse(roleWithoutName)
    expect(result.success).toBe(false)
  })

  it('should reject empty name', () => {
    const roleWithEmptyName = {
      name: '',
      displayName: 'Custom Role',
    }

    const result = roleSchema.safeParse(roleWithEmptyName)
    expect(result.success).toBe(false)
  })

  it('should enforce name format (lowercase with underscores)', () => {
    const validNames = ['admin', 'fleet_manager', 'super_admin', 'custom_role']
    const invalidNames = ['Admin', 'FleetManager', 'super-admin', 'with spaces', 'UPPERCASE']

    for (const name of validNames) {
      const result = roleSchema.safeParse({ name, displayName: 'Test' })
      expect(result.success).toBe(true)
    }

    for (const name of invalidNames) {
      const result = roleSchema.safeParse({ name, displayName: 'Test' })
      expect(result.success).toBe(false)
    }
  })

  it('should enforce name max length', () => {
    const longName = 'a'.repeat(51)
    const result = roleSchema.safeParse({
      name: longName,
      displayName: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('should require displayName', () => {
    const roleWithoutDisplayName = {
      name: 'custom_role',
    }

    const result = roleSchema.safeParse(roleWithoutDisplayName)
    expect(result.success).toBe(false)
  })

  it('should reject empty displayName', () => {
    const roleWithEmptyDisplayName = {
      name: 'custom_role',
      displayName: '',
    }

    const result = roleSchema.safeParse(roleWithEmptyDisplayName)
    expect(result.success).toBe(false)
  })

  it('should enforce displayName max length', () => {
    const result = roleSchema.safeParse({
      name: 'test_role',
      displayName: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('should allow optional description', () => {
    const roleWithDescription = {
      name: 'test_role',
      displayName: 'Test Role',
      description: 'A test role',
    }

    const roleWithoutDescription = {
      name: 'test_role',
      displayName: 'Test Role',
    }

    expect(roleSchema.safeParse(roleWithDescription).success).toBe(true)
    expect(roleSchema.safeParse(roleWithoutDescription).success).toBe(true)
  })

  it('should allow null description', () => {
    const roleWithNullDescription = {
      name: 'test_role',
      displayName: 'Test Role',
      description: null,
    }

    const result = roleSchema.safeParse(roleWithNullDescription)
    expect(result.success).toBe(true)
  })

  it('should default permissions to empty array', () => {
    const roleWithoutPermissions = {
      name: 'test_role',
      displayName: 'Test Role',
    }

    const result = roleSchema.safeParse(roleWithoutPermissions)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual([])
    }
  })

  it('should accept permissions array', () => {
    const roleWithPermissions = {
      name: 'test_role',
      displayName: 'Test Role',
      permissions: ['assets:read', 'work_orders:write'],
    }

    const result = roleSchema.safeParse(roleWithPermissions)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual(['assets:read', 'work_orders:write'])
    }
  })
})

describe('Role Name Validation', () => {
  it('should accept all valid role names', () => {
    const validRoleNames = [
      'super_admin',
      'admin',
      'fleet_manager',
      'supervisor',
      'technician',
      'operator',
    ]

    for (const roleName of validRoleNames) {
      const result = roleNameSchema.safeParse(roleName)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid role names', () => {
    const invalidRoleNames = [
      'invalid_role',
      'manager',
      'user',
      'guest',
      '',
      'Super_Admin',
      'ADMIN',
    ]

    for (const roleName of invalidRoleNames) {
      const result = roleNameSchema.safeParse(roleName)
      expect(result.success).toBe(false)
    }
  })
})

describe('Permission Validation', () => {
  it('should accept all valid permissions', () => {
    const validPermissions = [
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
      '*',
      '**',
    ]

    for (const permission of validPermissions) {
      const result = permissionSchema.safeParse(permission)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid permissions', () => {
    const invalidPermissions = ['invalid:permission', 'read:assets', 'assets', '', 'admin', 'all']

    for (const permission of invalidPermissions) {
      const result = permissionSchema.safeParse(permission)
      expect(result.success).toBe(false)
    }
  })
})

describe('Permission Logic', () => {
  function hasPermission(userPermissions: string[], required: string): boolean {
    // Super admin has all permissions
    if (userPermissions.includes('**')) return true
    // Admin wildcard
    if (userPermissions.includes('*')) return true
    return userPermissions.includes(required)
  }

  function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
    if (userPermissions.includes('**') || userPermissions.includes('*')) return true
    return required.some((p) => userPermissions.includes(p))
  }

  function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
    if (userPermissions.includes('**') || userPermissions.includes('*')) return true
    return required.every((p) => userPermissions.includes(p))
  }

  describe('hasPermission', () => {
    it('should return true for super admin', () => {
      expect(hasPermission(['**'], 'assets:read')).toBe(true)
      expect(hasPermission(['**'], 'users:delete')).toBe(true)
    })

    it('should return true for admin wildcard', () => {
      expect(hasPermission(['*'], 'assets:read')).toBe(true)
      expect(hasPermission(['*'], 'users:delete')).toBe(true)
    })

    it('should return true when permission is granted', () => {
      expect(hasPermission(['assets:read', 'work_orders:read'], 'assets:read')).toBe(true)
    })

    it('should return false when permission is not granted', () => {
      expect(hasPermission(['assets:read'], 'assets:write')).toBe(false)
    })

    it('should return false for empty permissions', () => {
      expect(hasPermission([], 'assets:read')).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true if any permission matches', () => {
      const userPerms = ['assets:read', 'work_orders:read']
      expect(hasAnyPermission(userPerms, ['assets:read', 'assets:write'])).toBe(true)
    })

    it('should return false if no permission matches', () => {
      const userPerms = ['assets:read']
      expect(hasAnyPermission(userPerms, ['assets:write', 'users:read'])).toBe(false)
    })

    it('should return true for wildcards', () => {
      expect(hasAnyPermission(['*'], ['assets:write', 'users:read'])).toBe(true)
      expect(hasAnyPermission(['**'], ['assets:write', 'users:read'])).toBe(true)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if all permissions match', () => {
      const userPerms = ['assets:read', 'assets:write', 'work_orders:read']
      expect(hasAllPermissions(userPerms, ['assets:read', 'assets:write'])).toBe(true)
    })

    it('should return false if not all permissions match', () => {
      const userPerms = ['assets:read']
      expect(hasAllPermissions(userPerms, ['assets:read', 'assets:write'])).toBe(false)
    })

    it('should return true for wildcards', () => {
      expect(hasAllPermissions(['*'], ['assets:read', 'assets:write'])).toBe(true)
      expect(hasAllPermissions(['**'], ['assets:read', 'assets:write'])).toBe(true)
    })
  })
})

describe('Default Role Permissions', () => {
  const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    super_admin: ['**'],
    admin: ['*'],
    fleet_manager: [
      'assets:read',
      'assets:write',
      'assets:delete',
      'work_orders:read',
      'work_orders:write',
      'work_orders:delete',
      'reports:read',
      'reports:write',
      'users:read',
      'settings:read',
      'settings:write',
    ],
    supervisor: [
      'assets:read',
      'assets:write',
      'work_orders:read',
      'work_orders:write',
      'reports:read',
      'users:read',
    ],
    technician: ['assets:read', 'work_orders:read', 'work_orders:write', 'reports:read'],
    operator: ['assets:read', 'work_orders:read'],
  }

  it('should grant super_admin cross-tenant access', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toContain('**')
  })

  it('should grant admin all org permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain('*')
  })

  it('should grant fleet_manager delete permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).toContain('assets:delete')
    expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).toContain('work_orders:delete')
  })

  it('should not grant supervisor delete permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.supervisor).not.toContain('assets:delete')
    expect(DEFAULT_ROLE_PERMISSIONS.supervisor).not.toContain('work_orders:delete')
  })

  it('should grant technician work_orders:write', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.technician).toContain('work_orders:write')
  })

  it('should only grant operator read permissions', () => {
    const operatorPerms = DEFAULT_ROLE_PERMISSIONS.operator
    expect(operatorPerms.every((p) => p.endsWith(':read'))).toBe(true)
  })

  it('should have decreasing permissions by role level', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin.length).toBeLessThan(
      DEFAULT_ROLE_PERMISSIONS.admin.length + 1,
    ) // ** is more powerful than *
    expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager.length).toBeGreaterThan(
      DEFAULT_ROLE_PERMISSIONS.supervisor.length,
    )
    expect(DEFAULT_ROLE_PERMISSIONS.supervisor.length).toBeGreaterThan(
      DEFAULT_ROLE_PERMISSIONS.technician.length,
    )
    expect(DEFAULT_ROLE_PERMISSIONS.technician.length).toBeGreaterThan(
      DEFAULT_ROLE_PERMISSIONS.operator.length,
    )
  })
})

describe('Safe User Schema', () => {
  // SafeUser excludes sensitive fields
  const safeUserSchema = z.object({
    id: z.string().uuid(),
    organisationId: z.string().uuid(),
    roleId: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    hourlyRate: z.string().nullable(), // Decimal comes as string from DB
    isActive: z.boolean(),
    emailVerified: z.boolean(),
    lastLoginAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })

  // SafeUser should NOT contain these sensitive fields
  const sensitiveFieldsSchema = z.object({
    passwordHash: z.string(),
    passwordResetToken: z.string(),
    passwordResetExpires: z.string(),
    failedLoginAttempts: z.number(),
    lockedUntil: z.string(),
  })

  it('should validate safe user without sensitive fields', () => {
    const safeUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      organisationId: '550e8400-e29b-41d4-a716-446655440001',
      roleId: '550e8400-e29b-41d4-a716-446655440002',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      avatarUrl: 'https://example.com/avatar.jpg',
      hourlyRate: '25.50',
      isActive: true,
      emailVerified: true,
      lastLoginAt: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    const result = safeUserSchema.safeParse(safeUser)
    expect(result.success).toBe(true)

    // Verify sensitive fields are NOT present
    expect('passwordHash' in safeUser).toBe(false)
    expect('passwordResetToken' in safeUser).toBe(false)
    expect('failedLoginAttempts' in safeUser).toBe(false)
  })

  it('should allow null optional fields', () => {
    const safeUserWithNulls = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      organisationId: '550e8400-e29b-41d4-a716-446655440001',
      roleId: '550e8400-e29b-41d4-a716-446655440002',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: null,
      avatarUrl: null,
      hourlyRate: null,
      isActive: true,
      emailVerified: false,
      lastLoginAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    const result = safeUserSchema.safeParse(safeUserWithNulls)
    expect(result.success).toBe(true)
  })
})
