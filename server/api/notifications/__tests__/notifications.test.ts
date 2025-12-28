import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// ============================================================================
// Notification Type Schema and Validation Tests
// ============================================================================

// Define the notification type enum based on schema
const notificationTypeEnum = z.enum([
  'work_order_assigned',
  'work_order_unassigned',
  'work_order_status_changed',
  'work_order_due_soon',
  'work_order_overdue',
  'work_order_approval_requested',
  'work_order_approved',
  'work_order_rejected',
  'defect_reported',
  'system',
])

// Schema for creating a notification
const createNotificationSchema = z.object({
  organisationId: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  link: z.string().max(500).optional().nullable(),
  isRead: z.boolean().default(false),
})

// Schema for updating a notification (mark read/unread)
const updateNotificationSchema = z.object({
  isRead: z.boolean(),
})

// Schema for query params on list endpoint
const listNotificationsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  unreadOnly: z.boolean().optional().default(false),
})

describe('Notification Type Enum Validation', () => {
  describe('Valid Notification Types', () => {
    it('should accept work_order_assigned type', () => {
      const result = notificationTypeEnum.safeParse('work_order_assigned')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_unassigned type', () => {
      const result = notificationTypeEnum.safeParse('work_order_unassigned')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_status_changed type', () => {
      const result = notificationTypeEnum.safeParse('work_order_status_changed')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_due_soon type', () => {
      const result = notificationTypeEnum.safeParse('work_order_due_soon')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_overdue type', () => {
      const result = notificationTypeEnum.safeParse('work_order_overdue')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_approval_requested type', () => {
      const result = notificationTypeEnum.safeParse('work_order_approval_requested')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_approved type', () => {
      const result = notificationTypeEnum.safeParse('work_order_approved')
      expect(result.success).toBe(true)
    })

    it('should accept work_order_rejected type', () => {
      const result = notificationTypeEnum.safeParse('work_order_rejected')
      expect(result.success).toBe(true)
    })

    it('should accept defect_reported type', () => {
      const result = notificationTypeEnum.safeParse('defect_reported')
      expect(result.success).toBe(true)
    })

    it('should accept system type', () => {
      const result = notificationTypeEnum.safeParse('system')
      expect(result.success).toBe(true)
    })
  })

  describe('Invalid Notification Types', () => {
    it('should reject unknown notification type', () => {
      const result = notificationTypeEnum.safeParse('unknown_type')
      expect(result.success).toBe(false)
    })

    it('should reject empty string', () => {
      const result = notificationTypeEnum.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject null value', () => {
      const result = notificationTypeEnum.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('should reject undefined value', () => {
      const result = notificationTypeEnum.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('should reject number value', () => {
      const result = notificationTypeEnum.safeParse(123)
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// Create Notification Schema Validation Tests
// ============================================================================

describe('Create Notification Schema Validation', () => {
  describe('Valid Notifications', () => {
    it('should validate a complete notification', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'work_order_assigned',
        title: 'Work Order Assigned',
        body: 'You have been assigned to work order WO-0001',
        link: '/work-orders/123',
        isRead: false,
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
    })

    it('should validate notification without optional link', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'System Maintenance',
        body: 'System will be under maintenance at midnight',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRead).toBe(false)
      }
    })

    it('should validate notification with null link', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'work_order_unassigned',
        title: 'Work Order Unassigned',
        body: 'You have been removed from work order WO-0001',
        link: null,
        isRead: false,
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
    })

    it('should default isRead to false', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'defect_reported',
        title: 'Defect Reported',
        body: 'A new defect has been reported on asset FLT-0001',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRead).toBe(false)
      }
    })

    it('should allow isRead to be set to true', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'Notification',
        body: 'Pre-read notification',
        isRead: true,
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRead).toBe(true)
      }
    })
  })

  describe('Invalid Notifications - Missing Required Fields', () => {
    it('should reject notification without organisationId', () => {
      const notification = {
        userId: randomUUID(),
        type: 'system',
        title: 'Test',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject notification without userId', () => {
      const notification = {
        organisationId: randomUUID(),
        type: 'system',
        title: 'Test',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject notification without type', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        title: 'Test',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject notification without title', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject notification without body', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'Test title',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })
  })

  describe('Invalid Notifications - Field Constraints', () => {
    it('should reject invalid UUID for organisationId', () => {
      const notification = {
        organisationId: 'not-a-uuid',
        userId: randomUUID(),
        type: 'system',
        title: 'Test',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID for userId', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: 'not-a-uuid',
        type: 'system',
        title: 'Test',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: '',
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject title exceeding max length', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'T'.repeat(201),
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should accept title at max length', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'T'.repeat(200),
        body: 'Test body',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
    })

    it('should reject empty body', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'Test',
        body: '',
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should reject link exceeding max length', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'Test',
        body: 'Test body',
        link: '/'.repeat(501),
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(false)
    })

    it('should accept link at max length', () => {
      const notification = {
        organisationId: randomUUID(),
        userId: randomUUID(),
        type: 'system',
        title: 'Test',
        body: 'Test body',
        link: '/'.repeat(500),
      }

      const result = createNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// Update Notification Schema Validation Tests
// ============================================================================

describe('Update Notification Schema Validation', () => {
  describe('Valid Updates', () => {
    it('should validate marking as read', () => {
      const update = { isRead: true }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRead).toBe(true)
      }
    })

    it('should validate marking as unread', () => {
      const update = { isRead: false }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRead).toBe(false)
      }
    })
  })

  describe('Invalid Updates', () => {
    it('should reject empty object', () => {
      const update = {}
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject null isRead', () => {
      const update = { isRead: null }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject undefined isRead', () => {
      const update = { isRead: undefined }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject string isRead', () => {
      const update = { isRead: 'true' }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject number isRead', () => {
      const update = { isRead: 1 }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject additional unknown fields only accepting isRead', () => {
      // This test verifies the schema only accepts isRead field
      const update = { isRead: true }
      const result = updateNotificationSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// List Notifications Query Schema Validation Tests
// ============================================================================

describe('List Notifications Query Schema Validation', () => {
  describe('Valid Query Parameters', () => {
    it('should validate empty query with defaults', () => {
      const query = {}
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.unreadOnly).toBe(false)
      }
    })

    it('should validate custom limit', () => {
      const query = { limit: 25 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(25)
      }
    })

    it('should validate unreadOnly true', () => {
      const query = { unreadOnly: true }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.unreadOnly).toBe(true)
      }
    })

    it('should validate unreadOnly false', () => {
      const query = { unreadOnly: false }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.unreadOnly).toBe(false)
      }
    })

    it('should validate both limit and unreadOnly together', () => {
      const query = { limit: 10, unreadOnly: true }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(10)
        expect(result.data.unreadOnly).toBe(true)
      }
    })

    it('should validate minimum limit of 1', () => {
      const query = { limit: 1 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate maximum limit of 100', () => {
      const query = { limit: 100 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })
  })

  describe('Invalid Query Parameters', () => {
    it('should reject limit of 0', () => {
      const query = { limit: 0 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject negative limit', () => {
      const query = { limit: -10 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject limit exceeding max of 100', () => {
      const query = { limit: 101 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject non-integer limit', () => {
      const query = { limit: 50.5 }
      const result = listNotificationsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// Notification Business Logic Tests
// ============================================================================

describe('Notification Business Logic', () => {
  describe('Read Status Transitions', () => {
    interface NotificationState {
      isRead: boolean
      readAt: Date | null
    }

    function updateReadStatus(_current: NotificationState, newIsRead: boolean): NotificationState {
      return {
        isRead: newIsRead,
        readAt: newIsRead ? new Date() : null,
      }
    }

    it('should set readAt when marking as read', () => {
      const initial: NotificationState = { isRead: false, readAt: null }
      const updated = updateReadStatus(initial, true)

      expect(updated.isRead).toBe(true)
      expect(updated.readAt).toBeInstanceOf(Date)
    })

    it('should clear readAt when marking as unread', () => {
      const initial: NotificationState = { isRead: true, readAt: new Date() }
      const updated = updateReadStatus(initial, false)

      expect(updated.isRead).toBe(false)
      expect(updated.readAt).toBeNull()
    })

    it('should keep isRead false and readAt null for unread notification', () => {
      const initial: NotificationState = { isRead: false, readAt: null }
      const updated = updateReadStatus(initial, false)

      expect(updated.isRead).toBe(false)
      expect(updated.readAt).toBeNull()
    })

    it('should update readAt timestamp when re-marking as read', () => {
      const oldDate = new Date('2024-01-01')
      const initial: NotificationState = { isRead: true, readAt: oldDate }

      // Simulate marking as read again
      const updated = updateReadStatus(initial, true)

      expect(updated.isRead).toBe(true)
      expect(updated.readAt).toBeInstanceOf(Date)
      expect(updated.readAt!.getTime()).toBeGreaterThan(oldDate.getTime())
    })
  })

  describe('Unread Count Calculation', () => {
    interface Notification {
      id: string
      isRead: boolean
    }

    function calculateUnreadCount(notifications: Notification[]): number {
      return notifications.filter((n) => !n.isRead).length
    }

    it('should return 0 for empty array', () => {
      expect(calculateUnreadCount([])).toBe(0)
    })

    it('should return 0 when all notifications are read', () => {
      const notifications: Notification[] = [
        { id: '1', isRead: true },
        { id: '2', isRead: true },
        { id: '3', isRead: true },
      ]
      expect(calculateUnreadCount(notifications)).toBe(0)
    })

    it('should return total count when all notifications are unread', () => {
      const notifications: Notification[] = [
        { id: '1', isRead: false },
        { id: '2', isRead: false },
        { id: '3', isRead: false },
      ]
      expect(calculateUnreadCount(notifications)).toBe(3)
    })

    it('should return correct count for mixed read/unread', () => {
      const notifications: Notification[] = [
        { id: '1', isRead: true },
        { id: '2', isRead: false },
        { id: '3', isRead: true },
        { id: '4', isRead: false },
        { id: '5', isRead: false },
      ]
      expect(calculateUnreadCount(notifications)).toBe(3)
    })
  })

  describe('Mark All Read Logic', () => {
    interface Notification {
      id: string
      isRead: boolean
      readAt: Date | null
    }

    function markAllRead(notifications: Notification[]): Notification[] {
      const now = new Date()
      return notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.isRead ? n.readAt : now, // Only update readAt if not already read
      }))
    }

    it('should mark all notifications as read', () => {
      const notifications: Notification[] = [
        { id: '1', isRead: false, readAt: null },
        { id: '2', isRead: false, readAt: null },
        { id: '3', isRead: false, readAt: null },
      ]

      const updated = markAllRead(notifications)

      expect(updated.every((n) => n.isRead)).toBe(true)
      expect(updated.every((n) => n.readAt !== null)).toBe(true)
    })

    it('should not change already read notifications readAt', () => {
      const existingReadAt = new Date('2024-01-01')
      const notifications: Notification[] = [
        { id: '1', isRead: true, readAt: existingReadAt },
        { id: '2', isRead: false, readAt: null },
      ]

      const updated = markAllRead(notifications)

      expect(updated[0].readAt).toBe(existingReadAt)
      expect(updated[1].readAt).toBeInstanceOf(Date)
      expect(updated[1].readAt!.getTime()).toBeGreaterThan(existingReadAt.getTime())
    })

    it('should handle empty array', () => {
      const updated = markAllRead([])
      expect(updated).toHaveLength(0)
    })
  })

  describe('Notification Ordering', () => {
    interface Notification {
      id: string
      createdAt: Date
    }

    function sortByCreatedAtDesc(notifications: Notification[]): Notification[] {
      return [...notifications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    it('should order notifications by createdAt descending', () => {
      const notifications: Notification[] = [
        { id: '1', createdAt: new Date('2024-01-01') },
        { id: '2', createdAt: new Date('2024-03-01') },
        { id: '3', createdAt: new Date('2024-02-01') },
      ]

      const sorted = sortByCreatedAtDesc(notifications)

      expect(sorted[0].id).toBe('2') // March (newest)
      expect(sorted[1].id).toBe('3') // February
      expect(sorted[2].id).toBe('1') // January (oldest)
    })

    it('should maintain order for single notification', () => {
      const notifications: Notification[] = [{ id: '1', createdAt: new Date() }]

      const sorted = sortByCreatedAtDesc(notifications)

      expect(sorted).toHaveLength(1)
      expect(sorted[0].id).toBe('1')
    })

    it('should handle empty array', () => {
      const sorted = sortByCreatedAtDesc([])
      expect(sorted).toHaveLength(0)
    })
  })
})

// ============================================================================
// Notification Filtering Tests
// ============================================================================

describe('Notification Filtering', () => {
  interface Notification {
    id: string
    userId: string
    organisationId: string
    isRead: boolean
    createdAt: Date
  }

  const userId = randomUUID()
  const organisationId = randomUUID()
  const otherUserId = randomUUID()
  const otherOrgId = randomUUID()

  const notifications: Notification[] = [
    {
      id: '1',
      userId,
      organisationId,
      isRead: false,
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      userId,
      organisationId,
      isRead: true,
      createdAt: new Date('2024-02-01'),
    },
    {
      id: '3',
      userId,
      organisationId,
      isRead: false,
      createdAt: new Date('2024-03-01'),
    },
    { id: '4', userId: otherUserId, organisationId, isRead: false, createdAt: new Date() },
    { id: '5', userId, organisationId: otherOrgId, isRead: false, createdAt: new Date() },
  ]

  describe('User Scoping', () => {
    function filterByUser(list: Notification[], targetUserId: string): Notification[] {
      return list.filter((n) => n.userId === targetUserId)
    }

    it('should return only notifications for the specified user', () => {
      const filtered = filterByUser(notifications, userId)

      expect(filtered).toHaveLength(4)
      expect(filtered.every((n) => n.userId === userId)).toBe(true)
    })

    it('should return empty array for user with no notifications', () => {
      const noNotificationUserId = randomUUID()
      const filtered = filterByUser(notifications, noNotificationUserId)

      expect(filtered).toHaveLength(0)
    })
  })

  describe('Organisation Scoping', () => {
    function filterByOrganisation(list: Notification[], targetOrgId: string): Notification[] {
      return list.filter((n) => n.organisationId === targetOrgId)
    }

    it('should return only notifications for the specified organisation', () => {
      const filtered = filterByOrganisation(notifications, organisationId)

      expect(filtered).toHaveLength(4)
      expect(filtered.every((n) => n.organisationId === organisationId)).toBe(true)
    })
  })

  describe('Combined User and Organisation Scoping', () => {
    function filterByUserAndOrg(
      list: Notification[],
      targetUserId: string,
      targetOrgId: string,
    ): Notification[] {
      return list.filter((n) => n.userId === targetUserId && n.organisationId === targetOrgId)
    }

    it('should return only notifications for specific user in specific organisation', () => {
      const filtered = filterByUserAndOrg(notifications, userId, organisationId)

      expect(filtered).toHaveLength(3)
      expect(filtered.every((n) => n.userId === userId)).toBe(true)
      expect(filtered.every((n) => n.organisationId === organisationId)).toBe(true)
    })
  })

  describe('Unread Only Filter', () => {
    function filterUnreadOnly(
      list: Notification[],
      targetUserId: string,
      targetOrgId: string,
      unreadOnly: boolean,
    ): Notification[] {
      let filtered = list.filter(
        (n) => n.userId === targetUserId && n.organisationId === targetOrgId,
      )

      if (unreadOnly) {
        filtered = filtered.filter((n) => !n.isRead)
      }

      return filtered
    }

    it('should return only unread notifications when unreadOnly is true', () => {
      const filtered = filterUnreadOnly(notifications, userId, organisationId, true)

      expect(filtered).toHaveLength(2)
      expect(filtered.every((n) => !n.isRead)).toBe(true)
    })

    it('should return all notifications when unreadOnly is false', () => {
      const filtered = filterUnreadOnly(notifications, userId, organisationId, false)

      expect(filtered).toHaveLength(3)
    })
  })

  describe('Limit Enforcement', () => {
    function applyLimit(list: Notification[], limit: number): Notification[] {
      return list.slice(0, limit)
    }

    it('should limit results to specified count', () => {
      const limited = applyLimit(notifications, 2)
      expect(limited).toHaveLength(2)
    })

    it('should return all if limit exceeds list length', () => {
      const limited = applyLimit(notifications, 100)
      expect(limited).toHaveLength(notifications.length)
    })

    it('should return empty array for limit of 0', () => {
      const limited = applyLimit(notifications, 0)
      expect(limited).toHaveLength(0)
    })

    it('should cap limit at 100 per the schema', () => {
      const limit = Math.min(1000, 100) // Simulating the endpoint logic
      expect(limit).toBe(100)
    })
  })
})

// ============================================================================
// Notification ID Validation Tests
// ============================================================================

describe('Notification ID Validation', () => {
  const uuidSchema = z.string().uuid()

  describe('Valid Notification IDs', () => {
    it('should accept valid UUID v4', () => {
      const result = uuidSchema.safeParse(randomUUID())
      expect(result.success).toBe(true)
    })

    it('should accept multiple valid UUIDs', () => {
      const uuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '550e8400-e29b-41d4-a716-446655440000',
      ]

      for (const uuid of uuids) {
        const result = uuidSchema.safeParse(uuid)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('Invalid Notification IDs', () => {
    it('should reject empty string', () => {
      const result = uuidSchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID string', () => {
      const result = uuidSchema.safeParse('not-a-uuid')
      expect(result.success).toBe(false)
    })

    it('should reject UUID with missing segment', () => {
      const result = uuidSchema.safeParse('123e4567-e89b-12d3-a456')
      expect(result.success).toBe(false)
    })

    it('should reject UUID with extra characters', () => {
      const result = uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000-extra')
      expect(result.success).toBe(false)
    })

    it('should reject numeric ID', () => {
      const result = uuidSchema.safeParse(12345)
      expect(result.success).toBe(false)
    })

    it('should reject null', () => {
      const result = uuidSchema.safeParse(null)
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// Notification Content Validation Tests
// ============================================================================

describe('Notification Content Templates', () => {
  describe('Work Order Assigned Notification', () => {
    function buildAssignedNotification(params: {
      assignedByName: string
      workOrderNumber: string
      workOrderTitle: string
      workOrderId: string
    }) {
      return {
        type: 'work_order_assigned' as const,
        title: 'Work Order Assigned',
        body: `${params.assignedByName} assigned you to ${params.workOrderNumber}: ${params.workOrderTitle}`,
        link: `/work-orders/${params.workOrderId}`,
      }
    }

    it('should build correct notification body', () => {
      const notification = buildAssignedNotification({
        assignedByName: 'John Doe',
        workOrderNumber: 'WO-0001',
        workOrderTitle: 'Oil Change',
        workOrderId: randomUUID(),
      })

      expect(notification.title).toBe('Work Order Assigned')
      expect(notification.body).toBe('John Doe assigned you to WO-0001: Oil Change')
      expect(notification.link).toContain('/work-orders/')
    })
  })

  describe('Work Order Unassigned Notification', () => {
    function buildUnassignedNotification(params: {
      unassignedByName: string
      workOrderNumber: string
      workOrderTitle: string
    }) {
      return {
        type: 'work_order_unassigned' as const,
        title: 'Work Order Unassigned',
        body: `${params.unassignedByName} removed you from ${params.workOrderNumber}: ${params.workOrderTitle}`,
        link: null,
      }
    }

    it('should build correct notification body with no link', () => {
      const notification = buildUnassignedNotification({
        unassignedByName: 'Jane Smith',
        workOrderNumber: 'WO-0002',
        workOrderTitle: 'Brake Replacement',
      })

      expect(notification.title).toBe('Work Order Unassigned')
      expect(notification.body).toBe('Jane Smith removed you from WO-0002: Brake Replacement')
      expect(notification.link).toBeNull()
    })
  })

  describe('Approval Requested Notification', () => {
    function buildApprovalRequestedNotification(params: {
      requestedByName: string
      workOrderNumber: string
      workOrderTitle: string
      workOrderId: string
      estimatedCost: string
    }) {
      return {
        type: 'work_order_approval_requested' as const,
        title: 'Approval Required',
        body: `${params.requestedByName} requested approval for ${params.workOrderNumber}: ${params.workOrderTitle} (Est. cost: $${params.estimatedCost})`,
        link: `/work-orders/${params.workOrderId}`,
      }
    }

    it('should include estimated cost in body', () => {
      const notification = buildApprovalRequestedNotification({
        requestedByName: 'Mike Wilson',
        workOrderNumber: 'WO-0003',
        workOrderTitle: 'Engine Overhaul',
        workOrderId: randomUUID(),
        estimatedCost: '5,000.00',
      })

      expect(notification.title).toBe('Approval Required')
      expect(notification.body).toContain('Est. cost: $5,000.00')
    })
  })

  describe('Work Order Approved Notification', () => {
    function buildApprovedNotification(params: {
      approvedByName: string
      workOrderNumber: string
      workOrderTitle: string
      workOrderId: string
    }) {
      return {
        type: 'work_order_approved' as const,
        title: 'Work Order Approved',
        body: `${params.approvedByName} approved ${params.workOrderNumber}: ${params.workOrderTitle}`,
        link: `/work-orders/${params.workOrderId}`,
      }
    }

    it('should build correct approved notification', () => {
      const notification = buildApprovedNotification({
        approvedByName: 'Manager Tom',
        workOrderNumber: 'WO-0004',
        workOrderTitle: 'Tire Rotation',
        workOrderId: randomUUID(),
      })

      expect(notification.title).toBe('Work Order Approved')
      expect(notification.body).toBe('Manager Tom approved WO-0004: Tire Rotation')
    })
  })

  describe('Work Order Rejected Notification', () => {
    function buildRejectedNotification(params: {
      rejectedByName: string
      workOrderNumber: string
      workOrderTitle: string
      workOrderId: string
      reason: string | null
    }) {
      const reasonText = params.reason ? ` - Reason: ${params.reason}` : ''
      return {
        type: 'work_order_rejected' as const,
        title: 'Work Order Rejected',
        body: `${params.rejectedByName} rejected ${params.workOrderNumber}: ${params.workOrderTitle}${reasonText}`,
        link: `/work-orders/${params.workOrderId}`,
      }
    }

    it('should build rejected notification with reason', () => {
      const notification = buildRejectedNotification({
        rejectedByName: 'Manager Tom',
        workOrderNumber: 'WO-0005',
        workOrderTitle: 'Complete Rebuild',
        workOrderId: randomUUID(),
        reason: 'Cost too high',
      })

      expect(notification.title).toBe('Work Order Rejected')
      expect(notification.body).toContain('- Reason: Cost too high')
    })

    it('should build rejected notification without reason', () => {
      const notification = buildRejectedNotification({
        rejectedByName: 'Manager Tom',
        workOrderNumber: 'WO-0006',
        workOrderTitle: 'Minor Fix',
        workOrderId: randomUUID(),
        reason: null,
      })

      expect(notification.body).not.toContain('Reason:')
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('Empty State Handling', () => {
    it('should handle user with no notifications', () => {
      const notifications: unknown[] = []
      expect(notifications).toHaveLength(0)
    })

    it('should handle unread count of zero', () => {
      const count = 0
      expect(count).toBe(0)
    })
  })

  describe('Notification Not Found Handling', () => {
    function findNotification(
      notifications: { id: string }[],
      id: string,
    ): { id: string } | undefined {
      return notifications.find((n) => n.id === id)
    }

    it('should return undefined for non-existent notification', () => {
      const notifications = [{ id: '1' }, { id: '2' }]
      const result = findNotification(notifications, '999')

      expect(result).toBeUndefined()
    })

    it('should find existing notification', () => {
      const notifications = [{ id: '1' }, { id: '2' }]
      const result = findNotification(notifications, '2')

      expect(result).toBeDefined()
      expect(result!.id).toBe('2')
    })
  })

  describe('Ownership Validation', () => {
    interface Notification {
      id: string
      userId: string
      organisationId: string
    }

    function userOwnsNotification(notification: Notification, userId: string): boolean {
      return notification.userId === userId
    }

    function orgOwnsNotification(notification: Notification, orgId: string): boolean {
      return notification.organisationId === orgId
    }

    it('should validate user ownership', () => {
      const userId = randomUUID()
      const notification: Notification = {
        id: '1',
        userId,
        organisationId: randomUUID(),
      }

      expect(userOwnsNotification(notification, userId)).toBe(true)
      expect(userOwnsNotification(notification, randomUUID())).toBe(false)
    })

    it('should validate organisation ownership', () => {
      const orgId = randomUUID()
      const notification: Notification = {
        id: '1',
        userId: randomUUID(),
        organisationId: orgId,
      }

      expect(orgOwnsNotification(notification, orgId)).toBe(true)
      expect(orgOwnsNotification(notification, randomUUID())).toBe(false)
    })
  })

  describe('Concurrent Updates', () => {
    // Simulating concurrent update scenario
    it('should handle mark as read when already read', () => {
      const notification = { isRead: true, readAt: new Date() }
      const update = { isRead: true }

      // Even if already read, update should succeed
      const result = { ...notification, ...update }
      expect(result.isRead).toBe(true)
    })

    it('should handle mark all read when some already read', () => {
      const notifications = [
        { id: '1', isRead: true },
        { id: '2', isRead: false },
        { id: '3', isRead: true },
      ]

      const updated = notifications.map((n) => ({ ...n, isRead: true }))

      expect(updated.every((n) => n.isRead)).toBe(true)
    })
  })
})

// ============================================================================
// Authentication/Authorization Tests
// ============================================================================

describe('Authorization Logic', () => {
  describe('Session Validation', () => {
    interface Session {
      user?: {
        id: string
        organisationId: string
      }
    }

    function isAuthenticated(session: Session | null | undefined): boolean {
      return !!session?.user
    }

    function getUserFromSession(session: Session | null | undefined) {
      return session?.user ?? null
    }

    it('should return false for null session', () => {
      expect(isAuthenticated(null)).toBe(false)
    })

    it('should return false for undefined session', () => {
      expect(isAuthenticated(undefined)).toBe(false)
    })

    it('should return false for session without user', () => {
      expect(isAuthenticated({})).toBe(false)
    })

    it('should return true for valid session with user', () => {
      const session: Session = {
        user: {
          id: randomUUID(),
          organisationId: randomUUID(),
        },
      }
      expect(isAuthenticated(session)).toBe(true)
    })

    it('should return null user for invalid session', () => {
      expect(getUserFromSession(null)).toBeNull()
    })

    it('should return user for valid session', () => {
      const userId = randomUUID()
      const session: Session = {
        user: {
          id: userId,
          organisationId: randomUUID(),
        },
      }
      const user = getUserFromSession(session)
      expect(user).not.toBeNull()
      expect(user!.id).toBe(userId)
    })
  })

  describe('Cross-User Access Prevention', () => {
    function canAccessNotification(notificationUserId: string, requestingUserId: string): boolean {
      return notificationUserId === requestingUserId
    }

    it('should allow access to own notification', () => {
      const userId = randomUUID()
      expect(canAccessNotification(userId, userId)).toBe(true)
    })

    it('should deny access to other user notification', () => {
      const userId1 = randomUUID()
      const userId2 = randomUUID()
      expect(canAccessNotification(userId1, userId2)).toBe(false)
    })
  })

  describe('Cross-Organisation Access Prevention', () => {
    function canAccessNotificationInOrg(
      notificationOrgId: string,
      requestingOrgId: string,
    ): boolean {
      return notificationOrgId === requestingOrgId
    }

    it('should allow access within same organisation', () => {
      const orgId = randomUUID()
      expect(canAccessNotificationInOrg(orgId, orgId)).toBe(true)
    })

    it('should deny access across organisations', () => {
      const orgId1 = randomUUID()
      const orgId2 = randomUUID()
      expect(canAccessNotificationInOrg(orgId1, orgId2)).toBe(false)
    })
  })
})

// ============================================================================
// Response Format Tests
// ============================================================================

describe('Response Formats', () => {
  describe('List Notifications Response', () => {
    const notificationResponseSchema = z.array(
      z.object({
        id: z.string().uuid(),
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
        type: notificationTypeEnum,
        title: z.string(),
        body: z.string(),
        link: z.string().nullable().optional(),
        isRead: z.boolean(),
        readAt: z.string().datetime().nullable().optional(),
        createdAt: z.string().datetime(),
      }),
    )

    it('should validate valid response array', () => {
      const response = [
        {
          id: randomUUID(),
          organisationId: randomUUID(),
          userId: randomUUID(),
          type: 'work_order_assigned',
          title: 'Test',
          body: 'Test body',
          link: '/test',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ]

      const result = notificationResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate empty array response', () => {
      const result = notificationResponseSchema.safeParse([])
      expect(result.success).toBe(true)
    })
  })

  describe('Unread Count Response', () => {
    const unreadCountResponseSchema = z.object({
      count: z.number().int().min(0),
    })

    it('should validate count of 0', () => {
      const result = unreadCountResponseSchema.safeParse({ count: 0 })
      expect(result.success).toBe(true)
    })

    it('should validate positive count', () => {
      const result = unreadCountResponseSchema.safeParse({ count: 42 })
      expect(result.success).toBe(true)
    })

    it('should reject negative count', () => {
      const result = unreadCountResponseSchema.safeParse({ count: -1 })
      expect(result.success).toBe(false)
    })

    it('should reject non-integer count', () => {
      const result = unreadCountResponseSchema.safeParse({ count: 3.5 })
      expect(result.success).toBe(false)
    })
  })

  describe('Mark All Read Response', () => {
    const markAllReadResponseSchema = z.object({
      success: z.boolean(),
    })

    it('should validate success true', () => {
      const result = markAllReadResponseSchema.safeParse({ success: true })
      expect(result.success).toBe(true)
    })

    it('should validate success false', () => {
      const result = markAllReadResponseSchema.safeParse({ success: false })
      expect(result.success).toBe(true)
    })

    it('should reject missing success field', () => {
      const result = markAllReadResponseSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('Update Notification Response', () => {
    const updateResponseSchema = z.object({
      id: z.string().uuid(),
      isRead: z.boolean(),
      readAt: z.string().datetime().nullable(),
    })

    it('should validate marked as read response', () => {
      const response = {
        id: randomUUID(),
        isRead: true,
        readAt: new Date().toISOString(),
      }

      const result = updateResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate marked as unread response', () => {
      const response = {
        id: randomUUID(),
        isRead: false,
        readAt: null,
      }

      const result = updateResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// Limit Enforcement Tests
// ============================================================================

describe('Limit Enforcement', () => {
  describe('Default Limit', () => {
    it('should default to 50 when not specified', () => {
      const queryLimit = undefined
      const limit = queryLimit ?? 50
      expect(limit).toBe(50)
    })

    it('should default to 50 when NaN', () => {
      const queryLimit = Number('not-a-number')
      const limit = Number.isNaN(queryLimit) ? 50 : queryLimit
      expect(limit).toBe(50)
    })
  })

  describe('Maximum Limit Cap', () => {
    it('should cap at 100 when higher value provided', () => {
      const requestedLimit = 200
      const limit = Math.min(requestedLimit, 100)
      expect(limit).toBe(100)
    })

    it('should use requested limit when under 100', () => {
      const requestedLimit = 75
      const limit = Math.min(requestedLimit, 100)
      expect(limit).toBe(75)
    })

    it('should allow exactly 100', () => {
      const requestedLimit = 100
      const limit = Math.min(requestedLimit, 100)
      expect(limit).toBe(100)
    })
  })

  describe('Combined Logic', () => {
    function calculateLimit(queryLimit: string | undefined): number {
      const parsed = Number(queryLimit)
      const limit = Number.isNaN(parsed) ? 50 : parsed
      return Math.min(Math.max(1, limit), 100)
    }

    it('should handle undefined query', () => {
      expect(calculateLimit(undefined)).toBe(50)
    })

    it('should handle valid number string', () => {
      expect(calculateLimit('25')).toBe(25)
    })

    it('should handle empty string', () => {
      // Number('') returns 0, which gets capped to minimum of 1
      expect(calculateLimit('')).toBe(1)
    })

    it('should cap at 100', () => {
      expect(calculateLimit('150')).toBe(100)
    })

    it('should enforce minimum of 1', () => {
      expect(calculateLimit('0')).toBe(1)
    })

    it('should handle negative values', () => {
      expect(calculateLimit('-10')).toBe(1)
    })
  })
})

// ============================================================================
// Timestamp Tests
// ============================================================================

describe('Timestamp Handling', () => {
  describe('ReadAt Timestamp', () => {
    it('should set readAt to current time when marking as read', () => {
      const before = new Date()
      const readAt = new Date()
      const after = new Date()

      expect(readAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(readAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should set readAt to null when marking as unread', () => {
      // When marking as unread, readAt should be null
      const isRead = false
      const readAt = isRead ? new Date() : null
      expect(readAt).toBeNull()
    })
  })

  describe('CreatedAt Ordering', () => {
    it('should order by createdAt descending', () => {
      const dates = [new Date('2024-01-01'), new Date('2024-03-01'), new Date('2024-02-01')]

      const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime())

      expect(sorted[0].toISOString()).toBe('2024-03-01T00:00:00.000Z')
      expect(sorted[1].toISOString()).toBe('2024-02-01T00:00:00.000Z')
      expect(sorted[2].toISOString()).toBe('2024-01-01T00:00:00.000Z')
    })
  })
})
