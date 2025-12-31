import { hash, verify } from '@node-rs/argon2'
import { and, eq, gt } from 'drizzle-orm'
import { DEFAULT_ROLE_PERMISSIONS, type RoleName } from '../db/schema/roles'
import type { SafeUser, SafeUserWithRole } from '../db/schema/users'
import { db, schema } from './db'

// Argon2 configuration (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
}

// Account lockout configuration (per user/email)
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 30

// ---------------------------------------------------------------------------
// Brute Force Protection (IP-based)
// ---------------------------------------------------------------------------
// Prevents attackers from trying multiple usernames from same IP
// Uses exponential backoff for increasing delays

/** Configuration for IP-based brute force protection */
const BRUTE_FORCE_CONFIG = {
  /** Initial number of allowed attempts before delays start */
  initialAttempts: 5,
  /** Maximum number of attempts before IP is blocked */
  maxAttempts: 20,
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: 1000,
  /** Maximum delay in milliseconds (5 minutes) */
  maxDelayMs: 5 * 60 * 1000,
  /** Time window in milliseconds for tracking attempts (1 hour) */
  windowMs: 60 * 60 * 1000,
  /** Cleanup interval in milliseconds (5 minutes) */
  cleanupIntervalMs: 5 * 60 * 1000,
}

/** In-memory store for tracking login attempts by IP */
interface BruteForceEntry {
  /** Number of failed attempts */
  attempts: number
  /** Timestamp of first attempt in current window */
  firstAttemptAt: number
  /** Timestamp of last attempt */
  lastAttemptAt: number
  /** Timestamp until which the IP is blocked */
  blockedUntil: number | null
}

const bruteForceStore = new Map<string, BruteForceEntry>()

// Cleanup interval reference
let bruteForceCleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * Start the cleanup interval for expired brute force entries
 */
function startBruteForceCleanup() {
  if (bruteForceCleanupInterval) return

  bruteForceCleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of bruteForceStore.entries()) {
      // Remove entries that have expired their window
      if (now - entry.firstAttemptAt > BRUTE_FORCE_CONFIG.windowMs) {
        bruteForceStore.delete(key)
      }
    }
  }, BRUTE_FORCE_CONFIG.cleanupIntervalMs)
}

// Start cleanup on module load
startBruteForceCleanup()

/**
 * Calculate delay using exponential backoff
 * @param attempts Number of failed attempts
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempts: number): number {
  if (attempts <= BRUTE_FORCE_CONFIG.initialAttempts) {
    return 0
  }

  // Exponential backoff: baseDelay * 2^(attempts - initialAttempts - 1)
  const exponent = attempts - BRUTE_FORCE_CONFIG.initialAttempts - 1
  const delay = BRUTE_FORCE_CONFIG.baseDelayMs * 2 ** exponent

  return Math.min(delay, BRUTE_FORCE_CONFIG.maxDelayMs)
}

/**
 * Check if a login attempt from the given IP should be blocked
 * @param clientIp The client's IP address
 * @returns Object with blocked status and remaining time if blocked
 */
