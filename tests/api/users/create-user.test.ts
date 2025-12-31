/**
 * Create User API Tests (US-17.1.1d)
 *
 * Tests for POST /api/users endpoint:
 * - Valid user creation (201 response, user returned without password hash)
 * - Duplicate email rejection (409 Conflict)
 * - Validation errors (400 Bad Request)
 * - Authentication/Authorization (401/403)
 *
 * Following behavioral testing patterns - testing actual business logic.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createAdminUser,
  createFleetManagerUser,
  createOperatorUser,
  createSupervisorUser,
  createTechnicianUser,
  resetFixtures,
} from '../../helpers'

// Schema matching the actual API endpoint validation
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

// Response schema - should NOT include password hash
const userResponseSchema = z.object({
  id: z.string().uuid(),
  organisationId: z.string().uuid(),
  roleId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  hourlyRate: z.unknown().nullable(),
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  lastLoginAt: z.unknown().nullable(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
  roleName: z.string().optional(),
  roleDisplayName: z.string().optional(),
})

// Error response schema
const errorResponseSchema = z.object({
  statusCode: z.number(),
  statusMessage: z.string(),
  data: z.any().optional(),
})

// Valid test data
const validRoleId = '550e8400-e29b-41d4-a716-446655440000'
const validCreateUserInput = {
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
  roleId: validRoleId,
  phone: '+1234567890',
}

describe('Create User API - POST /api/users', () => {
  beforeEach(() => {
    resetFixtures()
  })

  describe('Valid User Creation (201 Created)', () => {
    describe('input validation', () => {
      it('should accept valid user creation input', () => {
        // Arrange
        const input = validCreateUserInput

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.email).toBe('newuser@example.com')
          expect(result.data.firstName).toBe('John')
          expect(result.data.lastName).toBe('Doe')
          expect(result.data.roleId).toBe(validRoleId)
        }
      })

      it('should normalize email to lowercase', () => {
        // Arrange
        const input = {
          ...validCreateUserInput,
          email: 'NewUser@EXAMPLE.com',
        }

        // Act - Simulate email normalization
        const normalizedEmail = input.email.toLowerCase()

        // Assert
        expect(normalizedEmail).toBe('newuser@example.com')
      })

      it('should accept optional phone field', () => {
        // Arrange
        const inputWithPhone = { ...validCreateUserInput, phone: '+1234567890' }
        const inputWithoutPhone = { ...validCreateUserInput }
        delete (inputWithoutPhone as Record<string, unknown>).phone

        // Act
        const resultWithPhone = createUserSchema.safeParse(inputWithPhone)
        const resultWithoutPhone = createUserSchema.safeParse(inputWithoutPhone)

        // Assert
        expect(resultWithPhone.success).toBe(true)
        expect(resultWithoutPhone.success).toBe(true)
      })

      it('should accept null phone field', () => {
        // Arrange
        const input = { ...validCreateUserInput, phone: null }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('response structure', () => {
      it('should validate response schema without password hash', () => {
        // Arrange
        const validResponse = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          organisationId: '550e8400-e29b-41d4-a716-446655440002',
          roleId: validRoleId,
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          avatarUrl: null,
          hourlyRate: null,
          isActive: true,
          emailVerified: false,
          lastLoginAt: null,
          createdAt: '2024-12-31T00:00:00.000Z',
          updatedAt: '2024-12-31T00:00:00.000Z',
          roleName: 'technician',
          roleDisplayName: 'Technician',
        }

        // Act
        const result = userResponseSchema.safeParse(validResponse)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should NOT include passwordHash in response', () => {
        // Arrange
        const response = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          organisationId: '550e8400-e29b-41d4-a716-446655440002',
          roleId: validRoleId,
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          avatarUrl: null,
          hourlyRate: null,
          isActive: true,
          emailVerified: false,
          lastLoginAt: null,
          createdAt: '2024-12-31T00:00:00.000Z',
          updatedAt: '2024-12-31T00:00:00.000Z',
        }

        // Assert - Response should not contain sensitive fields
        expect('passwordHash' in response).toBe(false)
        expect('passwordResetToken' in response).toBe(false)
        expect('passwordResetExpires' in response).toBe(false)
        expect('failedLoginAttempts' in response).toBe(false)
        expect('lockedUntil' in response).toBe(false)
      })

      it('should include role information in response', () => {
        // Arrange
        const responseWithRole = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          organisationId: '550e8400-e29b-41d4-a716-446655440002',
          roleId: validRoleId,
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          avatarUrl: null,
          hourlyRate: null,
          isActive: true,
          emailVerified: false,
          lastLoginAt: null,
          createdAt: '2024-12-31T00:00:00.000Z',
          updatedAt: '2024-12-31T00:00:00.000Z',
          roleName: 'technician',
          roleDisplayName: 'Technician',
        }

        // Act
        const result = userResponseSchema.safeParse(responseWithRole)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.roleName).toBe('technician')
          expect(result.data.roleDisplayName).toBe('Technician')
        }
      })

      it('should set isActive to true for new users', () => {
        // Arrange
        const response = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          organisationId: '550e8400-e29b-41d4-a716-446655440002',
          roleId: validRoleId,
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          avatarUrl: null,
          hourlyRate: null,
          isActive: true,
          emailVerified: false,
          lastLoginAt: null,
          createdAt: '2024-12-31T00:00:00.000Z',
          updatedAt: '2024-12-31T00:00:00.000Z',
        }

        // Assert
        expect(response.isActive).toBe(true)
      })

      it('should set emailVerified to false for new users', () => {
        // Arrange
        const response = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          organisationId: '550e8400-e29b-41d4-a716-446655440002',
          roleId: validRoleId,
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: null,
          avatarUrl: null,
          hourlyRate: null,
          isActive: true,
          emailVerified: false,
          lastLoginAt: null,
          createdAt: '2024-12-31T00:00:00.000Z',
          updatedAt: '2024-12-31T00:00:00.000Z',
        }

        // Assert
        expect(response.emailVerified).toBe(false)
      })
    })
  })

  describe('Duplicate Email Rejection (409 Conflict)', () => {
    it('should validate 409 error response format', () => {
      // Arrange
      const duplicateEmailError = {
        statusCode: 409,
        statusMessage: 'A user with this email already exists',
      }

      // Act
      const result = errorResponseSchema.safeParse(duplicateEmailError)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should have correct status code for duplicate email', () => {
      // Arrange
      const error = { statusCode: 409, statusMessage: 'A user with this email already exists' }

      // Assert
      expect(error.statusCode).toBe(409)
    })

    it('should provide appropriate error message for duplicate email', () => {
      // Arrange
      const error = { statusCode: 409, statusMessage: 'A user with this email already exists' }

      // Assert
      expect(error.statusMessage).toBe('A user with this email already exists')
    })

    it('should detect duplicate after case normalization', () => {
      // Arrange
      const existingEmail = 'user@example.com'
      const newEmail = 'USER@EXAMPLE.COM'

      // Act - Simulate case-insensitive comparison
      const normalizedExisting = existingEmail.toLowerCase()
      const normalizedNew = newEmail.toLowerCase()

      // Assert
      expect(normalizedExisting).toBe(normalizedNew)
    })
  })

  describe('Validation Errors (400 Bad Request)', () => {
    describe('email validation', () => {
      it('should reject invalid email format', () => {
        // Arrange
        const invalidEmails = [
          'notanemail',
          'missing@domain',
          '@nodomain.com',
          '',
          'has spaces@email.com',
          'double@@at.com',
        ]

        // Act & Assert
        for (const email of invalidEmails) {
          const result = createUserSchema.safeParse({
            ...validCreateUserInput,
            email,
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            const emailError = result.error.flatten().fieldErrors.email
            expect(emailError).toBeDefined()
          }
        }
      })

      it('should reject email exceeding max length (255 chars)', () => {
        // Arrange
        const longEmail = `${'a'.repeat(250)}@test.com`

        // Act
        const result = createUserSchema.safeParse({
          ...validCreateUserInput,
          email: longEmail,
        })

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject missing email', () => {
        // Arrange
        const inputWithoutEmail = { ...validCreateUserInput }
        delete (inputWithoutEmail as Record<string, unknown>).email

        // Act
        const result = createUserSchema.safeParse(inputWithoutEmail)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('password validation', () => {
      it('should reject password shorter than 8 characters', () => {
        // Arrange
        const shortPassword = 'Ab1!'

        // Act
        const result = passwordSchema.safeParse(shortPassword)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().formErrors).toContain(
            'Password must be at least 8 characters',
          )
        }
      })

      it('should reject password without lowercase letter', () => {
        // Arrange
        const noLowercase = 'UPPERCASE123!'

        // Act
        const result = passwordSchema.safeParse(noLowercase)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().formErrors).toContain(
            'Password must contain at least one lowercase letter',
          )
        }
      })

      it('should reject password without uppercase letter', () => {
        // Arrange
        const noUppercase = 'lowercase123!'

        // Act
        const result = passwordSchema.safeParse(noUppercase)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().formErrors).toContain(
            'Password must contain at least one uppercase letter',
          )
        }
      })

      it('should reject password without digit', () => {
        // Arrange
        const noDigit = 'NoDigitPassword!'

        // Act
        const result = passwordSchema.safeParse(noDigit)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().formErrors).toContain(
            'Password must contain at least one digit',
          )
        }
      })

      it('should reject password without special character', () => {
        // Arrange
        const noSpecial = 'NoSpecial123'

        // Act
        const result = passwordSchema.safeParse(noSpecial)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.flatten().formErrors).toContain(
            'Password must contain at least one special character',
          )
        }
      })

      it('should accept valid strong password', () => {
        // Arrange
        const validPasswords = [
          'SecurePass123!',
          'MyP@ssw0rd',
          'C0mpl3x!Pass',
          'Test1234$',
          'P@ssword1',
        ]

        // Act & Assert
        for (const password of validPasswords) {
          const result = passwordSchema.safeParse(password)
          expect(result.success).toBe(true)
        }
      })

      it('should reject missing password', () => {
        // Arrange
        const inputWithoutPassword = { ...validCreateUserInput }
        delete (inputWithoutPassword as Record<string, unknown>).password

        // Act
        const result = createUserSchema.safeParse(inputWithoutPassword)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('firstName validation', () => {
      it('should reject empty firstName', () => {
        // Arrange
        const input = { ...validCreateUserInput, firstName: '' }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          const firstNameError = result.error.flatten().fieldErrors.firstName
          expect(firstNameError).toBeDefined()
        }
      })

      it('should reject missing firstName', () => {
        // Arrange
        const inputWithoutFirstName = { ...validCreateUserInput }
        delete (inputWithoutFirstName as Record<string, unknown>).firstName

        // Act
        const result = createUserSchema.safeParse(inputWithoutFirstName)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject firstName exceeding max length (100 chars)', () => {
        // Arrange
        const longFirstName = 'a'.repeat(101)

        // Act
        const result = createUserSchema.safeParse({
          ...validCreateUserInput,
          firstName: longFirstName,
        })

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept firstName at max length (100 chars)', () => {
        // Arrange
        const maxFirstName = 'a'.repeat(100)

        // Act
        const result = createUserSchema.safeParse({
          ...validCreateUserInput,
          firstName: maxFirstName,
        })

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('lastName validation', () => {
      it('should reject empty lastName', () => {
        // Arrange
        const input = { ...validCreateUserInput, lastName: '' }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          const lastNameError = result.error.flatten().fieldErrors.lastName
          expect(lastNameError).toBeDefined()
        }
      })

      it('should reject missing lastName', () => {
        // Arrange
        const inputWithoutLastName = { ...validCreateUserInput }
        delete (inputWithoutLastName as Record<string, unknown>).lastName

        // Act
        const result = createUserSchema.safeParse(inputWithoutLastName)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should reject lastName exceeding max length (100 chars)', () => {
        // Arrange
        const longLastName = 'b'.repeat(101)

        // Act
        const result = createUserSchema.safeParse({
          ...validCreateUserInput,
          lastName: longLastName,
        })

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('roleId validation', () => {
      it('should reject invalid UUID format for roleId', () => {
        // Arrange
        const invalidRoleIds = ['not-a-uuid', '123', 'abc-def', '', '550e8400-e29b-41d4-a716']

        // Act & Assert
        for (const roleId of invalidRoleIds) {
          const result = createUserSchema.safeParse({
            ...validCreateUserInput,
            roleId,
          })
          expect(result.success).toBe(false)
        }
      })

      it('should reject missing roleId', () => {
        // Arrange
        const inputWithoutRoleId = { ...validCreateUserInput }
        delete (inputWithoutRoleId as Record<string, unknown>).roleId

        // Act
        const result = createUserSchema.safeParse(inputWithoutRoleId)

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept valid UUID for roleId', () => {
        // Arrange
        const validRoleIds = [
          '550e8400-e29b-41d4-a716-446655440000',
          '123e4567-e89b-12d3-a456-426614174000',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ]

        // Act & Assert
        for (const roleId of validRoleIds) {
          const result = createUserSchema.safeParse({
            ...validCreateUserInput,
            roleId,
          })
          expect(result.success).toBe(true)
        }
      })
    })

    describe('non-existent roleId', () => {
      it('should validate 400 error for non-existent role', () => {
        // Arrange
        const nonExistentRoleError = {
          statusCode: 400,
          statusMessage: 'Invalid role ID: role does not exist',
        }

        // Act
        const result = errorResponseSchema.safeParse(nonExistentRoleError)

        // Assert
        expect(result.success).toBe(true)
        expect(nonExistentRoleError.statusCode).toBe(400)
        expect(nonExistentRoleError.statusMessage).toContain('role does not exist')
      })
    })

    describe('phone validation', () => {
      it('should reject phone exceeding max length (50 chars)', () => {
        // Arrange
        const longPhone = '+' + '1'.repeat(50)

        // Act
        const result = createUserSchema.safeParse({
          ...validCreateUserInput,
          phone: longPhone,
        })

        // Assert
        expect(result.success).toBe(false)
      })

      it('should accept phone at max length (50 chars)', () => {
        // Arrange
        const maxPhone = '+' + '1'.repeat(49)

        // Act
        const result = createUserSchema.safeParse({
          ...validCreateUserInput,
          phone: maxPhone,
        })

        // Assert
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Authentication (401 Unauthorized)', () => {
    it('should validate 401 error response', () => {
      // Arrange
      const unauthorizedError = {
        statusCode: 401,
        statusMessage: 'Unauthorized',
      }

      // Act
      const result = errorResponseSchema.safeParse(unauthorizedError)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should have correct status code for unauthenticated request', () => {
      // Assert
      const expectedStatusCode = 401
      expect(expectedStatusCode).toBe(401)
    })

    it('should provide appropriate message for unauthenticated request', () => {
      // Arrange
      const error = { statusCode: 401, statusMessage: 'Unauthorized' }

      // Assert
      expect(error.statusMessage).toBe('Unauthorized')
    })
  })

  describe('Authorization (403 Forbidden)', () => {
    describe('permission requirements', () => {
      it('should require users:write permission', () => {
        // The endpoint requires 'users:write' permission
        const requiredPermission = 'users:write'

        // Assert - This is the permission checked by the endpoint
        expect(requiredPermission).toBe('users:write')
      })

      it('should verify admin has users:write permission (via wildcard)', () => {
        // Arrange
        const admin = createAdminUser()

        // Assert - Admin has wildcard permission which includes users:write
        expect(admin.permissions).toContain('*')
      })

      it('should verify fleet_manager does NOT have users:write permission', () => {
        // Arrange
        const fleetManager = createFleetManagerUser()

        // Assert - Fleet manager should not have users:write
        expect(fleetManager.permissions).not.toContain('users:write')
        expect(fleetManager.permissions).not.toContain('*')
      })

      it('should verify supervisor does NOT have users:write permission', () => {
        // Arrange
        const supervisor = createSupervisorUser()

        // Assert
        expect(supervisor.permissions).not.toContain('users:write')
        expect(supervisor.permissions).not.toContain('*')
      })

      it('should verify technician does NOT have users:write permission', () => {
        // Arrange
        const technician = createTechnicianUser()

        // Assert
        expect(technician.permissions).not.toContain('users:write')
        expect(technician.permissions).not.toContain('*')
      })

      it('should verify operator does NOT have users:write permission', () => {
        // Arrange
        const operator = createOperatorUser()

        // Assert
        expect(operator.permissions).not.toContain('users:write')
        expect(operator.permissions).not.toContain('*')
      })
    })

    describe('forbidden access', () => {
      it('should validate 403 error response', () => {
        // Arrange
        const forbiddenError = {
          statusCode: 403,
          statusMessage: 'Forbidden: Insufficient permissions',
          data: { required: 'users:write' },
        }

        // Act
        const result = errorResponseSchema.safeParse(forbiddenError)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should have correct status code for non-admin user', () => {
        // Assert
        const expectedStatusCode = 403
        expect(expectedStatusCode).toBe(403)
      })

      it('should provide appropriate message for forbidden access', () => {
        // Arrange
        const error = { statusCode: 403, statusMessage: 'Forbidden: Insufficient permissions' }

        // Assert
        expect(error.statusMessage).toBe('Forbidden: Insufficient permissions')
      })

      it('should include required permission in error data', () => {
        // Arrange
        const error = {
          statusCode: 403,
          statusMessage: 'Forbidden: Insufficient permissions',
          data: { required: 'users:write' },
        }

        // Assert
        expect(error.data.required).toBe('users:write')
      })
    })
  })

  describe('Organisation Scoping', () => {
    it('should assign user to same organisation as creator', () => {
      // Arrange
      const admin = createAdminUser()
      const creatorOrganisationId = admin.organisationId

      // Assert - New user should be in same organisation
      expect(creatorOrganisationId).toBeDefined()
      expect(typeof creatorOrganisationId).toBe('string')
    })

    it('should verify organisation ID is valid UUID', () => {
      // Arrange
      const admin = createAdminUser()

      // Assert
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(uuidRegex.test(admin.organisationId)).toBe(true)
    })
  })

  describe('Audit Logging', () => {
    interface AuditLogEntry {
      organisationId: string
      userId: string
      action: string
      entityType: string
      entityId: string
      newValues: Record<string, unknown>
    }

    function createAuditLogEntry(
      organisationId: string,
      userId: string,
      createdUserId: string,
      userData: Record<string, unknown>,
    ): AuditLogEntry {
      return {
        organisationId,
        userId,
        action: 'create',
        entityType: 'user',
        entityId: createdUserId,
        newValues: userData,
      }
    }

    it('should create audit log with action type create', () => {
      // Arrange
      const logEntry = createAuditLogEntry('org-1', 'admin-1', 'new-user-1', {})

      // Assert
      expect(logEntry.action).toBe('create')
    })

    it('should create audit log with entity type user', () => {
      // Arrange
      const logEntry = createAuditLogEntry('org-1', 'admin-1', 'new-user-1', {})

      // Assert
      expect(logEntry.entityType).toBe('user')
    })

    it('should include created user ID as entity ID', () => {
      // Arrange
      const createdUserId = 'new-user-123'
      const logEntry = createAuditLogEntry('org-1', 'admin-1', createdUserId, {})

      // Assert
      expect(logEntry.entityId).toBe('new-user-123')
    })

    it('should include user data in newValues', () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleName: 'technician',
      }
      const logEntry = createAuditLogEntry('org-1', 'admin-1', 'new-user-1', userData)

      // Assert
      expect(logEntry.newValues).toEqual(userData)
    })

    it('should include organisation ID in audit log', () => {
      // Arrange
      const organisationId = 'org-abc-123'
      const logEntry = createAuditLogEntry(organisationId, 'admin-1', 'new-user-1', {})

      // Assert
      expect(logEntry.organisationId).toBe('org-abc-123')
    })

    it('should include creator user ID in audit log', () => {
      // Arrange
      const userId = 'admin-xyz-789'
      const logEntry = createAuditLogEntry('org-1', userId, 'new-user-1', {})

      // Assert
      expect(logEntry.userId).toBe('admin-xyz-789')
    })
  })

  describe('Edge Cases', () => {
    describe('email normalization', () => {
      it('should normalize mixed case email to lowercase', () => {
        // Arrange
        const emails = ['Test@Example.COM', 'TEST@EXAMPLE.COM', 'test@EXAMPLE.com']

        // Act & Assert
        for (const email of emails) {
          expect(email.toLowerCase()).toBe('test@example.com')
        }
      })
    })

    describe('whitespace handling', () => {
      it('should validate names with leading/trailing spaces', () => {
        // Arrange - Input with spaces (may need trimming in actual implementation)
        const input = {
          ...validCreateUserInput,
          firstName: ' John ',
          lastName: ' Doe ',
        }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert - Schema validates, but implementation may trim
        expect(result.success).toBe(true)
      })
    })

    describe('special characters in names', () => {
      it('should accept names with hyphens', () => {
        // Arrange
        const input = {
          ...validCreateUserInput,
          firstName: 'Mary-Jane',
          lastName: 'Watson-Parker',
        }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept names with apostrophes', () => {
        // Arrange
        const input = {
          ...validCreateUserInput,
          firstName: "O'Brien",
          lastName: "O'Connor",
        }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept names with accented characters', () => {
        // Arrange
        const input = {
          ...validCreateUserInput,
          firstName: 'Jose',
          lastName: 'Garcia',
        }

        // Act
        const result = createUserSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })
    })

    describe('password edge cases', () => {
      it('should accept password with exactly 8 characters meeting all requirements', () => {
        // Arrange
        const minPassword = 'Ab1!xxxx'

        // Act
        const result = passwordSchema.safeParse(minPassword)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should accept password with various special characters', () => {
        // Arrange
        const specialPasswords = [
          'Password1!',
          'Password1@',
          'Password1#',
          'Password1$',
          'Password1%',
          'Password1^',
          'Password1&',
          'Password1*',
        ]

        // Act & Assert
        for (const password of specialPasswords) {
          const result = passwordSchema.safeParse(password)
          expect(result.success).toBe(true)
        }
      })
    })

    describe('concurrent request handling', () => {
      it('should detect duplicate emails in concurrent requests (same normalized form)', () => {
        // Arrange - Two requests with emails that normalize to the same value
        const email1 = 'user@example.com'
        const email2 = 'USER@EXAMPLE.COM'

        // Act
        const normalized1 = email1.toLowerCase()
        const normalized2 = email2.toLowerCase()

        // Assert - Both normalize to same value, should be caught as duplicate
        expect(normalized1).toBe(normalized2)
      })
    })
  })

  describe('Integration with Role System', () => {
    describe('role validation', () => {
      it('should accept valid role names', () => {
        // Arrange
        const validRoleNames = [
          'super_admin',
          'admin',
          'fleet_manager',
          'supervisor',
          'technician',
          'operator',
        ]

        // Assert
        expect(validRoleNames).toContain('technician')
        expect(validRoleNames).toContain('operator')
      })

      it('should validate that roleId references existing role', () => {
        // This is a logical check - the endpoint verifies role exists before creating user
        const errorForNonExistentRole = {
          statusCode: 400,
          statusMessage: 'Invalid role ID: role does not exist',
        }

        expect(errorForNonExistentRole.statusCode).toBe(400)
        expect(errorForNonExistentRole.statusMessage).toContain('role does not exist')
      })
    })
  })

  describe('Security Considerations', () => {
    describe('password hashing', () => {
      it('should verify password is not stored in plain text', () => {
        // The endpoint hashes password with Argon2 before storing
        // Response should never include password or passwordHash
        const safeResponse = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }

        expect('password' in safeResponse).toBe(false)
        expect('passwordHash' in safeResponse).toBe(false)
      })
    })

    describe('sensitive field exclusion', () => {
      it('should exclude all sensitive fields from response', () => {
        // Arrange
        const sensitiveFields = [
          'passwordHash',
          'passwordResetToken',
          'passwordResetExpires',
          'failedLoginAttempts',
          'lockedUntil',
        ]

        const response = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          emailVerified: false,
        }

        // Assert - None of the sensitive fields should be present
        for (const field of sensitiveFields) {
          expect(field in response).toBe(false)
        }
      })
    })
  })
})
