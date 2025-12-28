import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Work Order History/Audit Trail Tests
 * Tests for status history tracking and audit logging
 */

// Status history entry schema
const statusHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  workOrderId: z.string().uuid(),
  fromStatus: z
    .enum([
      'draft',
      'pending_approval',
      'open',
      'in_progress',
      'pending_parts',
      'completed',
      'closed',
    ])
    .nullable(),
  toStatus: z.enum([
    'draft',
    'pending_approval',
    'open',
    'in_progress',
    'pending_parts',
    'completed',
    'closed',
  ]),
  changedById: z.string().uuid(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
})

// Audit log entry schema - action is varchar(100) in the DB, not a strict enum
const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  organisationId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  action: z.string().min(1).max(100), // varchar(100) in schema
  entityType: z.string().min(1).max(100), // varchar(100) in schema
  entityId: z.string().uuid().nullable(),
  oldValues: z.record(z.string(), z.any()).nullable(),
  newValues: z.record(z.string(), z.any()).nullable(),
  createdAt: z.string().datetime(),
})

describe('Work Order Status History Validation', () => {
  describe('Status History Entry', () => {
    it('should validate a valid status history entry', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workOrderId: '123e4567-e89b-12d3-a456-426614174001',
        fromStatus: 'draft',
        toStatus: 'open',
        changedById: '123e4567-e89b-12d3-a456-426614174002',
        notes: 'Work order approved and opened',
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = statusHistoryEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should validate entry with null fromStatus (initial creation)', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workOrderId: '123e4567-e89b-12d3-a456-426614174001',
        fromStatus: null,
        toStatus: 'draft',
        changedById: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = statusHistoryEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should validate entry without notes', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workOrderId: '123e4567-e89b-12d3-a456-426614174001',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        changedById: '123e4567-e89b-12d3-a456-426614174002',
        notes: null,
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = statusHistoryEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should reject entry with invalid status', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workOrderId: '123e4567-e89b-12d3-a456-426614174001',
        fromStatus: 'draft',
        toStatus: 'invalid_status',
        changedById: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = statusHistoryEntrySchema.safeParse(entry)
      expect(result.success).toBe(false)
    })

    it('should reject entry missing required fields', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workOrderId: '123e4567-e89b-12d3-a456-426614174001',
        // missing toStatus
        changedById: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = statusHistoryEntrySchema.safeParse(entry)
      expect(result.success).toBe(false)
    })
  })

  describe('Audit Log Entry', () => {
    it('should validate a valid audit log entry for status change', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organisationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        action: 'status_change',
        entityType: 'work_order',
        entityId: '123e4567-e89b-12d3-a456-426614174003',
        oldValues: { status: 'draft' },
        newValues: { status: 'open' },
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = auditLogEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should validate audit log for work order creation', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organisationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        action: 'create',
        entityType: 'work_order',
        entityId: '123e4567-e89b-12d3-a456-426614174003',
        oldValues: null,
        newValues: {
          title: 'Oil Change',
          status: 'draft',
          priority: 'medium',
        },
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = auditLogEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should validate audit log for approval request', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organisationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        action: 'request_approval',
        entityType: 'work_order',
        entityId: '123e4567-e89b-12d3-a456-426614174003',
        oldValues: { status: 'draft' },
        newValues: {
          status: 'pending_approval',
          approvalId: '123e4567-e89b-12d3-a456-426614174004',
        },
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = auditLogEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should validate audit log for work order approval', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organisationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        action: 'approve',
        entityType: 'work_order',
        entityId: '123e4567-e89b-12d3-a456-426614174003',
        oldValues: { status: 'pending_approval', approvalStatus: 'pending' },
        newValues: { status: 'open', approvalStatus: 'approved' },
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = auditLogEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should validate audit log for emergency override', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organisationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        action: 'emergency_override',
        entityType: 'work_order',
        entityId: '123e4567-e89b-12d3-a456-426614174003',
        oldValues: { status: 'pending_approval' },
        newValues: {
          status: 'open',
          emergencyOverride: true,
          emergencyReason: 'Safety critical issue',
        },
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = auditLogEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })

    it('should reject audit log with empty action', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organisationId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        action: '', // Empty action should fail min(1)
        entityType: 'work_order',
        entityId: '123e4567-e89b-12d3-a456-426614174003',
        oldValues: null,
        newValues: null,
        createdAt: '2024-12-01T10:00:00.000Z',
      }

      const result = auditLogEntrySchema.safeParse(entry)
      expect(result.success).toBe(false)
    })
  })
})

