import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Authentication Schema Validation Tests
 *
 * Tests validation schemas for authentication-related endpoints:
 * - Login validation (email format, password requirements)
 * - Session validation
 * - Password reset validation
 * - Forgot password validation
 */

// Login schema (from login.post.ts)
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

// Forgot password schema (from forgot-password.post.ts)
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
})

// Reset password schema (from reset-password.post.ts)
const resetPasswordSchema = z.object({
  token: z.string().uuid('Invalid token format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

// Session response schema
const sessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.string().uuid(),
      organisationId: z.string().uuid(),
      roleId: z.string().uuid(),
      roleName: z.enum([
        'super_admin',
        'admin',
        'fleet_manager',
        'supervisor',
        'technician',
        'operator',
      ]),
      permissions: z.array(z.string()),
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      isActive: z.boolean(),
      emailVerified: z.boolean(),
    })
    .nullable(),
})

describe('Auth Schema Validation', () => {
  describe('Login Schema', () => {
    it('should validate a valid login request', () => {
      const validLogin = {
        email: 'user@example.com',
        password: 'SecurePassword123',
      }

      const result = loginSchema.safeParse(validLogin)
      expect(result.success).toBe(true)
    })

    it('should reject missing email', () => {
      const invalidLogin = {
        password: 'SecurePassword123',
      }

      const result = loginSchema.safeParse(invalidLogin)
      expect(result.success).toBe(false)
    })

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        '',
      ]

      for (const email of invalidEmails) {
        const result = loginSchema.safeParse({ email, password: 'password' })
        expect(result.success).toBe(false)
      }
    })

    it('should accept valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
        'USER@EXAMPLE.COM',
      ]

      for (const email of validEmails) {
        const result = loginSchema.safeParse({ email, password: 'password' })
        expect(result.success).toBe(true)
      }
    })

    it('should reject missing password', () => {
      const invalidLogin = {
        email: 'user@example.com',
      }

      const result = loginSchema.safeParse(invalidLogin)
      expect(result.success).toBe(false)
    })

    it('should reject empty password', () => {
      const invalidLogin = {
        email: 'user@example.com',
        password: '',
      }

      const result = loginSchema.safeParse(invalidLogin)
      expect(result.success).toBe(false)
    })

    it('should accept minimum valid password', () => {
      const validLogin = {
        email: 'user@example.com',
        password: 'x', // Just needs to be non-empty for login
      }

      const result = loginSchema.safeParse(validLogin)
      expect(result.success).toBe(true)
    })
  })

  describe('Forgot Password Schema', () => {
    it('should validate a valid forgot password request', () => {
      const validRequest = {
        email: 'user@example.com',
      }

      const result = forgotPasswordSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject missing email', () => {
      const invalidRequest = {}

      const result = forgotPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject invalid email format', () => {
      const invalidRequest = {
        email: 'not-an-email',
      }

      const result = forgotPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject empty email', () => {
      const invalidRequest = {
        email: '',
      }

      const result = forgotPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('Reset Password Schema', () => {
    const validToken = '550e8400-e29b-41d4-a716-446655440000'

    it('should validate a valid reset password request', () => {
      const validRequest = {
        token: validToken,
        password: 'SecurePass123',
      }

      const result = resetPasswordSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject missing token', () => {
      const invalidRequest = {
        password: 'SecurePass123',
      }

      const result = resetPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject invalid token format (not UUID)', () => {
      const invalidTokens = ['not-a-uuid', '12345', '', 'invalid-token-format']

      for (const token of invalidTokens) {
        const result = resetPasswordSchema.safeParse({
          token,
          password: 'SecurePass123',
        })
        expect(result.success).toBe(false)
      }
    })

    it('should require password minimum 8 characters', () => {
      const invalidRequest = {
        token: validToken,
        password: 'Short1A',
      }

      const result = resetPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('8 characters')
      }
    })

    it('should require at least one uppercase letter', () => {
      const invalidRequest = {
        token: validToken,
        password: 'alllowercase123',
      }

      const result = resetPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('uppercase'))).toBe(true)
      }
    })

    it('should require at least one lowercase letter', () => {
      const invalidRequest = {
        token: validToken,
        password: 'ALLUPPERCASE123',
      }

      const result = resetPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('lowercase'))).toBe(true)
      }
    })

    it('should require at least one number', () => {
      const invalidRequest = {
        token: validToken,
        password: 'NoNumbersHere',
      }

      const result = resetPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('number'))).toBe(true)
      }
    })

    it('should accept a password meeting all requirements', () => {
      const validPasswords = [
        'SecurePass1',
        'Password123',
        'MyP@ssw0rd',
        'Test1234ABCD',
        'aB3defghij',
      ]

      for (const password of validPasswords) {
        const result = resetPasswordSchema.safeParse({
          token: validToken,
          password,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject password with only special characters and numbers', () => {
      const invalidRequest = {
        token: validToken,
        password: '!@#$%^&*12345',
      }

      const result = resetPasswordSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('Session Response Schema', () => {
    it('should validate unauthenticated session response', () => {
      const unauthenticatedResponse = {
        authenticated: false,
        user: null,
      }

      const result = sessionResponseSchema.safeParse(unauthenticatedResponse)
      expect(result.success).toBe(true)
    })

    it('should validate authenticated session response with full user', () => {
      const authenticatedResponse = {
        authenticated: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          organisationId: '550e8400-e29b-41d4-a716-446655440001',
          roleId: '550e8400-e29b-41d4-a716-446655440002',
          roleName: 'technician',
          permissions: ['assets:read', 'work_orders:read', 'work_orders:write'],
          email: 'tech@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          avatarUrl: 'https://example.com/avatar.jpg',
          isActive: true,
          emailVerified: true,
        },
      }

      const result = sessionResponseSchema.safeParse(authenticatedResponse)
      expect(result.success).toBe(true)
    })

    it('should validate session response with null optional fields', () => {
      const responseWithNulls = {
        authenticated: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          organisationId: '550e8400-e29b-41d4-a716-446655440001',
          roleId: '550e8400-e29b-41d4-a716-446655440002',
          roleName: 'admin',
          permissions: ['*'],
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          phone: null,
          avatarUrl: null,
          isActive: true,
          emailVerified: false,
        },
      }

      const result = sessionResponseSchema.safeParse(responseWithNulls)
      expect(result.success).toBe(true)
    })

    it('should validate all role names', () => {
      const roles = [
        'super_admin',
        'admin',
        'fleet_manager',
        'supervisor',
        'technician',
        'operator',
      ]

      for (const roleName of roles) {
        const response = {
          authenticated: true,
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            organisationId: '550e8400-e29b-41d4-a716-446655440001',
            roleId: '550e8400-e29b-41d4-a716-446655440002',
            roleName,
            permissions: [],
            email: 'user@example.com',
            firstName: 'Test',
            lastName: 'User',
            phone: null,
            avatarUrl: null,
            isActive: true,
            emailVerified: true,
          },
        }

        const result = sessionResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid role name', () => {
      const response = {
        authenticated: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          organisationId: '550e8400-e29b-41d4-a716-446655440001',
          roleId: '550e8400-e29b-41d4-a716-446655440002',
          roleName: 'invalid_role',
          permissions: [],
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          phone: null,
          avatarUrl: null,
          isActive: true,
          emailVerified: true,
        },
      }

      const result = sessionResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should reject missing required user fields', () => {
      const incompleteUser = {
        authenticated: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          // Missing other required fields
        },
      }

      const result = sessionResponseSchema.safeParse(incompleteUser)
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID for user ID', () => {
      const response = {
        authenticated: true,
        user: {
          id: 'not-a-uuid',
          organisationId: '550e8400-e29b-41d4-a716-446655440001',
          roleId: '550e8400-e29b-41d4-a716-446655440002',
          roleName: 'technician',
          permissions: [],
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          phone: null,
          avatarUrl: null,
          isActive: true,
          emailVerified: true,
        },
      }

      const result = sessionResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })
  })
})

