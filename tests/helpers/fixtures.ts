/**
 * Test Fixtures - Factory functions for creating test data.
 * No database required - use for unit tests.
 */
import { randomUUID } from 'crypto'
import type { RoleName } from '../../server/db/schema/roles'

let counter = 0
function nextId() {
  return ++counter
}

export function resetFixtures() {
  counter = 0
}

// User with permissions
export interface UserWithPermissionsFixture {
  id: string
  organisationId: string
  roleId: string
  roleName: RoleName
  permissions: string[]
  email: string
  firstName: string
  lastName: string
  phone: string | null
  avatarUrl: string | null
  isActive: boolean
  emailVerified: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function createUserWithPermissions(
  overrides: Partial<UserWithPermissionsFixture> = {},
): UserWithPermissionsFixture {
  const id = nextId()
  return {
    id: randomUUID(),
    organisationId: randomUUID(),
    roleId: randomUUID(),
    roleName: 'technician',
    permissions: ['assets:read', 'work_orders:read', 'work_orders:write'],
    email: `user${id}@test.com`,
    firstName: 'Test',
    lastName: `User${id}`,
    phone: null,
    avatarUrl: null,
    isActive: true,
    emailVerified: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Create users with different roles
export function createAdminUser(overrides: Partial<UserWithPermissionsFixture> = {}) {
  return createUserWithPermissions({
    roleName: 'admin',
    permissions: ['*'],
    email: 'admin@test.com',
    ...overrides,
  })
}

export function createFleetManagerUser(overrides: Partial<UserWithPermissionsFixture> = {}) {
  return createUserWithPermissions({
    roleName: 'fleet_manager',
    permissions: [
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
    email: 'manager@test.com',
    ...overrides,
  })
}

export function createSupervisorUser(overrides: Partial<UserWithPermissionsFixture> = {}) {
  return createUserWithPermissions({
    roleName: 'supervisor',
    permissions: [
      'assets:read',
      'assets:write',
      'work_orders:read',
      'work_orders:write',
      'reports:read',
      'users:read',
    ],
    email: 'supervisor@test.com',
    ...overrides,
  })
}

export function createTechnicianUser(overrides: Partial<UserWithPermissionsFixture> = {}) {
  return createUserWithPermissions({
    roleName: 'technician',
    permissions: ['assets:read', 'work_orders:read', 'work_orders:write', 'reports:read'],
    email: 'technician@test.com',
    ...overrides,
  })
}

export function createOperatorUser(overrides: Partial<UserWithPermissionsFixture> = {}) {
  return createUserWithPermissions({
    roleName: 'operator',
    permissions: ['assets:read', 'work_orders:read'],
    email: 'operator@test.com',
    ...overrides,
  })
}