describe('Status History Ordering', () => {
  interface HistoryEntry {
    id: string
    fromStatus: string | null
    toStatus: string
    createdAt: Date
  }

  function sortHistoryByDate(
    entries: HistoryEntry[],
    order: 'asc' | 'desc' = 'desc',
  ): HistoryEntry[] {
    return [...entries].sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime()
      return order === 'asc' ? diff : -diff
    })
  }

  it('should sort history entries by date descending (newest first)', () => {
    const entries: HistoryEntry[] = [
      { id: '1', fromStatus: null, toStatus: 'draft', createdAt: new Date('2024-12-01T10:00:00Z') },
      {
        id: '2',
        fromStatus: 'draft',
        toStatus: 'open',
        createdAt: new Date('2024-12-02T10:00:00Z'),
      },
      {
        id: '3',
        fromStatus: 'open',
        toStatus: 'in_progress',
        createdAt: new Date('2024-12-03T10:00:00Z'),
      },
    ]

    const sorted = sortHistoryByDate(entries, 'desc')

    expect(sorted[0].id).toBe('3')
    expect(sorted[1].id).toBe('2')
    expect(sorted[2].id).toBe('1')
  })

  it('should sort history entries by date ascending (oldest first)', () => {
    const entries: HistoryEntry[] = [
      {
        id: '3',
        fromStatus: 'open',
        toStatus: 'in_progress',
        createdAt: new Date('2024-12-03T10:00:00Z'),
      },
      { id: '1', fromStatus: null, toStatus: 'draft', createdAt: new Date('2024-12-01T10:00:00Z') },
      {
        id: '2',
        fromStatus: 'draft',
        toStatus: 'open',
        createdAt: new Date('2024-12-02T10:00:00Z'),
      },
    ]

    const sorted = sortHistoryByDate(entries, 'asc')

    expect(sorted[0].id).toBe('1')
    expect(sorted[1].id).toBe('2')
    expect(sorted[2].id).toBe('3')
  })

  it('should handle empty history', () => {
    const entries: HistoryEntry[] = []
    const sorted = sortHistoryByDate(entries)
    expect(sorted).toHaveLength(0)
  })

  it('should handle single entry', () => {
    const entries: HistoryEntry[] = [
      { id: '1', fromStatus: null, toStatus: 'draft', createdAt: new Date('2024-12-01T10:00:00Z') },
    ]
    const sorted = sortHistoryByDate(entries)
    expect(sorted).toHaveLength(1)
    expect(sorted[0].id).toBe('1')
  })
})