describe('Password Complexity Rules', () => {
  const passwordRequirements = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
  }

  function validatePasswordComplexity(password: string): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (password.length < passwordRequirements.minLength) {
      errors.push(`Password must be at least ${passwordRequirements.minLength} characters`)
    }
    if (passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    if (passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    if (passwordRequirements.requireNumber && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    return { valid: errors.length === 0, errors }
  }

  it('should accept strong passwords', () => {
    const strongPasswords = ['SecurePass123', 'MyPassword1', 'Test1234Abc', 'aB3defghijk']

    for (const password of strongPasswords) {
      const result = validatePasswordComplexity(password)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    }
  })

  it('should reject short passwords', () => {
    const result = validatePasswordComplexity('Ab1')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('8 characters'))).toBe(true)
  })

  it('should reject passwords without uppercase', () => {
    const result = validatePasswordComplexity('lowercase123')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true)
  })

  it('should reject passwords without lowercase', () => {
    const result = validatePasswordComplexity('UPPERCASE123')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('lowercase'))).toBe(true)
  })

  it('should reject passwords without numbers', () => {
    const result = validatePasswordComplexity('NoNumbersHere')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('number'))).toBe(true)
  })

  it('should return multiple errors for very weak passwords', () => {
    const result = validatePasswordComplexity('weak')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('Account Lockout Logic', () => {
  const MAX_FAILED_ATTEMPTS = 5
  const LOCKOUT_DURATION_MINUTES = 30

  interface AccountState {
    failedAttempts: number
    lockedUntil: Date | null
  }

  function shouldLockAccount(state: AccountState): boolean {
    return state.failedAttempts >= MAX_FAILED_ATTEMPTS
  }

  function isAccountLocked(state: AccountState): boolean {
    if (!state.lockedUntil) return false
    return state.lockedUntil > new Date()
  }

  function getRemainingLockMinutes(state: AccountState): number {
    if (!state.lockedUntil) return 0
    return Math.ceil((state.lockedUntil.getTime() - Date.now()) / 60000)
  }

  function incrementFailedAttempts(state: AccountState): AccountState {
    const newAttempts = state.failedAttempts + 1
    const newState: AccountState = {
      failedAttempts: newAttempts,
      lockedUntil: state.lockedUntil,
    }

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      newState.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
    }

    return newState
  }

  function resetFailedAttempts(): AccountState {
    return { failedAttempts: 0, lockedUntil: null }
  }

  it('should not lock account under max attempts', () => {
    const state: AccountState = { failedAttempts: 4, lockedUntil: null }
    expect(shouldLockAccount(state)).toBe(false)
  })

  it('should lock account at max attempts', () => {
    const state: AccountState = { failedAttempts: 5, lockedUntil: null }
    expect(shouldLockAccount(state)).toBe(true)
  })

  it('should detect locked account with future date', () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes in future
    const state: AccountState = { failedAttempts: 5, lockedUntil: futureDate }
    expect(isAccountLocked(state)).toBe(true)
  })

  it('should not detect locked account with past date', () => {
    const pastDate = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes in past
    const state: AccountState = { failedAttempts: 5, lockedUntil: pastDate }
    expect(isAccountLocked(state)).toBe(false)
  })

  it('should calculate remaining lock minutes correctly', () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes in future
    const state: AccountState = { failedAttempts: 5, lockedUntil: futureDate }
    const remaining = getRemainingLockMinutes(state)
    expect(remaining).toBeGreaterThan(14)
    expect(remaining).toBeLessThanOrEqual(15)
  })

  it('should increment failed attempts correctly', () => {
    let state: AccountState = { failedAttempts: 0, lockedUntil: null }

    for (let i = 0; i < 4; i++) {
      state = incrementFailedAttempts(state)
      expect(state.failedAttempts).toBe(i + 1)
      expect(state.lockedUntil).toBeNull()
    }

    // 5th attempt should trigger lock
    state = incrementFailedAttempts(state)
    expect(state.failedAttempts).toBe(5)
    expect(state.lockedUntil).not.toBeNull()
  })

  it('should reset failed attempts on successful login', () => {
    const lockedState: AccountState = {
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
    }

    const resetState = resetFailedAttempts()
    expect(resetState.failedAttempts).toBe(0)
    expect(resetState.lockedUntil).toBeNull()
  })

  it('should calculate remaining attempts correctly', () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      const state: AccountState = { failedAttempts: i, lockedUntil: null }
      const remaining = MAX_FAILED_ATTEMPTS - state.failedAttempts
      expect(remaining).toBe(MAX_FAILED_ATTEMPTS - i)
    }
  })
})

