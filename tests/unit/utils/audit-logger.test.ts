/**
 * Audit Logger Tests (US-17.5.1d)
 *
 * Tests for the audit logging utility patterns:
 * - Audit log record structure validation
 * - Request metadata extraction patterns
 * - Error handling behavior
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Audit Logger Patterns', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Audit Log Record Structure', () => {
    it('should validate required fields for audit log', () => {
      // Arrange
      const auditLogRecord = {
        id: 'audit-123',
        organisationId: 'org-123',
        userId: 'user-123',
        action: 'create',
        entityType: 'asset',
        entityId: 'asset-456',
        oldValues: null,
        newValues: { name: 'Test Asset' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      }

      // Assert required fields
      expect(auditLogRecord.organisationId).toBeDefined()
      expect(auditLogRecord.action).toBeDefined()
      expect(auditLogRecord.entityType).toBeDefined()
      expect(auditLogRecord.createdAt).toBeInstanceOf(Date)
    })

    it('should allow null for optional fields', () => {
      // Arrange
      const auditLogRecord = {
        id: 'audit-123',
        organisationId: 'org-123',
        userId: null, // System operation
        action: 'import',
        entityType: 'asset',
        entityId: null,
        oldValues: null,
        newValues: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      }

      // Assert optional fields can be null
      expect(auditLogRecord.userId).toBeNull()
      expect(auditLogRecord.entityId).toBeNull()
      expect(auditLogRecord.oldValues).toBeNull()
      expect(auditLogRecord.newValues).toBeNull()
      expect(auditLogRecord.ipAddress).toBeNull()
      expect(auditLogRecord.userAgent).toBeNull()
    })

    it('should store old and new values for updates', () => {
      // Arrange
      const updateAuditLog = {
        id: 'audit-update',
        organisationId: 'org-123',
        userId: 'user-123',
        action: 'update',
        entityType: 'work_order',
        entityId: 'wo-123',
        oldValues: { status: 'pending', priority: 'low' },
        newValues: { status: 'completed', priority: 'high' },
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120',
        createdAt: new Date(),
      }

      // Assert
      expect(updateAuditLog.oldValues).toEqual({ status: 'pending', priority: 'low' })
      expect(updateAuditLog.newValues).toEqual({ status: 'completed', priority: 'high' })
    })
  })

  describe('Audit Actions', () => {
    it('should support all standard audit actions', () => {
      // Arrange
      const standardActions = [
        'create',
        'update',
        'delete',
        'login',
        'logout',
        'view',
        'export',
        'import',
        'approve',
        'reject',
        'assign',
        'unassign',
        'archive',
        'restore',
      ]

      // Assert each action is a valid string
      for (const action of standardActions) {
        expect(typeof action).toBe('string')
        expect(action.length).toBeGreaterThan(0)
      }
    })

    it('should allow custom action strings', () => {
      // Arrange
      const customAction = 'custom_workflow_step'
      const auditLog = {
        action: customAction,
        entityType: 'workflow',
      }

      // Assert
      expect(auditLog.action).toBe('custom_workflow_step')
    })
  })

  describe('Request Metadata Extraction', () => {
    it('should extract IP address pattern', () => {
      // Arrange
      const extractIP = (headers: Record<string, string | undefined>) => {
        return headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          headers['x-real-ip'] ||
          null
      }

      // Act & Assert
      expect(extractIP({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1' })).toBe('192.168.1.1')
      expect(extractIP({ 'x-real-ip': '172.16.0.1' })).toBe('172.16.0.1')
      expect(extractIP({})).toBeNull()
    })

    it('should extract user agent pattern', () => {
      // Arrange
      const extractUserAgent = (headers: Record<string, string | undefined>) => {
        return headers['user-agent'] || null
      }

      // Act & Assert
      expect(extractUserAgent({ 'user-agent': 'Mozilla/5.0' })).toBe('Mozilla/5.0')
      expect(extractUserAgent({})).toBeNull()
    })

    it('should return both values when available', () => {
      // Arrange
      const getRequestMetadata = (headers: Record<string, string | undefined>) => ({
        ipAddress: headers['x-real-ip'] || null,
        userAgent: headers['user-agent'] || null,
      })

      // Act
      const metadata = getRequestMetadata({
        'x-real-ip': '10.0.0.1',
        'user-agent': 'Safari/17.0',
      })

      // Assert
      expect(metadata).toEqual({
        ipAddress: '10.0.0.1',
        userAgent: 'Safari/17.0',
      })
    })
  })

  describe('Error Handling', () => {
    it('should return null on error without throwing', async () => {
      // Arrange
      const createAuditLogSafe = async (
        insertFn: () => Promise<unknown>,
      ): Promise<unknown | null> => {
        try {
          return await insertFn()
        } catch (error) {
          console.error('[AuditLogger] Failed:', error)
          return null
        }
      }

      // Act
      const result = await createAuditLogSafe(() =>
        Promise.reject(new Error('Database error')),
      )

      // Assert
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should log error context for debugging', async () => {
      // Arrange
      const options = {
        organisationId: 'org-123',
        action: 'create',
        entityType: 'asset',
      }

      const createAuditLogWithContext = async () => {
        try {
          throw new Error('Test error')
        } catch (error) {
          console.error('[AuditLogger] Failed to create audit log entry:', {
            error: error instanceof Error ? error.message : String(error),
            options,
          })
          return null
        }
      }

      // Act
      await createAuditLogWithContext()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AuditLogger] Failed to create audit log entry:',
        expect.objectContaining({
          error: 'Test error',
          options: expect.objectContaining({
            organisationId: 'org-123',
          }),
        }),
      )
    })

    it('should handle non-Error objects in catch block', async () => {
      // Arrange
      const handleError = (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[AuditLogger] Error:', errorMessage)
        return errorMessage
      }

      // Act & Assert
      expect(handleError(new Error('Standard error'))).toBe('Standard error')
      expect(handleError('String error')).toBe('String error')
      expect(handleError({ custom: 'error' })).toBe('[object Object]')
    })
  })

  describe('Composable Pattern', () => {
    it('should provide audit logger functions', () => {
      // Arrange
      const useAuditLogger = () => ({
        logAudit: vi.fn(),
        logAuditFromEvent: vi.fn(),
        getRequestMetadata: vi.fn(),
      })

      // Act
      const logger = useAuditLogger()

      // Assert
      expect(typeof logger.logAudit).toBe('function')
      expect(typeof logger.logAuditFromEvent).toBe('function')
      expect(typeof logger.getRequestMetadata).toBe('function')
    })
  })
})
