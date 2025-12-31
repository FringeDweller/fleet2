/**
 * Encryption Utilities
 *
 * Provides encryption and decryption functions for sensitive data.
 * Uses AES-256-GCM for symmetric encryption with authenticated encryption.
 *
 * Key management:
 * - Encryption key is stored in environment variable NUXT_ENCRYPTION_KEY
 * - Key should be a 32-byte (256-bit) random value, base64 encoded
 * - Generate with: openssl rand -base64 32
 *
 * Usage:
 * - Use for encrypting sensitive fields before storing in database
 * - Examples: SSN, tax IDs, API keys, tokens
 *
 * @see US-18.2.2 Data at Rest Encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32 // 256 bits
const KEY_LENGTH = 32 // 256 bits for AES-256

// Version prefix for encrypted data (for future algorithm upgrades)
const VERSION_PREFIX = 'v1:'

/**
 * Get the encryption key from environment
 * Derives a 256-bit key using scrypt if the provided key is not 32 bytes
 */
function getEncryptionKey(): Buffer {
  const configKey = process.env.NUXT_ENCRYPTION_KEY

  if (!configKey) {
    throw new Error(
      'NUXT_ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: openssl rand -base64 32',
    )
  }

  // Try to decode as base64
  const keyBuffer = Buffer.from(configKey, 'base64')

  // If already 32 bytes, use directly
  if (keyBuffer.length === KEY_LENGTH) {
    return keyBuffer
  }

  // Otherwise, derive a key using scrypt with a fixed salt
  // (Using a fixed salt is acceptable here since the input key should be random)
  const derivedKey = scryptSync(configKey, 'fleet2-key-derivation', KEY_LENGTH)
  return derivedKey
}

/**
 * Encrypt a plaintext string
 *
 * Returns a string in the format: v1:base64(salt):base64(iv):base64(authTag):base64(encrypted)
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string with version, salt, IV, auth tag, and ciphertext
 *
 * @example
 * ```ts
 * const encrypted = encrypt('sensitive-data')
 * // Store in database
 * await db.update(users).set({ ssn: encrypted })
 * ```
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return ''

  try {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    // Combine all parts with version prefix
    return `${VERSION_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt an encrypted string
 *
 * @param encrypted - The encrypted string from encrypt()
 * @returns The original plaintext string
 *
 * @example
 * ```ts
 * const ssn = decrypt(user.ssn)
 * // Use the decrypted value
 * ```
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) return ''

  try {
    // Check version prefix
    if (!encrypted.startsWith(VERSION_PREFIX)) {
      throw new Error('Invalid encrypted data format or unsupported version')
    }

    // Remove version prefix and split parts
    const parts = encrypted.slice(VERSION_PREFIX.length).split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }

    const ivBase64 = parts[0]!
    const authTagBase64 = parts[1]!
    const ciphertext = parts[2]!

    const key = getEncryptionKey()
    const iv = Buffer.from(ivBase64, 'base64')
    const authTag = Buffer.from(authTagBase64, 'base64')

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = decipher.update(ciphertext, 'base64', 'utf8') + decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Check if a string is encrypted (has our version prefix)
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(VERSION_PREFIX) || false
}

/**
 * Hash a value for secure comparison (one-way)
 * Uses scrypt with a random salt
 *
 * @param value - The value to hash
 * @returns Hash string in format: base64(salt):base64(hash)
 */
export function hashValue(value: string): string {
  if (!value) return ''

  const salt = randomBytes(SALT_LENGTH)
  const hash = scryptSync(value, salt, 64)

  return `${salt.toString('base64')}:${hash.toString('base64')}`
}

/**
 * Verify a value against a hash
 *
 * @param value - The value to verify
 * @param storedHash - The hash from hashValue()
 * @returns True if the value matches the hash
 */
export function verifyHash(value: string, storedHash: string): boolean {
  if (!value || !storedHash) return false

  try {
    const parts = storedHash.split(':')
    if (parts.length !== 2) return false

    const saltBase64 = parts[0]
    const hashBase64 = parts[1]
    if (!saltBase64 || !hashBase64) return false

    const salt = Buffer.from(saltBase64, 'base64')
    const expectedHash = Buffer.from(hashBase64, 'base64')

    const actualHash = scryptSync(value, salt, 64)

    // Timing-safe comparison
    if (actualHash.length !== expectedHash.length) return false

    let result = 0
    for (let i = 0; i < actualHash.length; i++) {
      result |= (actualHash[i] ?? 0) ^ (expectedHash[i] ?? 0)
    }

    return result === 0
  } catch {
    return false
  }
}

/**
 * Generate a secure random token
 *
 * @param length - Length of the token in bytes (default: 32)
 * @returns Base64-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url')
}

/**
 * Mask sensitive data for logging/display
 * Shows only the last N characters
 *
 * @param value - The sensitive value
 * @param visibleChars - Number of characters to show (default: 4)
 * @returns Masked string like "****1234"
 */
export function maskSensitiveData(value: string, visibleChars: number = 4): string {
  if (!value) return ''
  if (value.length <= visibleChars) return '*'.repeat(value.length)

  const masked = '*'.repeat(value.length - visibleChars)
  const visible = value.slice(-visibleChars)
  return masked + visible
}

/**
 * Encryption utilities composable for use in server routes
 */
export function useEncryption() {
  return {
    encrypt,
    decrypt,
    isEncrypted,
    hashValue,
    verifyHash,
    generateSecureToken,
    maskSensitiveData,
  }
}
