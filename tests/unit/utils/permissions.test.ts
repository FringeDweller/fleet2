/**
 * Permission utilities tests
 * Tests the RBAC permission checking functions
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdmin,
  isManager,
  isSupervisor,
} from '../../../server/utils/permissions'
import {
  createAdminUser,
  createFleetManagerUser,
  createSupervisorUser,
  createTechnicianUser,
  createOperatorUser,
  resetFixtures,
} from '../../helpers'

describe('Permission Utilities', () => {
  beforeEach(() => {
    resetFixtures()
  })

  describe('hasPermission', () => {
    it('should return true when user has the exact permission', () => {
      // Arrange
      const permissions = ['assets:read', 'work_orders:write']

      // Act & Assert
      expect(hasPermission(permissions, 'assets:read')).toBe(true)
      expect(hasPermission(permissions, 'work_orders:write')).toBe(true)
    })

    it('should return false when user does not have the permission', () => {
      // Arrange
      const permissions = ['assets:read']

      // Act & Assert
      expect(hasPermission(permissions, 'assets:write')).toBe(false)
      expect(hasPermission(permissions, 'work_orders:read')).toBe(false)
    })

    it('should return true for any permission when user has wildcard', () => {
      // Arrange
      const permissions = ['*']

      // Act & Assert
      expect(hasPermission(permissions, 'assets:read')).toBe(true)
      expect(hasPermission(permissions, 'assets:write')).toBe(true)
      expect(hasPermission(permissions, 'users:delete')).toBe(true)
      expect(hasPermission(permissions, 'settings:write')).toBe(true)
    })

    it('should return false when permissions array is empty', () => {
      // Arrange
      const permissions: string[] = []

      // Act & Assert
      expect(hasPermission(permissions, 'assets:read')).toBe(false)
    })

    it('should handle admin wildcard permission with other permissions', () => {
      // Arrange
      const permissions = ['*', 'assets:read'] // Wildcard makes others redundant

      // Act & Assert
      expect(hasPermission(permissions, 'users:delete')).toBe(true)
      expect(hasPermission(permissions, 'settings:write')).toBe(true)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one of the required permissions', () => {
      // Arrange
      const permissions = ['assets:read', 'work_orders:write']

      // Act & Assert
      expect(hasAnyPermission(permissions, ['assets:read', 'assets:write'])).toBe(true)
      expect(hasAnyPermission(permissions, ['work_orders:write', 'work_orders:delete'])).toBe(
        true,
      )
    })

    it('should return false when user has none of the required permissions', () => {
      // Arrange
      const permissions = ['assets:read']

      // Act & Assert
      expect(hasAnyPermission(permissions, ['assets:write', 'assets:delete'])).toBe(false)
      expect(hasAnyPermission(permissions, ['users:read', 'users:write'])).toBe(false)
    })

    it('should return true with wildcard permission', () => {
      // Arrange
      const permissions = ['*']

      // Act & Assert
      expect(hasAnyPermission(permissions, ['assets:write', 'users:delete'])).toBe(true)
    })

    it('should return false when checking against empty required permissions array', () => {
      // Arrange
      const permissions = ['assets:read']

      // Act & Assert
      expect(hasAnyPermission(permissions, [])).toBe(false)
    })

    it('should return false when both arrays are empty', () => {
      // Arrange & Act & Assert
      expect(hasAnyPermission([], [])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', () => {
      // Arrange
      const permissions = ['assets:read', 'assets:write', 'work_orders:read']

      // Act & Assert
      expect(hasAllPermissions(permissions, ['assets:read', 'assets:write'])).toBe(true)
      expect(hasAllPermissions(permissions, ['assets:read'])).toBe(true)
    })

    it('should return false when user is missing any required permission', () => {
      // Arrange
      const permissions = ['assets:read']

      // Act & Assert
      expect(hasAllPermissions(permissions, ['assets:read', 'assets:write'])).toBe(false)
      expect(hasAllPermissions(permissions, ['assets:write', 'assets:delete'])).toBe(false)
    })

    it('should return true with wildcard permission', () => {
      // Arrange
      const permissions = ['*']

      // Act & Assert
      expect(hasAllPermissions(permissions, ['assets:read', 'assets:write', 'users:delete'])).toBe(
        true,
      )
    })

    it('should return true when required permissions array is empty', () => {
      // Arrange
      const permissions = ['assets:read']

      // Act & Assert
      expect(hasAllPermissions(permissions, [])).toBe(true)
    })

    it('should handle partial matches correctly', () => {
      // Arrange
      const permissions = ['assets:read', 'work_orders:read']

      // Act & Assert
      expect(hasAllPermissions(permissions, ['assets:read', 'work_orders:read'])).toBe(true)
      expect(
        hasAllPermissions(permissions, ['assets:read', 'work_orders:read', 'assets:write']),
      ).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for user with admin role', () => {
      // Arrange
      const user = createAdminUser()

      // Act & Assert
      expect(isAdmin(user)).toBe(true)
    })

    it('should return true for user with wildcard permission', () => {
      // Arrange
      const user = createTechnicianUser({ permissions: ['*'] })

      // Act & Assert
      expect(isAdmin(user)).toBe(true)
    })

    it('should return false for fleet manager', () => {
      // Arrange
      const user = createFleetManagerUser()

      // Act & Assert
      expect(isAdmin(user)).toBe(false)
    })

    it('should return false for supervisor', () => {
      // Arrange
      const user = createSupervisorUser()

      // Act & Assert
      expect(isAdmin(user)).toBe(false)
    })

    it('should return false for technician', () => {
      // Arrange
      const user = createTechnicianUser()

      // Act & Assert
      expect(isAdmin(user)).toBe(false)
    })

    it('should return false for operator', () => {
      // Arrange
      const user = createOperatorUser()

      // Act & Assert
      expect(isAdmin(user)).toBe(false)
    })
  })

  describe('isManager', () => {
    it('should return true for admin user', () => {
      // Arrange
      const user = createAdminUser()

      // Act & Assert
      expect(isManager(user)).toBe(true)
    })

    it('should return true for fleet manager user', () => {
      // Arrange
      const user = createFleetManagerUser()

      // Act & Assert
      expect(isManager(user)).toBe(true)
    })

    it('should return false for supervisor', () => {
      // Arrange
      const user = createSupervisorUser()

      // Act & Assert
      expect(isManager(user)).toBe(false)
    })

    it('should return false for technician', () => {
      // Arrange
      const user = createTechnicianUser()

      // Act & Assert
      expect(isManager(user)).toBe(false)
    })

    it('should return false for operator', () => {
      // Arrange
      const user = createOperatorUser()

      // Act & Assert
      expect(isManager(user)).toBe(false)
    })

    it('should return true for user with wildcard permission', () => {
      // Arrange
      const user = createTechnicianUser({ permissions: ['*'] })

      // Act & Assert
      expect(isManager(user)).toBe(true)
    })
  })

  describe('isSupervisor', () => {
    it('should return true for admin user', () => {
      // Arrange
      const user = createAdminUser()

      // Act & Assert
      expect(isSupervisor(user)).toBe(true)
    })

    it('should return true for fleet manager user', () => {
      // Arrange
      const user = createFleetManagerUser()

      // Act & Assert
      expect(isSupervisor(user)).toBe(true)
    })

    it('should return true for supervisor user', () => {
      // Arrange
      const user = createSupervisorUser()

      // Act & Assert
      expect(isSupervisor(user)).toBe(true)
    })

    it('should return false for technician', () => {
      // Arrange
      const user = createTechnicianUser()

      // Act & Assert
      expect(isSupervisor(user)).toBe(false)
    })

    it('should return false for operator', () => {
      // Arrange
      const user = createOperatorUser()

      // Act & Assert
      expect(isSupervisor(user)).toBe(false)
    })

    it('should return true for user with wildcard permission', () => {
      // Arrange
      const user = createOperatorUser({ permissions: ['*'] })

      // Act & Assert
      expect(isSupervisor(user)).toBe(true)
    })
  })

  describe('Role Hierarchy Tests', () => {
    it('should correctly implement role hierarchy', () => {
      // Arrange
      const admin = createAdminUser()
      const manager = createFleetManagerUser()
      const supervisor = createSupervisorUser()
      const technician = createTechnicianUser()
      const operator = createOperatorUser()

      // Act & Assert - Admin is highest
      expect(isAdmin(admin)).toBe(true)
      expect(isManager(admin)).toBe(true)
      expect(isSupervisor(admin)).toBe(true)

      // Manager is second highest
      expect(isAdmin(manager)).toBe(false)
      expect(isManager(manager)).toBe(true)
      expect(isSupervisor(manager)).toBe(true)

      // Supervisor is third highest
      expect(isAdmin(supervisor)).toBe(false)
      expect(isManager(supervisor)).toBe(false)
      expect(isSupervisor(supervisor)).toBe(true)

      // Technician is fourth
      expect(isAdmin(technician)).toBe(false)
      expect(isManager(technician)).toBe(false)
      expect(isSupervisor(technician)).toBe(false)

      // Operator is lowest
      expect(isAdmin(operator)).toBe(false)
      expect(isManager(operator)).toBe(false)
      expect(isSupervisor(operator)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle case-sensitive permission names', () => {
      // Arrange
      const permissions = ['assets:read']

      // Act & Assert
      expect(hasPermission(permissions, 'assets:read')).toBe(true)
      // @ts-expect-error - Testing case sensitivity
      expect(hasPermission(permissions, 'Assets:Read')).toBe(false)
    })

    it('should handle permissions with special characters', () => {
      // Arrange
      const permissions = ['work_orders:read', 'work-orders:write']

      // Act & Assert
      expect(hasPermission(permissions, 'work_orders:read')).toBe(true)
      // @ts-expect-error - Testing different format
      expect(hasPermission(permissions, 'work-orders:write')).toBe(true)
    })

    it('should validate role-specific permission sets', () => {
      // Arrange
      const admin = createAdminUser()
      const manager = createFleetManagerUser()
      const supervisor = createSupervisorUser()
      const technician = createTechnicianUser()
      const operator = createOperatorUser()

      // Act & Assert - Admin has all permissions
      expect(hasPermission(admin.permissions, 'assets:delete')).toBe(true)
      expect(hasPermission(admin.permissions, 'users:delete')).toBe(true)

      // Manager has specific permissions
      expect(hasPermission(manager.permissions, 'assets:delete')).toBe(true)
      expect(hasPermission(manager.permissions, 'users:write')).toBe(false)

      // Supervisor has read/write but not delete
      expect(hasPermission(supervisor.permissions, 'assets:read')).toBe(true)
      expect(hasPermission(supervisor.permissions, 'assets:write')).toBe(true)
      expect(hasPermission(supervisor.permissions, 'assets:delete')).toBe(false)

      // Technician has limited write permissions
      expect(hasPermission(technician.permissions, 'assets:read')).toBe(true)
      expect(hasPermission(technician.permissions, 'work_orders:write')).toBe(true)
      expect(hasPermission(technician.permissions, 'assets:write')).toBe(false)

      // Operator has only read permissions
      expect(hasPermission(operator.permissions, 'assets:read')).toBe(true)
      expect(hasPermission(operator.permissions, 'work_orders:read')).toBe(true)
      expect(hasPermission(operator.permissions, 'assets:write')).toBe(false)
      expect(hasPermission(operator.permissions, 'work_orders:write')).toBe(false)
    })
  })
})
