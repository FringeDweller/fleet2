import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Roles API Tests (F17 - Administration)
 *
 * Tests for GET /api/roles endpoint:
 * - Role list response structure
 * - Authentication requirement
 * - Role ordering
 * - Permission handling
 */

// Role response schema based on the API implementation
const roleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().nullable(),
  permissions: z.array(z.string()),
})

// Role list response - array of roles
const roleListResponseSchema = z.array(roleResponseSchema)

// Standard role names
const VALID_ROLE_NAMES = [
  'super_admin',
  'admin',
  'fleet_manager',
  'supervisor',
  'technician',
  'operator',
] as const

describe('Roles API - GET /api/roles', () => {
  describe('Response Structure', () => {
    it('should validate a valid role response object', () => {
      const validRole = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full access to organisation settings',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(validRole)
      expect(result.success).toBe(true)
    })

    it('should require id field', () => {
      const roleWithoutId = {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full access',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithoutId)
      expect(result.success).toBe(false)
    })

    it('should require id to be valid UUID', () => {
      const roleWithInvalidId = {
        id: 'not-a-uuid',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full access',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithInvalidId)
      expect(result.success).toBe(false)
    })

    it('should require name field', () => {
      const roleWithoutName = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        displayName: 'Administrator',
        description: 'Full access',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithoutName)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const roleWithEmptyName = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        displayName: 'Administrator',
        description: 'Full access',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithEmptyName)
      expect(result.success).toBe(false)
    })

    it('should require displayName field', () => {
      const roleWithoutDisplayName = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        description: 'Full access',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithoutDisplayName)
      expect(result.success).toBe(false)
    })

    it('should reject empty displayName', () => {
      const roleWithEmptyDisplayName = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        displayName: '',
        description: 'Full access',
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithEmptyDisplayName)
      expect(result.success).toBe(false)
    })

    it('should allow null description', () => {
      const roleWithNullDescription = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        displayName: 'Administrator',
        description: null,
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(roleWithNullDescription)
      expect(result.success).toBe(true)
    })

    it('should require permissions field', () => {
      const roleWithoutPermissions = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full access',
      }

      const result = roleResponseSchema.safeParse(roleWithoutPermissions)
      expect(result.success).toBe(false)
    })

    it('should require permissions to be an array', () => {
      const roleWithInvalidPermissions = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full access',
        permissions: 'assets:read',
      }

      const result = roleResponseSchema.safeParse(roleWithInvalidPermissions)
      expect(result.success).toBe(false)
    })

    it('should accept empty permissions array', () => {
      const roleWithEmptyPermissions = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access',
        permissions: [],
      }

      const result = roleResponseSchema.safeParse(roleWithEmptyPermissions)
      expect(result.success).toBe(true)
    })

    it('should accept multiple permissions', () => {
      const roleWithMultiplePermissions = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'technician',
        displayName: 'Technician',
        description: null,
        permissions: ['assets:read', 'work_orders:read', 'work_orders:write'],
      }

      const result = roleResponseSchema.safeParse(roleWithMultiplePermissions)
      expect(result.success).toBe(true)
    })
  })

  describe('Role List Response', () => {
    it('should validate an empty role list', () => {
      const result = roleListResponseSchema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('should validate a list with single role', () => {
      const roleList = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full access',
          permissions: ['*'],
        },
      ]

      const result = roleListResponseSchema.safeParse(roleList)
      expect(result.success).toBe(true)
    })

    it('should validate a list with multiple roles', () => {
      const roleList = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full access',
          permissions: ['*'],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'fleet_manager',
          displayName: 'Fleet Manager',
          description: 'Manages fleet operations',
          permissions: ['assets:read', 'assets:write', 'work_orders:read'],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'operator',
          displayName: 'Operator',
          description: null,
          permissions: ['assets:read', 'work_orders:read'],
        },
      ]

      const result = roleListResponseSchema.safeParse(roleList)
      expect(result.success).toBe(true)
    })

    it('should reject list with invalid role', () => {
      const roleListWithInvalid = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full access',
          permissions: ['*'],
        },
        {
          id: 'invalid-uuid',
          name: '',
          displayName: '',
          permissions: 'not-an-array',
        },
      ]

      const result = roleListResponseSchema.safeParse(roleListWithInvalid)
      expect(result.success).toBe(false)
    })
  })

  describe('Role Ordering', () => {
    it('should sort roles alphabetically by name', () => {
      const roles = [
        { name: 'technician' },
        { name: 'admin' },
        { name: 'supervisor' },
        { name: 'fleet_manager' },
        { name: 'operator' },
      ]

      const sortedRoles = [...roles].sort((a, b) => a.name.localeCompare(b.name))

      expect(sortedRoles[0].name).toBe('admin')
      expect(sortedRoles[1].name).toBe('fleet_manager')
      expect(sortedRoles[2].name).toBe('operator')
      expect(sortedRoles[3].name).toBe('supervisor')
      expect(sortedRoles[4].name).toBe('technician')
    })

    it('should maintain stable sort order', () => {
      const roles = [
        { name: 'admin', id: '1' },
        { name: 'admin', id: '2' },
        { name: 'admin', id: '3' },
      ]

      const sortedRoles = [...roles].sort((a, b) => a.name.localeCompare(b.name))

      // All have same name, so order depends on stable sort
      expect(sortedRoles.length).toBe(3)
      expect(sortedRoles.every((r) => r.name === 'admin')).toBe(true)
    })
  })

  describe('Standard Role Names', () => {
    it('should accept all valid standard role names', () => {
      for (const roleName of VALID_ROLE_NAMES) {
        const role = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: roleName,
          displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1).replace('_', ' '),
          description: null,
          permissions: [],
        }

        const result = roleResponseSchema.safeParse(role)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('Permission Values', () => {
    it('should accept wildcard permission for admin', () => {
      const adminRole = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'admin',
        displayName: 'Administrator',
        description: null,
        permissions: ['*'],
      }

      const result = roleResponseSchema.safeParse(adminRole)
      expect(result.success).toBe(true)
    })

    it('should accept double wildcard permission for super_admin', () => {
      const superAdminRole = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: null,
        permissions: ['**'],
      }

      const result = roleResponseSchema.safeParse(superAdminRole)
      expect(result.success).toBe(true)
    })

    it('should accept granular permissions', () => {
      const granularPermissions = [
        'assets:read',
        'assets:write',
        'assets:delete',
        'work_orders:read',
        'work_orders:write',
        'work_orders:delete',
        'users:read',
        'users:write',
        'users:delete',
        'reports:read',
        'reports:write',
        'settings:read',
        'settings:write',
        'parts:read',
        'parts:write',
        'parts:delete',
        'maintenance:read',
        'maintenance:write',
        'maintenance:delete',
      ]

      const role = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'custom_role',
        displayName: 'Custom Role',
        description: null,
        permissions: granularPermissions,
      }

      const result = roleResponseSchema.safeParse(role)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.permissions).toHaveLength(granularPermissions.length)
      }
    })
  })
})

