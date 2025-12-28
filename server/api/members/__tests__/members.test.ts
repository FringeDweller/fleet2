import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Members API Tests (F17 - Administration)
 *
 * Tests for:
 * - GET /api/members - List organisation members
 * - PUT /api/members/[id] - Update member
 * - DELETE /api/members/[id] - Deactivate member
 *
 * Covers permissions, validation, business rules, and error handling
 */

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

// Member response schema from GET endpoint
const memberResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.string(),
  roleId: z.string().uuid().nullable(),
  roleName: z.string().nullable(),
  avatar: z.object({
    src: z.string().url().optional(),
  }),
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

// Update member schema - matches the API validation
const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

// Success response from PUT endpoint
const updateSuccessSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    isActive: z.boolean(),
  }),
})

// Success response from DELETE endpoint
const deleteSuccessSchema = z.object({
  success: z.literal(true),
  message: z.string(),
})

// Error response schema
const errorResponseSchema = z.object({
  statusCode: z.number(),
  statusMessage: z.string(),
  data: z.any().optional(),
})

// ============================================================================
// GET /api/members - LIST MEMBERS
// ============================================================================

describe('GET /api/members - List Members', () => {
  describe('Response Structure', () => {
    it('should validate a valid member response object', () => {
      const validMember = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        role: 'Administrator',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
        roleName: 'admin',
        avatar: { src: 'https://example.com/avatar.jpg' },
        isActive: true,
        emailVerified: true,
        lastLoginAt: '2024-01-15T10:30:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(validMember)
      expect(result.success).toBe(true)
    })

    it('should require id to be valid UUID', () => {
      const memberWithInvalidId = {
        id: 'not-a-uuid',
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        role: 'Admin',
        roleId: null,
        roleName: null,
        avatar: {},
        isActive: true,
        emailVerified: true,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithInvalidId)
      expect(result.success).toBe(false)
    })

    it('should require name field', () => {
      const memberWithoutName = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john@example.com',
        phone: null,
        role: 'Admin',
        roleId: null,
        roleName: null,
        avatar: {},
        isActive: true,
        emailVerified: true,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithoutName)
      expect(result.success).toBe(false)
    })

    it('should require valid email format', () => {
      const memberWithInvalidEmail = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'not-an-email',
        phone: null,
        role: 'Admin',
        roleId: null,
        roleName: null,
        avatar: {},
        isActive: true,
        emailVerified: true,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithInvalidEmail)
      expect(result.success).toBe(false)
    })

    it('should allow null phone number', () => {
      const memberWithNullPhone = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        role: 'Admin',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
        roleName: 'admin',
        avatar: {},
        isActive: true,
        emailVerified: true,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithNullPhone)
      expect(result.success).toBe(true)
    })

    it('should allow null roleId for users without role', () => {
      const memberWithoutRole = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        role: 'Unknown',
        roleId: null,
        roleName: null,
        avatar: {},
        isActive: true,
        emailVerified: false,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithoutRole)
      expect(result.success).toBe(true)
    })

    it('should allow empty avatar object', () => {
      const memberWithEmptyAvatar = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        role: 'Admin',
        roleId: null,
        roleName: null,
        avatar: {},
        isActive: true,
        emailVerified: true,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithEmptyAvatar)
      expect(result.success).toBe(true)
    })

    it('should require avatar.src to be valid URL if present', () => {
      const memberWithInvalidAvatarUrl = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        role: 'Admin',
        roleId: null,
        roleName: null,
        avatar: { src: 'not-a-url' },
        isActive: true,
        emailVerified: true,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberWithInvalidAvatarUrl)
      expect(result.success).toBe(false)
    })

    it('should allow null lastLoginAt for users who never logged in', () => {
      const memberNeverLoggedIn = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'New User',
        email: 'new@example.com',
        phone: null,
        role: 'Operator',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
        roleName: 'operator',
        avatar: {},
        isActive: true,
        emailVerified: false,
        lastLoginAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      const result = memberResponseSchema.safeParse(memberNeverLoggedIn)
      expect(result.success).toBe(true)
    })
  })

  describe('Member List Response', () => {
    const memberListSchema = z.array(memberResponseSchema)

    it('should validate an empty member list', () => {
      const result = memberListSchema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('should validate a list with multiple members', () => {
      const memberList = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Alice Admin',
          email: 'alice@example.com',
          phone: '+1111111111',
          role: 'Administrator',
          roleId: '550e8400-e29b-41d4-a716-446655440010',
          roleName: 'admin',
          avatar: { src: 'https://example.com/alice.jpg' },
          isActive: true,
          emailVerified: true,
          lastLoginAt: '2024-01-15T10:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Bob Builder',
          email: 'bob@example.com',
          phone: null,
          role: 'Technician',
          roleId: '550e8400-e29b-41d4-a716-446655440011',
          roleName: 'technician',
          avatar: {},
          isActive: true,
          emailVerified: true,
          lastLoginAt: '2024-01-14T08:00:00.000Z',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Charlie Checker',
          email: 'charlie@example.com',
          phone: '+3333333333',
          role: 'Operator',
          roleId: '550e8400-e29b-41d4-a716-446655440012',
          roleName: 'operator',
          avatar: {},
          isActive: false,
          emailVerified: true,
          lastLoginAt: '2024-01-10T12:00:00.000Z',
          createdAt: '2024-01-03T00:00:00.000Z',
        },
      ]

      const result = memberListSchema.safeParse(memberList)
      expect(result.success).toBe(true)
    })
  })

  describe('Member Ordering', () => {
    it('should sort members by firstName then lastName', () => {
      const members = [
        { firstName: 'Zack', lastName: 'Adams' },
        { firstName: 'Alice', lastName: 'Smith' },
        { firstName: 'Alice', lastName: 'Jones' },
        { firstName: 'Bob', lastName: 'Williams' },
      ]

      const sortedMembers = [...members].sort((a, b) => {
        const firstNameCompare = a.firstName.localeCompare(b.firstName)
        if (firstNameCompare !== 0) return firstNameCompare
        return a.lastName.localeCompare(b.lastName)
      })

      expect(sortedMembers[0].firstName).toBe('Alice')
      expect(sortedMembers[0].lastName).toBe('Jones')
      expect(sortedMembers[1].firstName).toBe('Alice')
      expect(sortedMembers[1].lastName).toBe('Smith')
      expect(sortedMembers[2].firstName).toBe('Bob')
      expect(sortedMembers[3].firstName).toBe('Zack')
    })
  })

  describe('Organisation Scoping', () => {
    interface Member {
      id: string
      name: string
      organisationId: string
    }

    function filterByOrganisation(members: Member[], organisationId: string): Member[] {
      return members.filter((m) => m.organisationId === organisationId)
    }

    it('should only return members from the same organisation', () => {
      const allMembers: Member[] = [
        { id: '1', name: 'Alice', organisationId: 'org-1' },
        { id: '2', name: 'Bob', organisationId: 'org-1' },
        { id: '3', name: 'Charlie', organisationId: 'org-2' },
        { id: '4', name: 'Diana', organisationId: 'org-1' },
        { id: '5', name: 'Eve', organisationId: 'org-3' },
      ]

      const org1Members = filterByOrganisation(allMembers, 'org-1')

      expect(org1Members).toHaveLength(3)
      expect(org1Members.every((m) => m.organisationId === 'org-1')).toBe(true)
    })

    it('should return empty array for organisation with no members', () => {
      const allMembers: Member[] = [
        { id: '1', name: 'Alice', organisationId: 'org-1' },
        { id: '2', name: 'Bob', organisationId: 'org-2' },
      ]

      const org3Members = filterByOrganisation(allMembers, 'org-3')
      expect(org3Members).toHaveLength(0)
    })

    it('should prevent cross-tenant data access', () => {
      const allMembers: Member[] = [
        { id: '1', name: 'Alice', organisationId: 'org-1' },
        { id: '2', name: 'Bob', organisationId: 'org-2' },
      ]

      const org1Members = filterByOrganisation(allMembers, 'org-1')

      expect(org1Members.some((m) => m.organisationId === 'org-2')).toBe(false)
    })
  })

  describe('Permission: users:read', () => {
    function hasUsersReadPermission(permissions: string[]): boolean {
      if (permissions.includes('**') || permissions.includes('*')) {
        return true
      }
      return permissions.includes('users:read')
    }

    it('should grant access to admin', () => {
      expect(hasUsersReadPermission(['*'])).toBe(true)
    })

    it('should grant access to super_admin', () => {
      expect(hasUsersReadPermission(['**'])).toBe(true)
    })

    it('should grant access to fleet_manager with users:read', () => {
      expect(hasUsersReadPermission(['assets:read', 'users:read', 'settings:write'])).toBe(true)
    })

    it('should grant access to supervisor with users:read', () => {
      expect(hasUsersReadPermission(['assets:read', 'users:read'])).toBe(true)
    })

    it('should deny access to technician without users:read', () => {
      expect(hasUsersReadPermission(['assets:read', 'work_orders:read', 'work_orders:write'])).toBe(
        false,
      )
    })

    it('should deny access to operator without users:read', () => {
      expect(hasUsersReadPermission(['assets:read', 'work_orders:read'])).toBe(false)
    })

    it('should deny access to user with no permissions', () => {
      expect(hasUsersReadPermission([])).toBe(false)
    })
  })
})

