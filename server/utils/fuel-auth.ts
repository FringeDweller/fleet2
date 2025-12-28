import { and, eq, inArray, lt } from 'drizzle-orm'
import type { FuelAuthorization } from '../db/schema/fuel-authorizations'
import { db, schema } from './db'

/**
 * Default authorization expiry time in minutes
 */
export const DEFAULT_AUTH_EXPIRY_MINUTES = 30

/**
 * Characters used for auth code generation (excluding similar-looking characters like 0/O, 1/I/l)
 */
const AUTH_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generate a unique 6-character alphanumeric auth code
 * Uses a character set that excludes ambiguous characters (0/O, 1/I/l)
 */
export function generateAuthCode(): string {
  let code = ''
  const chars = AUTH_CODE_CHARS
  const length = 6

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    code += chars[randomIndex]
  }

  return code
}

/**
 * Generate a unique auth code that doesn't exist in the database
 * Retries up to 10 times before throwing an error
 */
export async function generateUniqueAuthCode(): Promise<string> {
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateAuthCode()

    // Check if code already exists (in pending or authorized status)
    const existing = await db.query.fuelAuthorizations.findFirst({
      where: and(
        eq(schema.fuelAuthorizations.authCode, code),
        inArray(schema.fuelAuthorizations.status, ['pending', 'authorized']),
      ),
    })

    if (!existing) {
      return code
    }
  }

  throw new Error('Failed to generate unique auth code after maximum attempts')
}

/**
 * QR code data payload structure
 */
export interface QRCodePayload {
  /** Version for forward compatibility */
  v: number
  /** Authorization code */
  code: string
  /** Asset ID */
  assetId: string
  /** Asset number/identifier for display */
  assetNumber: string
  /** Operator name for verification */
  operatorName: string
  /** Organisation ID */
  orgId: string
  /** Expiry timestamp (ISO 8601) */
  expiresAt: string
  /** Optional pre-auth limit in litres */
  maxLitres?: string
  /** Optional pre-auth limit in dollars */
  maxDollars?: string
}

/**
 * Generate QR code data JSON payload for a fuel authorization
 */
export function generateQRCodeData(
  authCode: string,
  assetId: string,
  assetNumber: string,
  operatorName: string,
  organisationId: string,
  expiresAt: Date,
  maxQuantityLitres?: string | null,
  maxAmountDollars?: string | null,
): string {
  const payload: QRCodePayload = {
    v: 1,
    code: authCode,
    assetId,
    assetNumber,
    operatorName,
    orgId: organisationId,
    expiresAt: expiresAt.toISOString(),
  }

  if (maxQuantityLitres) {
    payload.maxLitres = maxQuantityLitres
  }

  if (maxAmountDollars) {
    payload.maxDollars = maxAmountDollars
  }

  return JSON.stringify(payload)
}

/**
 * Parse QR code data back to payload object
 */
export function parseQRCodeData(qrCodeData: string): QRCodePayload | null {
  try {
    const payload = JSON.parse(qrCodeData)

    // Validate required fields
    if (!payload.v || !payload.code || !payload.assetId || !payload.orgId || !payload.expiresAt) {
      return null
    }

    return payload as QRCodePayload
  } catch {
    return null
  }
}

/**
 * Authorization validation result
 */
export interface AuthorizationValidationResult {
  valid: boolean
  authorization?: FuelAuthorization & {
    asset: {
      id: string
      assetNumber: string
      make: string | null
      model: string | null
    }
    operator: {
      id: string
      firstName: string
      lastName: string
      email: string
    }
    operatorSession: {
      id: string
      startTime: Date
      status: 'active' | 'completed' | 'cancelled'
    }
  }
  error?: string
  errorCode?:
    | 'NOT_FOUND'
    | 'EXPIRED'
    | 'ALREADY_COMPLETED'
    | 'ALREADY_CANCELLED'
    | 'INVALID_STATUS'
    | 'SESSION_ENDED'
}

/**
 * Validate a fuel authorization by auth code
 * Returns the authorization with related data if valid
 */
export async function validateAuthorization(
  authCode: string,
): Promise<AuthorizationValidationResult> {
  // Find authorization with related data
  const authorization = await db.query.fuelAuthorizations.findFirst({
    where: eq(schema.fuelAuthorizations.authCode, authCode.toUpperCase()),
    with: {
      asset: {
        columns: {
          id: true,
          assetNumber: true,
          make: true,
          model: true,
        },
      },
      operator: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      operatorSession: {
        columns: {
          id: true,
          startTime: true,
          status: true,
        },
      },
    },
  })

  if (!authorization) {
    return {
      valid: false,
      error: 'Authorization not found',
      errorCode: 'NOT_FOUND',
    }
  }

  // Check if expired
  if (new Date() > authorization.expiresAt) {
    // Update status to expired if it was pending/authorized
    if (authorization.status === 'pending' || authorization.status === 'authorized') {
      await db
        .update(schema.fuelAuthorizations)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(schema.fuelAuthorizations.id, authorization.id))
    }

    return {
      valid: false,
      error: 'Authorization has expired',
      errorCode: 'EXPIRED',
    }
  }

  // Check status
  if (authorization.status === 'completed') {
    return {
      valid: false,
      error: 'Authorization has already been completed',
      errorCode: 'ALREADY_COMPLETED',
    }
  }

  if (authorization.status === 'cancelled') {
    return {
      valid: false,
      error: 'Authorization has been cancelled',
      errorCode: 'ALREADY_CANCELLED',
    }
  }

  if (authorization.status === 'expired') {
    return {
      valid: false,
      error: 'Authorization has expired',
      errorCode: 'EXPIRED',
    }
  }

  // Check if operator session is still active
  if (authorization.operatorSession.status !== 'active') {
    return {
      valid: false,
      error: 'Operator session has ended',
      errorCode: 'SESSION_ENDED',
    }
  }

  // Valid authorization
  return {
    valid: true,
    authorization: authorization as AuthorizationValidationResult['authorization'],
  }
}

/**
 * Mark authorization as authorized (after bowser validation)
 */
export async function markAsAuthorized(authorizationId: string): Promise<void> {
  await db
    .update(schema.fuelAuthorizations)
    .set({
      status: 'authorized',
      authorizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.fuelAuthorizations.id, authorizationId))
}

/**
 * Mark authorization as completed and link to fuel transaction
 */
export async function markAsCompleted(
  authorizationId: string,
  fuelTransactionId: string,
): Promise<void> {
  await db
    .update(schema.fuelAuthorizations)
    .set({
      status: 'completed',
      fuelTransactionId,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.fuelAuthorizations.id, authorizationId))
}

/**
 * Mark authorization as cancelled
 */
export async function markAsCancelled(authorizationId: string): Promise<void> {
  await db
    .update(schema.fuelAuthorizations)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.fuelAuthorizations.id, authorizationId))
}

/**
 * Expire all authorizations that are past their expiry time
 * This can be run as a scheduled job
 */
export async function expireStaleAuthorizations(): Promise<number> {
  const result = await db
    .update(schema.fuelAuthorizations)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(schema.fuelAuthorizations.status, ['pending', 'authorized']),
        lt(schema.fuelAuthorizations.expiresAt, new Date()),
      ),
    )
    .returning({ id: schema.fuelAuthorizations.id })

  return result.length
}

/**
 * Calculate expiry time from now
 */
export function calculateExpiryTime(minutes: number = DEFAULT_AUTH_EXPIRY_MINUTES): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}