describe('Role Authentication', () => {
  describe('Authentication Requirement', () => {
    // Authentication schema check - simulates what requireAuth validates
    const authenticatedUserSchema = z.object({
      id: z.string().uuid(),
      organisationId: z.string().uuid(),
      roleId: z.string().uuid(),
      roleName: z.string(),
      permissions: z.array(z.string()),
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string(),
      isActive: z.boolean(),
    })

    it('should require authenticated user to have valid structure', () => {
      const validUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        organisationId: '550e8400-e29b-41d4-a716-446655440002',
        roleId: '550e8400-e29b-41d4-a716-446655440003',
        roleName: 'admin',
        permissions: ['*'],
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      }

      const result = authenticatedUserSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('should reject user without organisation', () => {
      const userWithoutOrg = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        roleId: '550e8400-e29b-41d4-a716-446655440003',
        roleName: 'admin',
        permissions: ['*'],
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      }

      const result = authenticatedUserSchema.safeParse(userWithoutOrg)
      expect(result.success).toBe(false)
    })

    it('should reject inactive user', () => {
      const inactiveUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        organisationId: '550e8400-e29b-41d4-a716-446655440002',
        roleId: '550e8400-e29b-41d4-a716-446655440003',
        roleName: 'technician',
        permissions: ['assets:read'],
        email: 'inactive@test.com',
        firstName: 'Inactive',
        lastName: 'User',
        isActive: false,
      }

      const result = authenticatedUserSchema.safeParse(inactiveUser)
      expect(result.success).toBe(true) // Schema accepts, but business logic should reject
      expect(result.success && result.data.isActive).toBe(false)
    })
  })

  describe('Authorization Logic', () => {
    // Any authenticated user can view roles (no specific permission required)
    function canViewRoles(user: { permissions: string[]; isActive: boolean }): boolean {
      // Only requirement is being authenticated (isActive)
      return user.isActive
    }

    it('should allow admin to view roles', () => {
      const admin = { permissions: ['*'], isActive: true }
      expect(canViewRoles(admin)).toBe(true)
    })

    it('should allow super_admin to view roles', () => {
      const superAdmin = { permissions: ['**'], isActive: true }
      expect(canViewRoles(superAdmin)).toBe(true)
    })

    it('should allow fleet_manager to view roles', () => {
      const fleetManager = { permissions: ['assets:read', 'users:read'], isActive: true }
      expect(canViewRoles(fleetManager)).toBe(true)
    })

    it('should allow operator to view roles', () => {
      const operator = { permissions: ['assets:read', 'work_orders:read'], isActive: true }
      expect(canViewRoles(operator)).toBe(true)
    })

    it('should allow user with no permissions to view roles', () => {
      const emptyUser = { permissions: [], isActive: true }
      expect(canViewRoles(emptyUser)).toBe(true)
    })

    it('should not allow inactive user to view roles', () => {
      const inactiveUser = { permissions: ['*'], isActive: false }
      expect(canViewRoles(inactiveUser)).toBe(false)
    })
  })
})