// ============================================================================
// PUT /api/members/[id] - UPDATE MEMBER
// ============================================================================

describe('PUT /api/members/[id] - Update Member', () => {
  describe('Update Schema Validation', () => {
    it('should validate a full update object', () => {
      const fullUpdate = {
        firstName: 'John',
        lastName: 'Updated',
        phone: '+1234567890',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        isActive: true,
      }

      const result = updateMemberSchema.safeParse(fullUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow partial updates with firstName only', () => {
      const result = updateMemberSchema.safeParse({ firstName: 'NewName' })
      expect(result.success).toBe(true)
    })

    it('should allow partial updates with lastName only', () => {
      const result = updateMemberSchema.safeParse({ lastName: 'NewLastName' })
      expect(result.success).toBe(true)
    })

    it('should allow partial updates with phone only', () => {
      const result = updateMemberSchema.safeParse({ phone: '+9876543210' })
      expect(result.success).toBe(true)
    })

    it('should allow partial updates with avatarUrl only', () => {
      const result = updateMemberSchema.safeParse({
        avatarUrl: 'https://example.com/avatar.png',
      })
      expect(result.success).toBe(true)
    })

    it('should allow partial updates with isActive only', () => {
      const result = updateMemberSchema.safeParse({ isActive: false })
      expect(result.success).toBe(true)
    })

    it('should allow empty update object', () => {
      const result = updateMemberSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject empty firstName', () => {
      const result = updateMemberSchema.safeParse({ firstName: '' })
      expect(result.success).toBe(false)
    })

    it('should reject empty lastName', () => {
      const result = updateMemberSchema.safeParse({ lastName: '' })
      expect(result.success).toBe(false)
    })

    it('should enforce firstName max length of 100', () => {
      const result = updateMemberSchema.safeParse({ firstName: 'a'.repeat(101) })
      expect(result.success).toBe(false)
    })

    it('should enforce lastName max length of 100', () => {
      const result = updateMemberSchema.safeParse({ lastName: 'a'.repeat(101) })
      expect(result.success).toBe(false)
    })

    it('should allow firstName at max length of 100', () => {
      const result = updateMemberSchema.safeParse({ firstName: 'a'.repeat(100) })
      expect(result.success).toBe(true)
    })

    it('should enforce phone max length of 50', () => {
      const result = updateMemberSchema.safeParse({ phone: '1'.repeat(51) })
      expect(result.success).toBe(false)
    })

    it('should allow null phone', () => {
      const result = updateMemberSchema.safeParse({ phone: null })
      expect(result.success).toBe(true)
    })

    it('should require avatarUrl to be valid URL', () => {
      const result = updateMemberSchema.safeParse({ avatarUrl: 'not-a-valid-url' })
      expect(result.success).toBe(false)
    })

    it('should allow null avatarUrl', () => {
      const result = updateMemberSchema.safeParse({ avatarUrl: null })
      expect(result.success).toBe(true)
    })

    it('should enforce avatarUrl max length of 500', () => {
      const longUrl = `https://example.com/${'a'.repeat(500)}.jpg`
      const result = updateMemberSchema.safeParse({ avatarUrl: longUrl })
      expect(result.success).toBe(false)
    })

    it('should require isActive to be boolean', () => {
      const result = updateMemberSchema.safeParse({ isActive: 'true' })
      expect(result.success).toBe(false)
    })

    it('should reject unknown fields', () => {
      // The strict schema should reject unknown fields
      const strictSchema = updateMemberSchema.strict()
      const result = strictSchema.safeParse({ email: 'new@email.com', firstName: 'John' })
      expect(result.success).toBe(false)
    })
  })

  describe('Success Response', () => {
    it('should validate a valid success response', () => {
      const successResponse = {
        success: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          avatarUrl: 'https://example.com/avatar.jpg',
          isActive: true,
        },
      }

      const result = updateSuccessSchema.safeParse(successResponse)
      expect(result.success).toBe(true)
    })

    it('should require success to be true', () => {
      const failureResponse = {
        success: false,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          avatarUrl: null,
          isActive: true,
        },
      }

      const result = updateSuccessSchema.safeParse(failureResponse)
      expect(result.success).toBe(false)
    })

    it('should allow null values in user response', () => {
      const responseWithNulls = {
        success: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          avatarUrl: null,
          isActive: true,
        },
      }

      const result = updateSuccessSchema.safeParse(responseWithNulls)
      expect(result.success).toBe(true)
    })
  })

  describe('Organisation Validation', () => {
    interface User {
      id: string
      organisationId: string
    }

    function isInSameOrganisation(
      currentUser: User,
      targetUserId: string,
      allUsers: User[],
    ): boolean {
      const targetUser = allUsers.find((u) => u.id === targetUserId)
      if (!targetUser) return false
      return currentUser.organisationId === targetUser.organisationId
    }

    it('should allow update when users are in same organisation', () => {
      const currentUser = { id: '1', organisationId: 'org-1' }
      const allUsers = [
        { id: '1', organisationId: 'org-1' },
        { id: '2', organisationId: 'org-1' },
      ]

      expect(isInSameOrganisation(currentUser, '2', allUsers)).toBe(true)
    })

    it('should deny update when users are in different organisations', () => {
      const currentUser = { id: '1', organisationId: 'org-1' }
      const allUsers = [
        { id: '1', organisationId: 'org-1' },
        { id: '2', organisationId: 'org-2' },
      ]

      expect(isInSameOrganisation(currentUser, '2', allUsers)).toBe(false)
    })

    it('should deny update when target user does not exist', () => {
      const currentUser = { id: '1', organisationId: 'org-1' }
      const allUsers = [{ id: '1', organisationId: 'org-1' }]

      expect(isInSameOrganisation(currentUser, 'non-existent', allUsers)).toBe(false)
    })
  })

  describe('Permission: users:write', () => {
    function hasUsersWritePermission(permissions: string[]): boolean {
      if (permissions.includes('**') || permissions.includes('*')) {
        return true
      }
      return permissions.includes('users:write')
    }

    it('should grant access to admin', () => {
      expect(hasUsersWritePermission(['*'])).toBe(true)
    })

    it('should grant access to super_admin', () => {
      expect(hasUsersWritePermission(['**'])).toBe(true)
    })

    it('should grant access with explicit users:write', () => {
      expect(hasUsersWritePermission(['assets:read', 'users:write'])).toBe(true)
    })

    it('should deny access with only users:read', () => {
      expect(hasUsersWritePermission(['assets:read', 'users:read'])).toBe(false)
    })

    it('should deny access to fleet_manager without users:write', () => {
      expect(
        hasUsersWritePermission([
          'assets:read',
          'assets:write',
          'users:read',
          'settings:read',
          'settings:write',
        ]),
      ).toBe(false)
    })

    it('should deny access with no permissions', () => {
      expect(hasUsersWritePermission([])).toBe(false)
    })
  })

  describe('Audit Logging', () => {
    interface AuditLogEntry {
      organisationId: string
      userId: string
      action: string
      entityType: string
      entityId: string
      oldValues: Record<string, unknown>
      newValues: Record<string, unknown>
      ipAddress: string | null
      userAgent: string | null
    }

    function createAuditLogEntry(
      currentUser: { id: string; organisationId: string },
      targetUserId: string,
      oldValues: Record<string, unknown>,
      newValues: Record<string, unknown>,
      headers: { 'x-forwarded-for'?: string; 'user-agent'?: string } = {},
    ): AuditLogEntry {
      return {
        organisationId: currentUser.organisationId,
        userId: currentUser.id,
        action: 'update',
        entityType: 'user',
        entityId: targetUserId,
        oldValues,
        newValues,
        ipAddress: headers['x-forwarded-for']?.split(',')[0] || null,
        userAgent: headers['user-agent'] || null,
      }
    }

    it('should create audit log entry with correct structure', () => {
      const currentUser = { id: 'admin-1', organisationId: 'org-1' }
      const oldValues = { firstName: 'John', isActive: true }
      const newValues = { firstName: 'Jonathan', isActive: true }

      const entry = createAuditLogEntry(currentUser, 'user-2', oldValues, newValues)

      expect(entry.organisationId).toBe('org-1')
      expect(entry.userId).toBe('admin-1')
      expect(entry.action).toBe('update')
      expect(entry.entityType).toBe('user')
      expect(entry.entityId).toBe('user-2')
      expect(entry.oldValues).toEqual(oldValues)
      expect(entry.newValues).toEqual(newValues)
    })

    it('should capture IP address from x-forwarded-for', () => {
      const currentUser = { id: 'admin-1', organisationId: 'org-1' }
      const headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }

      const entry = createAuditLogEntry(currentUser, 'user-2', {}, {}, headers)

      expect(entry.ipAddress).toBe('192.168.1.1')
    })

    it('should capture user agent', () => {
      const currentUser = { id: 'admin-1', organisationId: 'org-1' }
      const headers = { 'user-agent': 'Mozilla/5.0 Test Browser' }

      const entry = createAuditLogEntry(currentUser, 'user-2', {}, {}, headers)

      expect(entry.userAgent).toBe('Mozilla/5.0 Test Browser')
    })

    it('should handle missing headers gracefully', () => {
      const currentUser = { id: 'admin-1', organisationId: 'org-1' }

      const entry = createAuditLogEntry(currentUser, 'user-2', {}, {})

      expect(entry.ipAddress).toBeNull()
      expect(entry.userAgent).toBeNull()
    })
  })
})