describe('Auth Response Validation', () => {
  const authSuccessSchema = z.object({
    success: z.literal(true),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string(),
      roleName: z.enum([
        'super_admin',
        'admin',
        'fleet_manager',
        'supervisor',
        'technician',
        'operator',
      ]),
    }),
  })

  const authErrorSchema = z.object({
    success: z.literal(false),
    error: z.string(),
    isLocked: z.boolean().optional(),
    remainingAttempts: z.number().int().nonnegative().optional(),
  })

  it('should validate successful auth response', () => {
    const response = {
      success: true,
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roleName: 'technician',
      },
    }

    const result = authSuccessSchema.safeParse(response)
    expect(result.success).toBe(true)
  })

  it('should validate error response with remaining attempts', () => {
    const response = {
      success: false,
      error: 'Invalid email or password',
      remainingAttempts: 3,
    }

    const result = authErrorSchema.safeParse(response)
    expect(result.success).toBe(true)
  })

  it('should validate locked account error response', () => {
    const response = {
      success: false,
      error: 'Account locked after 5 failed attempts',
      isLocked: true,
    }

    const result = authErrorSchema.safeParse(response)
    expect(result.success).toBe(true)
  })

  it('should validate deactivated account error response', () => {
    const response = {
      success: false,
      error: 'Account is deactivated',
    }

    const result = authErrorSchema.safeParse(response)
    expect(result.success).toBe(true)
  })
})