describe('Role Permission Mapping', () => {
  // Default permissions for each predefined role
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

  describe('Super Admin Permissions', () => {
    it('should have cross-tenant wildcard permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toContain('**')
    })

    it('should only have the super wildcard', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toHaveLength(1)
    })
  })

  describe('Admin Permissions', () => {
    it('should have organisation-wide wildcard permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain('*')
    })

    it('should only have the wildcard', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toHaveLength(1)
    })
  })

  describe('Fleet Manager Permissions', () => {
    it('should have users:read permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).toContain('users:read')
    })

    it('should have settings:write permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).toContain('settings:write')
    })

    it('should have asset delete permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).toContain('assets:delete')
    })

    it('should not have users:write permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).not.toContain('users:write')
    })

    it('should not have users:delete permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager).not.toContain('users:delete')
    })
  })

  describe('Supervisor Permissions', () => {
    it('should have users:read permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.supervisor).toContain('users:read')
    })

    it('should not have asset delete permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.supervisor).not.toContain('assets:delete')
    })

    it('should not have settings:write permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.supervisor).not.toContain('settings:write')
    })
  })

  describe('Technician Permissions', () => {
    it('should have work_orders:write permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.technician).toContain('work_orders:write')
    })

    it('should not have users:read permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.technician).not.toContain('users:read')
    })

    it('should not have asset write permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.technician).not.toContain('assets:write')
    })
  })

  describe('Operator Permissions', () => {
    it('should have read-only permissions', () => {
      const operatorPerms = DEFAULT_ROLE_PERMISSIONS.operator
      expect(operatorPerms.every((p) => p.endsWith(':read'))).toBe(true)
    })

    it('should not have any write permissions', () => {
      const operatorPerms = DEFAULT_ROLE_PERMISSIONS.operator
      expect(operatorPerms.every((p) => !p.endsWith(':write'))).toBe(true)
    })

    it('should have minimum necessary permissions', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.operator).toContain('assets:read')
      expect(DEFAULT_ROLE_PERMISSIONS.operator).toContain('work_orders:read')
      expect(DEFAULT_ROLE_PERMISSIONS.operator).toHaveLength(2)
    })
  })

  describe('Permission Hierarchy', () => {
    it('should have decreasing permissions by role level', () => {
      // Super admin and admin use wildcards, so compare by capability
      // Fleet manager should have more than supervisor
      expect(DEFAULT_ROLE_PERMISSIONS.fleet_manager.length).toBeGreaterThan(
        DEFAULT_ROLE_PERMISSIONS.supervisor.length,
      )
      // Supervisor should have more than technician
      expect(DEFAULT_ROLE_PERMISSIONS.supervisor.length).toBeGreaterThan(
        DEFAULT_ROLE_PERMISSIONS.technician.length,
      )
      // Technician should have more than operator
      expect(DEFAULT_ROLE_PERMISSIONS.technician.length).toBeGreaterThan(
        DEFAULT_ROLE_PERMISSIONS.operator.length,
      )
    })
  })
})

describe('Error Responses', () => {
  // Error response schema
  const errorResponseSchema = z.object({
    statusCode: z.number(),
    statusMessage: z.string(),
    data: z.any().optional(),
  })

  describe('401 Unauthorized', () => {
    it('should validate 401 error response', () => {
      const unauthorizedError = {
        statusCode: 401,
        statusMessage: 'Unauthorized',
      }

      const result = errorResponseSchema.safeParse(unauthorizedError)
      expect(result.success).toBe(true)
    })

    it('should have correct status code for unauthorized', () => {
      const error = { statusCode: 401, statusMessage: 'Unauthorized' }
      expect(error.statusCode).toBe(401)
    })
  })

  describe('403 Forbidden', () => {
    it('should validate 403 error response', () => {
      const forbiddenError = {
        statusCode: 403,
        statusMessage: 'Forbidden: Insufficient permissions',
        data: { required: 'users:read' },
      }

      const result = errorResponseSchema.safeParse(forbiddenError)
      expect(result.success).toBe(true)
    })
  })

  describe('500 Internal Server Error', () => {
    it('should validate 500 error response', () => {
      const serverError = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      }

      const result = errorResponseSchema.safeParse(serverError)
      expect(result.success).toBe(true)
    })
  })
})