describe('Status Transition History Validation', () => {
  const validTransitions: Record<string, string[]> = {
    draft: ['open', 'pending_approval'],
    pending_approval: ['open', 'draft'], // via approval/rejection
    open: ['in_progress', 'closed'],
    in_progress: ['pending_parts', 'completed', 'open'],
    pending_parts: ['in_progress', 'open'],
    completed: ['closed', 'in_progress'],
    closed: [],
  }

  function buildTransitionHistory(
    statuses: string[],
  ): Array<{ fromStatus: string | null; toStatus: string }> {
    return statuses.map((toStatus, index) => ({
      fromStatus: index === 0 ? null : statuses[index - 1],
      toStatus,
    }))
  }

  function isValidTransitionSequence(
    history: Array<{ fromStatus: string | null; toStatus: string }>,
  ): boolean {
    for (let i = 1; i < history.length; i++) {
      const fromStatus = history[i].fromStatus
      const toStatus = history[i].toStatus
      if (fromStatus && !validTransitions[fromStatus]?.includes(toStatus)) {
        return false
      }
    }
    return true
  }

  it('should validate a typical work order lifecycle', () => {
    const statuses = ['draft', 'open', 'in_progress', 'completed', 'closed']
    const history = buildTransitionHistory(statuses)

    expect(history).toHaveLength(5)
    expect(history[0].fromStatus).toBeNull()
    expect(history[0].toStatus).toBe('draft')
    expect(history[4].fromStatus).toBe('completed')
    expect(history[4].toStatus).toBe('closed')
  })

  it('should validate lifecycle with pending parts', () => {
    const statuses = [
      'draft',
      'open',
      'in_progress',
      'pending_parts',
      'in_progress',
      'completed',
      'closed',
    ]
    const history = buildTransitionHistory(statuses)

    expect(isValidTransitionSequence(history)).toBe(true)
  })

  it('should validate lifecycle with work reopened', () => {
    const statuses = ['draft', 'open', 'in_progress', 'open', 'in_progress', 'completed', 'closed']
    const history = buildTransitionHistory(statuses)

    expect(isValidTransitionSequence(history)).toBe(true)
  })

  it('should validate lifecycle with rework after completion', () => {
    const statuses = [
      'draft',
      'open',
      'in_progress',
      'completed',
      'in_progress',
      'completed',
      'closed',
    ]
    const history = buildTransitionHistory(statuses)

    expect(isValidTransitionSequence(history)).toBe(true)
  })

  it('should validate lifecycle with approval workflow', () => {
    const statuses = ['draft', 'pending_approval', 'open', 'in_progress', 'completed', 'closed']
    const history = buildTransitionHistory(statuses)

    expect(isValidTransitionSequence(history)).toBe(true)
  })

  it('should identify invalid transition (draft to completed)', () => {
    const history = [
      { fromStatus: null, toStatus: 'draft' },
      { fromStatus: 'draft', toStatus: 'completed' }, // Invalid!
    ]

    expect(isValidTransitionSequence(history)).toBe(false)
  })

  it('should identify invalid transition (closed to anything)', () => {
    const history = [
      { fromStatus: null, toStatus: 'draft' },
      { fromStatus: 'draft', toStatus: 'open' },
      { fromStatus: 'open', toStatus: 'in_progress' },
      { fromStatus: 'in_progress', toStatus: 'completed' },
      { fromStatus: 'completed', toStatus: 'closed' },
      { fromStatus: 'closed', toStatus: 'in_progress' }, // Invalid!
    ]

    expect(isValidTransitionSequence(history)).toBe(false)
  })
})

describe('Approval History Tracking', () => {
  const approvalHistorySchema = z.object({
    id: z.string().uuid(),
    workOrderId: z.string().uuid(),
    status: z.enum(['pending', 'approved', 'rejected']),
    requestedById: z.string().uuid(),
    requestedAt: z.string().datetime(),
    requestNotes: z.string().nullable(),
    reviewedById: z.string().uuid().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    reviewNotes: z.string().nullable(),
    isEmergencyOverride: z.boolean(),
    emergencyReason: z.string().nullable(),
    estimatedCostAtRequest: z.string().nullable(),
  })

  it('should validate pending approval record', () => {
    const approval = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workOrderId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'pending',
      requestedById: '123e4567-e89b-12d3-a456-426614174002',
      requestedAt: '2024-12-01T10:00:00.000Z',
      requestNotes: 'High priority brake repair',
      reviewedById: null,
      reviewedAt: null,
      reviewNotes: null,
      isEmergencyOverride: false,
      emergencyReason: null,
      estimatedCostAtRequest: '500.00',
    }

    const result = approvalHistorySchema.safeParse(approval)
    expect(result.success).toBe(true)
  })

  it('should validate approved record', () => {
    const approval = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workOrderId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'approved',
      requestedById: '123e4567-e89b-12d3-a456-426614174002',
      requestedAt: '2024-12-01T10:00:00.000Z',
      requestNotes: 'High priority brake repair',
      reviewedById: '123e4567-e89b-12d3-a456-426614174003',
      reviewedAt: '2024-12-01T11:00:00.000Z',
      reviewNotes: 'Approved - critical safety issue',
      isEmergencyOverride: false,
      emergencyReason: null,
      estimatedCostAtRequest: '500.00',
    }

    const result = approvalHistorySchema.safeParse(approval)
    expect(result.success).toBe(true)
  })

  it('should validate rejected record', () => {
    const approval = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workOrderId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'rejected',
      requestedById: '123e4567-e89b-12d3-a456-426614174002',
      requestedAt: '2024-12-01T10:00:00.000Z',
      requestNotes: 'Low priority cosmetic repair',
      reviewedById: '123e4567-e89b-12d3-a456-426614174003',
      reviewedAt: '2024-12-01T12:00:00.000Z',
      reviewNotes: 'Rejected - defer to next quarter budget',
      isEmergencyOverride: false,
      emergencyReason: null,
      estimatedCostAtRequest: '2500.00',
    }

    const result = approvalHistorySchema.safeParse(approval)
    expect(result.success).toBe(true)
  })

  it('should validate emergency override record', () => {
    const approval = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workOrderId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'approved',
      requestedById: '123e4567-e89b-12d3-a456-426614174002',
      requestedAt: '2024-12-01T10:00:00.000Z',
      requestNotes: 'Vehicle disabled on highway',
      reviewedById: '123e4567-e89b-12d3-a456-426614174003',
      reviewedAt: '2024-12-01T10:05:00.000Z',
      reviewNotes: 'Emergency override approved',
      isEmergencyOverride: true,
      emergencyReason: 'Safety critical - vehicle blocking traffic',
      estimatedCostAtRequest: '1500.00',
    }

    const result = approvalHistorySchema.safeParse(approval)
    expect(result.success).toBe(true)
  })
})