export function checkBruteForce(clientIp: string): {
  blocked: boolean
  remainingMs?: number
  message?: string
} {
  const now = Date.now()
  const entry = bruteForceStore.get(clientIp)

  if (!entry) {
    return { blocked: false }
  }

  // Check if window has expired - reset if so
  if (now - entry.firstAttemptAt > BRUTE_FORCE_CONFIG.windowMs) {
    bruteForceStore.delete(clientIp)
    return { blocked: false }
  }

  // Check if IP is blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const remainingMs = entry.blockedUntil - now
    const remainingMinutes = Math.ceil(remainingMs / 60000)
    return {
      blocked: true,
      remainingMs,
      message: `Too many login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
    }
  }

  // Check if IP has exceeded max attempts
  if (entry.attempts >= BRUTE_FORCE_CONFIG.maxAttempts) {
    // Block for the maximum delay period
    entry.blockedUntil = now + BRUTE_FORCE_CONFIG.maxDelayMs
    bruteForceStore.set(clientIp, entry)

    const remainingMinutes = Math.ceil(BRUTE_FORCE_CONFIG.maxDelayMs / 60000)
    return {
      blocked: true,
      remainingMs: BRUTE_FORCE_CONFIG.maxDelayMs,
      message: `Account temporarily locked due to too many login attempts. Please try again in ${remainingMinutes} minutes.`,
    }
  }

  // Calculate required delay based on attempts
  const requiredDelay = calculateBackoffDelay(entry.attempts)
  const timeSinceLastAttempt = now - entry.lastAttemptAt

  if (timeSinceLastAttempt < requiredDelay) {
    const remainingMs = requiredDelay - timeSinceLastAttempt
    const remainingSeconds = Math.ceil(remainingMs / 1000)
    return {
      blocked: true,
      remainingMs,
      message: `Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before trying again.`,
    }
  }

  return { blocked: false }
}

/**
 * Record a failed login attempt for the given IP
 * @param clientIp The client's IP address
 */
export function recordFailedAttempt(clientIp: string): void {
  const now = Date.now()
  const existing = bruteForceStore.get(clientIp)

  if (!existing || now - existing.firstAttemptAt > BRUTE_FORCE_CONFIG.windowMs) {
    // Start new tracking window
    bruteForceStore.set(clientIp, {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      blockedUntil: null,
    })
  } else {
    // Increment attempts in current window
    existing.attempts++
    existing.lastAttemptAt = now

    // If max attempts exceeded, set block time
    if (existing.attempts >= BRUTE_FORCE_CONFIG.maxAttempts) {
      existing.blockedUntil = now + BRUTE_FORCE_CONFIG.maxDelayMs
    }

    bruteForceStore.set(clientIp, existing)
  }
}

/**
 * Reset brute force tracking for the given IP on successful login
 * @param clientIp The client's IP address
 */
export function resetBruteForce(clientIp: string): void {
  bruteForceStore.delete(clientIp)
}

/**
 * Get brute force statistics (for monitoring)
 */
export function getBruteForceStats(): {
  trackedIps: number
  blockedIps: number
  totalAttempts: number
} {
  const now = Date.now()
  let blockedIps = 0
  let totalAttempts = 0

  for (const entry of bruteForceStore.values()) {
    totalAttempts += entry.attempts
    if (entry.blockedUntil && now < entry.blockedUntil) {
      blockedIps++
    }
  }

  return {
    trackedIps: bruteForceStore.size,
    blockedIps,
    totalAttempts,
  }
}

// Named to avoid conflict with nuxt-auth-utils exports
export async function hashPasswordArgon2(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPasswordArgon2(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password)
  } catch {
    return false
  }
}

export interface AuthResult {
  success: boolean
  user?: SafeUserWithRole
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
      organisation: true,
    },
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
      isLocked: true,
    }
  }

  // Verify password
  const isValid = await verifyPasswordArgon2(user.passwordHash, password)

  if (!isValid) {
    // Increment failed attempts
    const newFailedAttempts = user.failedLoginAttempts + 1
    const updates: Partial<typeof schema.users.$inferInsert> = {
      failedLoginAttempts: newFailedAttempts,
      updatedAt: new Date(),
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
        isLocked: true,
      }
    }

    return {
      success: false,
      error: 'Invalid email or password',
      remainingAttempts: Math.max(0, remainingAttempts),
    }
  }

  // Reset failed attempts on successful login
  await db
    .update(schema.users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))

  // Get role and permissions
  const roleName = (user.role?.name || 'operator') as RoleName
  const permissions = user.role?.permissions || DEFAULT_ROLE_PERMISSIONS[roleName] || []

  // Return safe user (without sensitive fields) with role info
  const safeUser = {
    id: user.id,
    organisationId: user.organisationId,
    roleId: user.roleId,
    roleName,
    permissions,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    hourlyRate: user.hourlyRate,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }

  return { success: true, user: safeUser }
}

export async function getUserById(userId: string): Promise<SafeUser | null> {
  const user = await db.query.users.findFirst({
    where: and(eq(schema.users.id, userId), eq(schema.users.isActive, true)),
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
    hourlyRate: user.hourlyRate,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export async function generatePasswordResetToken(email: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
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
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))

  return token
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: and(
      eq(schema.users.passwordResetToken, token),
      gt(schema.users.passwordResetExpires, new Date()),
    ),
  })

  if (!user) return false

  const passwordHash = await hashPasswordArgon2(newPassword)

  await db
    .update(schema.users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))

  return true
}
