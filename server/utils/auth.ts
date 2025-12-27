import { hash, verify } from '@node-rs/argon2'
import { db, schema } from './db'
import { eq, and, gt } from 'drizzle-orm'
import type { SafeUser } from '../db/schema/users'

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1
}

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 30

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await verify(hash, password)
  } catch {
    return false
  }
}

export interface AuthResult {
  success: boolean
  user?: SafeUser
  error?: string
  isLocked?: boolean
  remainingAttempts?: number
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
    with: {
      role: true,
      organisation: true
    }
  })

  if (!user) {
    return { success: false, error: 'Invalid email or password' }
  }

  // Check if user is active
  if (!user.isActive) {
    return { success: false, error: 'Account is deactivated' }
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return {
      success: false,
      error: `Account is locked. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`,
      isLocked: true
    }
  }

  // Verify password
  const isValid = await verifyPassword(user.passwordHash, password)

  if (!isValid) {
    // Increment failed attempts
    const newFailedAttempts = user.failedLoginAttempts + 1
    const updates: Partial<typeof schema.users.$inferInsert> = {
      failedLoginAttempts: newFailedAttempts,
      updatedAt: new Date()
    }

    // Lock account if max attempts exceeded
    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
    }

    await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id))

    const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      return {
        success: false,
        error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes`,
        isLocked: true
      }
    }

    return {
      success: false,
      error: 'Invalid email or password',
      remainingAttempts: Math.max(0, remainingAttempts)
    }
  }

  // Reset failed attempts on successful login
  await db
    .update(schema.users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, user.id))

  // Return safe user (without sensitive fields)
  const safeUser: SafeUser = {
    id: user.id,
    organisationId: user.organisationId,
    roleId: user.roleId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }

  return { success: true, user: safeUser }
}

export async function getUserById(userId: string): Promise<SafeUser | null> {
  const user = await db.query.users.findFirst({
    where: and(eq(schema.users.id, userId), eq(schema.users.isActive, true))
  })

  if (!user) return null

  return {
    id: user.id,
    organisationId: user.organisationId,
    roleId: user.roleId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

export async function generatePasswordResetToken(email: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase())
  })

  if (!user) return null

  // Generate a random token
  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

  await db
    .update(schema.users)
    .set({
      passwordResetToken: token,
      passwordResetExpires: expires,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, user.id))

  return token
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: and(
      eq(schema.users.passwordResetToken, token),
      gt(schema.users.passwordResetExpires, new Date())
    )
  })

  if (!user) return false

  const passwordHash = await hashPassword(newPassword)

  await db
    .update(schema.users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, user.id))

  return true
}