describe('History Filtering', () => {
  interface HistoryEntry {
    id: string
    fromStatus: string | null
    toStatus: string
    changedById: string
    notes: string | null
    createdAt: Date
  }

  function filterHistoryByUser(entries: HistoryEntry[], userId: string): HistoryEntry[] {
    return entries.filter((entry) => entry.changedById === userId)
  }

  function filterHistoryByDateRange(
    entries: HistoryEntry[],
    startDate: Date,
    endDate: Date,
  ): HistoryEntry[] {
    return entries.filter((entry) => entry.createdAt >= startDate && entry.createdAt <= endDate)
  }

  function filterHistoryByStatus(entries: HistoryEntry[], status: string): HistoryEntry[] {
    return entries.filter((entry) => entry.toStatus === status || entry.fromStatus === status)
  }

  const sampleHistory: HistoryEntry[] = [
    {
      id: '1',
      fromStatus: null,
      toStatus: 'draft',
      changedById: 'user-1',
      notes: null,
      createdAt: new Date('2024-12-01T10:00:00Z'),
    },
    {
      id: '2',
      fromStatus: 'draft',
      toStatus: 'open',
      changedById: 'user-2',
      notes: 'Approved',
      createdAt: new Date('2024-12-02T10:00:00Z'),
    },
    {
      id: '3',
      fromStatus: 'open',
      toStatus: 'in_progress',
      changedById: 'user-1',
      notes: 'Started work',
      createdAt: new Date('2024-12-03T10:00:00Z'),
    },
    {
      id: '4',
      fromStatus: 'in_progress',
      toStatus: 'completed',
      changedById: 'user-1',
      notes: 'Work finished',
      createdAt: new Date('2024-12-04T10:00:00Z'),
    },
    {
      id: '5',
      fromStatus: 'completed',
      toStatus: 'closed',
      changedById: 'user-2',
      notes: 'Closed after review',
      createdAt: new Date('2024-12-05T10:00:00Z'),
    },
  ]

  it('should filter history by user', () => {
    const filtered = filterHistoryByUser(sampleHistory, 'user-1')
    expect(filtered).toHaveLength(3)
    expect(filtered.every((e) => e.changedById === 'user-1')).toBe(true)
  })

  it('should filter history by date range', () => {
    const startDate = new Date('2024-12-02T00:00:00Z')
    const endDate = new Date('2024-12-04T23:59:59Z')

    const filtered = filterHistoryByDateRange(sampleHistory, startDate, endDate)
    expect(filtered).toHaveLength(3)
    expect(filtered.map((e) => e.id)).toEqual(['2', '3', '4'])
  })

  it('should filter history by status involvement', () => {
    const filtered = filterHistoryByStatus(sampleHistory, 'in_progress')
    expect(filtered).toHaveLength(2) // Entry 3 (to: in_progress) and Entry 4 (from: in_progress)
  })

  it('should return empty array when no matches', () => {
    const filtered = filterHistoryByUser(sampleHistory, 'user-999')
    expect(filtered).toHaveLength(0)
  })
})