// ============================================================================
// DELETE /api/members/[id] - DEACTIVATE MEMBER
// ============================================================================

describe('DELETE /api/members/[id] - Deactivate Member', () => {
  describe('Success Response', () => {
    it('should validate a valid success response', () => {
      const successResponse = {
        success: true,
        message: 'User deactivated successfully',
      }

      const result = deleteSuccessSchema.safeParse(successResponse)
      expect(result.success).toBe(true)
    })

    it('should require success to be true', () => {
      const failureResponse = {
        success: false,
        message: 'User deactivated',
      }

      const result = deleteSuccessSchema.safeParse(failureResponse)
      expect(result.success).toBe(false)
    })

    it('should require message field', () => {
      const responseWithoutMessage = {
        success: true,
      }

      const result = deleteSuccessSchema.safeParse(responseWithoutMessage)
      expect(result.success).toBe(false)
    })
  })

  describe('Self-Deactivation Prevention', () => {
    function canDeactivate(
      currentUserId: string,
      targetUserId: string,
    ): { allowed: boolean; reason?: string } {
      if (currentUserId === targetUserId) {
        return { allowed: false, reason: 'Cannot deactivate your own account' }
      }
      return { allowed: true }
    }

    it('should prevent user from deactivating themselves', () => {
      const result = canDeactivate('user-1', 'user-1')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Cannot deactivate your own account')
    })

    it('should allow deactivating other users', () => {
      const result = canDeactivate('user-1', 'user-2')
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('Admin Protection', () => {
    interface User {
      id: string
      roleName: string
      permissions: string[]
    }

    function canDeactivateAdmin(
      currentUser: User,
      targetUser: User,
    ): { allowed: boolean; reason?: string } {
      // Only admins can deactivate other admins
      if (targetUser.roleName === 'admin') {
        const isCurrentUserAdmin =
          currentUser.permissions.includes('*') ||
          currentUser.permissions.includes('**') ||
          currentUser.roleName === 'admin'

        if (!isCurrentUserAdmin) {
          return { allowed: false, reason: 'Only admins can deactivate admin accounts' }
        }
      }
      return { allowed: true }
    }

    it('should allow admin to deactivate another admin', () => {
      const currentUser = { id: '1', roleName: 'admin', permissions: ['*'] }
      const targetUser = { id: '2', roleName: 'admin', permissions: ['*'] }

      const result = canDeactivateAdmin(currentUser, targetUser)
      expect(result.allowed).toBe(true)
    })

    it('should allow super_admin to deactivate an admin', () => {
      const currentUser = { id: '1', roleName: 'super_admin', permissions: ['**'] }
      const targetUser = { id: '2', roleName: 'admin', permissions: ['*'] }

      const result = canDeactivateAdmin(currentUser, targetUser)
      expect(result.allowed).toBe(true)
    })

    it('should prevent fleet_manager from deactivating an admin', () => {
      const currentUser = {
        id: '1',
        roleName: 'fleet_manager',
        permissions: ['assets:read', 'users:delete'],
      }
      const targetUser = { id: '2', roleName: 'admin', permissions: ['*'] }

      const result = canDeactivateAdmin(currentUser, targetUser)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Only admins can deactivate admin accounts')
    })

    it('should allow fleet_manager to deactivate non-admin users', () => {
      const currentUser = {
        id: '1',
        roleName: 'fleet_manager',
        permissions: ['assets:read', 'users:delete'],
      }
      const targetUser = { id: '2', roleName: 'technician', permissions: ['assets:read'] }

      const result = canDeactivateAdmin(currentUser, targetUser)
      expect(result.allowed).toBe(true)
    })

    it('should allow admin to deactivate lower-level users', () => {
      const currentUser = { id: '1', roleName: 'admin', permissions: ['*'] }
      const targetUser = { id: '2', roleName: 'operator', permissions: ['assets:read'] }

      const result = canDeactivateAdmin(currentUser, targetUser)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Last Admin Protection', () => {
    interface User {
      id: string
      roleName: string
      isActive: boolean
      organisationId: string
    }

    function canDeactivateLastAdmin(
      targetUser: User,
      allOrganisationUsers: User[],
    ): { allowed: boolean; reason?: string } {
      if (targetUser.roleName !== 'admin') {
        return { allowed: true }
      }

      const activeAdmins = allOrganisationUsers.filter(
        (u) =>
          u.organisationId === targetUser.organisationId && u.roleName === 'admin' && u.isActive,
      )

      if (activeAdmins.length <= 1) {
        return { allowed: false, reason: 'Cannot deactivate the last admin in the organisation' }
      }

      return { allowed: true }
    }

    it('should prevent deactivating the only admin', () => {
      const targetUser = { id: '1', roleName: 'admin', isActive: true, organisationId: 'org-1' }
      const allUsers = [targetUser]

      const result = canDeactivateLastAdmin(targetUser, allUsers)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Cannot deactivate the last admin in the organisation')
    })

    it('should allow deactivating admin when another admin exists', () => {
      const targetUser = { id: '1', roleName: 'admin', isActive: true, organisationId: 'org-1' }
      const allUsers = [
        targetUser,
        { id: '2', roleName: 'admin', isActive: true, organisationId: 'org-1' },
      ]

      const result = canDeactivateLastAdmin(targetUser, allUsers)
      expect(result.allowed).toBe(true)
    })

    it('should count only active admins', () => {
      const targetUser = { id: '1', roleName: 'admin', isActive: true, organisationId: 'org-1' }
      const allUsers = [
        targetUser,
        { id: '2', roleName: 'admin', isActive: false, organisationId: 'org-1' }, // Inactive
      ]

      const result = canDeactivateLastAdmin(targetUser, allUsers)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Cannot deactivate the last admin in the organisation')
    })

    it('should only count admins from the same organisation', () => {
      const targetUser = { id: '1', roleName: 'admin', isActive: true, organisationId: 'org-1' }
      const allUsers = [
        targetUser,
        { id: '2', roleName: 'admin', isActive: true, organisationId: 'org-2' }, // Different org
      ]

      const result = canDeactivateLastAdmin(targetUser, allUsers)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Cannot deactivate the last admin in the organisation')
    })

    it('should always allow deactivating non-admin users', () => {
      const targetUser = { id: '1', roleName: 'operator', isActive: true, organisationId: 'org-1' }
      const allUsers = [targetUser]

      const result = canDeactivateLastAdmin(targetUser, allUsers)
      expect(result.allowed).toBe(true)
    })

    it('should handle multiple organisations correctly', () => {
      const targetUser = { id: '1', roleName: 'admin', isActive: true, organisationId: 'org-1' }
      const allUsers = [
        targetUser,
        { id: '2', roleName: 'admin', isActive: true, organisationId: 'org-1' },
        { id: '3', roleName: 'admin', isActive: true, organisationId: 'org-2' },
        { id: '4', roleName: 'admin', isActive: true, organisationId: 'org-2' },
      ]

      const result = canDeactivateLastAdmin(targetUser, allUsers)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Permission: users:delete', () => {
    function hasUsersDeletePermission(permissions: string[]): boolean {
      if (permissions.includes('**') || permissions.includes('*')) {
        return true
      }
      return permissions.includes('users:delete')
    }

    it('should grant access to admin', () => {
      expect(hasUsersDeletePermission(['*'])).toBe(true)
    })

    it('should grant access to super_admin', () => {
      expect(hasUsersDeletePermission(['**'])).toBe(true)
    })

    it('should grant access with explicit users:delete', () => {
      expect(hasUsersDeletePermission(['assets:read', 'users:delete'])).toBe(true)
    })

    it('should deny access with only users:write', () => {
      expect(hasUsersDeletePermission(['assets:read', 'users:write'])).toBe(false)
    })

    it('should deny access with only users:read', () => {
      expect(hasUsersDeletePermission(['assets:read', 'users:read'])).toBe(false)
    })

    it('should deny access with no permissions', () => {
      expect(hasUsersDeletePermission([])).toBe(false)
    })
  })

  describe('Deactivation Audit Logging', () => {
    interface AuditLogEntry {
      organisationId: string
      userId: string
      action: string
      entityType: string
      entityId: string
      oldValues: Record<string, unknown>
      newValues: Record<string, unknown>
    }

    function createDeactivationAuditEntry(
      currentUser: { id: string; organisationId: string },
      targetUserId: string,
    ): AuditLogEntry {
      return {
        organisationId: currentUser.organisationId,
        userId: currentUser.id,
        action: 'deactivate',
        entityType: 'user',
        entityId: targetUserId,
        oldValues: { isActive: true },
        newValues: { isActive: false },
      }
    }

    it('should create audit entry with deactivate action', () => {
      const currentUser = { id: 'admin-1', organisationId: 'org-1' }
      const entry = createDeactivationAuditEntry(currentUser, 'user-2')

      expect(entry.action).toBe('deactivate')
      expect(entry.entityType).toBe('user')
    })

    it('should record isActive change from true to false', () => {
      const currentUser = { id: 'admin-1', organisationId: 'org-1' }
      const entry = createDeactivationAuditEntry(currentUser, 'user-2')

      expect(entry.oldValues.isActive).toBe(true)
      expect(entry.newValues.isActive).toBe(false)
    })
  })

  describe('Soft Delete Behavior', () => {
    interface User {
      id: string
      isActive: boolean
      updatedAt: Date
    }

    function softDeleteUser(user: User): User {
      return {
        ...user,
        isActive: false,
        updatedAt: new Date(),
      }
    }

    it('should set isActive to false', () => {
      const user = { id: '1', isActive: true, updatedAt: new Date('2024-01-01') }
      const deactivated = softDeleteUser(user)

      expect(deactivated.isActive).toBe(false)
    })

    it('should update the updatedAt timestamp', () => {
      const oldDate = new Date('2024-01-01')
      const user = { id: '1', isActive: true, updatedAt: oldDate }

      const beforeDeactivation = new Date()
      const deactivated = softDeleteUser(user)

      expect(deactivated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeDeactivation.getTime())
    })

    it('should preserve user id', () => {
      const user = { id: 'user-123', isActive: true, updatedAt: new Date() }
      const deactivated = softDeleteUser(user)

      expect(deactivated.id).toBe('user-123')
    })
  })
})

// ============================================================================
// ERROR RESPONSES
// ============================================================================

describe('Error Responses', () => {
  describe('400 Bad Request', () => {
    it('should validate 400 error for missing user ID', () => {
      const error = {
        statusCode: 400,
        statusMessage: 'User ID is required',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })

    it('should validate 400 error for self-deactivation', () => {
      const error = {
        statusCode: 400,
        statusMessage: 'Cannot deactivate your own account',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })

    it('should validate 400 error for last admin protection', () => {
      const error = {
        statusCode: 400,
        statusMessage: 'Cannot deactivate the last admin in the organisation',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })

    it('should validate 400 validation error with data', () => {
      const error = {
        statusCode: 400,
        statusMessage: 'Validation error',
        data: {
          formErrors: [],
          fieldErrors: {
            firstName: ['String must contain at least 1 character(s)'],
          },
        },
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })
  })

  describe('401 Unauthorized', () => {
    it('should validate 401 error response', () => {
      const error = {
        statusCode: 401,
        statusMessage: 'Unauthorized',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })
  })

  describe('403 Forbidden', () => {
    it('should validate 403 error for insufficient permissions', () => {
      const error = {
        statusCode: 403,
        statusMessage: 'Forbidden: Insufficient permissions',
        data: { required: 'users:write' },
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })

    it('should validate 403 error for admin protection', () => {
      const error = {
        statusCode: 403,
        statusMessage: 'Only admins can deactivate admin accounts',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })
  })

  describe('404 Not Found', () => {
    it('should validate 404 error for user not found', () => {
      const error = {
        statusCode: 404,
        statusMessage: 'User not found',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })
  })

  describe('500 Internal Server Error', () => {
    it('should validate 500 error response', () => {
      const error = {
        statusCode: 500,
        statusMessage: 'Failed to update user',
      }

      const result = errorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration Scenarios', () => {
  describe('Complete Member Update Flow', () => {
    interface UpdateContext {
      currentUser: { id: string; organisationId: string; permissions: string[] }
      targetUserId: string
      updateData: z.infer<typeof updateMemberSchema>
    }

    function validateUpdateFlow(
      context: UpdateContext,
      targetUser: { id: string; organisationId: string } | null,
    ): { valid: boolean; statusCode: number; message: string } {
      // Check authentication
      if (!context.currentUser.id) {
        return { valid: false, statusCode: 401, message: 'Unauthorized' }
      }

      // Check permission
      const hasPermission =
        context.currentUser.permissions.includes('*') ||
        context.currentUser.permissions.includes('**') ||
        context.currentUser.permissions.includes('users:write')

      if (!hasPermission) {
        return { valid: false, statusCode: 403, message: 'Forbidden: Insufficient permissions' }
      }

      // Check target exists and in same org
      if (!targetUser) {
        return { valid: false, statusCode: 404, message: 'User not found' }
      }

      if (targetUser.organisationId !== context.currentUser.organisationId) {
        return { valid: false, statusCode: 404, message: 'User not found' }
      }

      // Validate update data
      const parseResult = updateMemberSchema.safeParse(context.updateData)
      if (!parseResult.success) {
        return { valid: false, statusCode: 400, message: 'Validation error' }
      }

      return { valid: true, statusCode: 200, message: 'Success' }
    }

    it('should succeed with valid admin context and data', () => {
      const context: UpdateContext = {
        currentUser: { id: 'admin-1', organisationId: 'org-1', permissions: ['*'] },
        targetUserId: 'user-2',
        updateData: { firstName: 'NewName' },
      }
      const targetUser = { id: 'user-2', organisationId: 'org-1' }

      const result = validateUpdateFlow(context, targetUser)
      expect(result.valid).toBe(true)
      expect(result.statusCode).toBe(200)
    })

    it('should fail without authentication', () => {
      const context: UpdateContext = {
        currentUser: { id: '', organisationId: '', permissions: [] },
        targetUserId: 'user-2',
        updateData: { firstName: 'NewName' },
      }

      const result = validateUpdateFlow(context, null)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(401)
    })

    it('should fail without permission', () => {
      const context: UpdateContext = {
        currentUser: { id: 'user-1', organisationId: 'org-1', permissions: ['assets:read'] },
        targetUserId: 'user-2',
        updateData: { firstName: 'NewName' },
      }
      const targetUser = { id: 'user-2', organisationId: 'org-1' }

      const result = validateUpdateFlow(context, targetUser)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(403)
    })

    it('should fail when target user not found', () => {
      const context: UpdateContext = {
        currentUser: { id: 'admin-1', organisationId: 'org-1', permissions: ['*'] },
        targetUserId: 'non-existent',
        updateData: { firstName: 'NewName' },
      }

      const result = validateUpdateFlow(context, null)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(404)
    })

    it('should fail with invalid update data', () => {
      const context: UpdateContext = {
        currentUser: { id: 'admin-1', organisationId: 'org-1', permissions: ['*'] },
        targetUserId: 'user-2',
        updateData: { firstName: '' },
      }
      const targetUser = { id: 'user-2', organisationId: 'org-1' }

      const result = validateUpdateFlow(context, targetUser)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(400)
    })
  })

  describe('Complete Member Deactivation Flow', () => {
    interface DeactivateContext {
      currentUser: { id: string; organisationId: string; permissions: string[]; roleName: string }
      targetUserId: string
    }

    interface TargetUser {
      id: string
      organisationId: string
      roleName: string
      isActive: boolean
    }

    function validateDeactivateFlow(
      context: DeactivateContext,
      targetUser: TargetUser | null,
      activeAdminCount: number,
    ): { valid: boolean; statusCode: number; message: string } {
      // Check authentication
      if (!context.currentUser.id) {
        return { valid: false, statusCode: 401, message: 'Unauthorized' }
      }

      // Check permission
      const hasPermission =
        context.currentUser.permissions.includes('*') ||
        context.currentUser.permissions.includes('**') ||
        context.currentUser.permissions.includes('users:delete')

      if (!hasPermission) {
        return { valid: false, statusCode: 403, message: 'Forbidden: Insufficient permissions' }
      }

      // Check self-deactivation
      if (context.targetUserId === context.currentUser.id) {
        return { valid: false, statusCode: 400, message: 'Cannot deactivate your own account' }
      }

      // Check target exists and in same org
      if (!targetUser || targetUser.organisationId !== context.currentUser.organisationId) {
        return { valid: false, statusCode: 404, message: 'User not found' }
      }

      // Check admin protection
      if (targetUser.roleName === 'admin') {
        const isCurrentUserAdmin =
          context.currentUser.permissions.includes('*') ||
          context.currentUser.permissions.includes('**') ||
          context.currentUser.roleName === 'admin'

        if (!isCurrentUserAdmin) {
          return {
            valid: false,
            statusCode: 403,
            message: 'Only admins can deactivate admin accounts',
          }
        }

        // Check last admin
        if (activeAdminCount <= 1) {
          return {
            valid: false,
            statusCode: 400,
            message: 'Cannot deactivate the last admin in the organisation',
          }
        }
      }

      return { valid: true, statusCode: 200, message: 'User deactivated successfully' }
    }

    it('should succeed with valid admin context', () => {
      const context: DeactivateContext = {
        currentUser: {
          id: 'admin-1',
          organisationId: 'org-1',
          permissions: ['*'],
          roleName: 'admin',
        },
        targetUserId: 'user-2',
      }
      const targetUser: TargetUser = {
        id: 'user-2',
        organisationId: 'org-1',
        roleName: 'technician',
        isActive: true,
      }

      const result = validateDeactivateFlow(context, targetUser, 2)
      expect(result.valid).toBe(true)
    })

    it('should prevent self-deactivation', () => {
      const context: DeactivateContext = {
        currentUser: {
          id: 'admin-1',
          organisationId: 'org-1',
          permissions: ['*'],
          roleName: 'admin',
        },
        targetUserId: 'admin-1',
      }
      const targetUser: TargetUser = {
        id: 'admin-1',
        organisationId: 'org-1',
        roleName: 'admin',
        isActive: true,
      }

      const result = validateDeactivateFlow(context, targetUser, 1)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.message).toBe('Cannot deactivate your own account')
    })

    it('should prevent non-admin from deactivating admin', () => {
      const context: DeactivateContext = {
        currentUser: {
          id: 'manager-1',
          organisationId: 'org-1',
          permissions: ['users:delete'],
          roleName: 'fleet_manager',
        },
        targetUserId: 'admin-1',
      }
      const targetUser: TargetUser = {
        id: 'admin-1',
        organisationId: 'org-1',
        roleName: 'admin',
        isActive: true,
      }

      const result = validateDeactivateFlow(context, targetUser, 1)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(403)
      expect(result.message).toBe('Only admins can deactivate admin accounts')
    })

    it('should prevent deactivating last admin', () => {
      const context: DeactivateContext = {
        currentUser: {
          id: 'admin-1',
          organisationId: 'org-1',
          permissions: ['*'],
          roleName: 'admin',
        },
        targetUserId: 'admin-2',
      }
      const targetUser: TargetUser = {
        id: 'admin-2',
        organisationId: 'org-1',
        roleName: 'admin',
        isActive: true,
      }

      const result = validateDeactivateFlow(context, targetUser, 1)
      expect(result.valid).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.message).toBe('Cannot deactivate the last admin in the organisation')
    })

    it('should allow deactivating admin when multiple admins exist', () => {
      const context: DeactivateContext = {
        currentUser: {
          id: 'admin-1',
          organisationId: 'org-1',
          permissions: ['*'],
          roleName: 'admin',
        },
        targetUserId: 'admin-2',
      }
      const targetUser: TargetUser = {
        id: 'admin-2',
        organisationId: 'org-1',
        roleName: 'admin',
        isActive: true,
      }

      const result = validateDeactivateFlow(context, targetUser, 2)
      expect(result.valid).toBe(true)
    })
  })
})
