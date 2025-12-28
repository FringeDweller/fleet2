import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Schema validation tests
const workOrderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  assetId: z.string().uuid(),
  assignedToId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
})

const statusTransitionSchema = z.object({
  status: z.enum(['draft', 'open', 'in_progress', 'pending_parts', 'completed', 'closed']),
  notes: z.string().optional(),
})

describe('Work Order Schema Validation', () => {
  describe('Create Work Order', () => {
    it('should validate a valid work order', () => {
      const validWorkOrder = {
        title: 'Oil Change',
        description: 'Regular oil change maintenance',
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        assignedToId: '123e4567-e89b-12d3-a456-426614174001',
        priority: 'medium',
        dueDate: '2024-12-31T23:59:59.000Z',
        estimatedDuration: 60,
        notes: 'Use synthetic oil',
      }

      const result = workOrderSchema.safeParse(validWorkOrder)
      expect(result.success).toBe(true)
    })

    it('should require title', () => {
      const invalidWorkOrder = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'medium',
      }

      const result = workOrderSchema.safeParse(invalidWorkOrder)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for assetId', () => {
      const invalidWorkOrder = {
        title: 'Test',
        assetId: 'not-a-uuid',
        priority: 'medium',
      }

      const result = workOrderSchema.safeParse(invalidWorkOrder)
      expect(result.success).toBe(false)
    })

    it('should require valid priority enum', () => {
      const invalidWorkOrder = {
        title: 'Test',
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'urgent', // not a valid priority
      }

      const result = workOrderSchema.safeParse(invalidWorkOrder)
      expect(result.success).toBe(false)
    })

    it('should allow optional fields to be null', () => {
      const workOrder = {
        title: 'Test',
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'low',
        description: null,
        assignedToId: null,
        dueDate: null,
        estimatedDuration: null,
        notes: null,
      }

      const result = workOrderSchema.safeParse(workOrder)
      expect(result.success).toBe(true)
    })

    it('should enforce title max length', () => {
      const invalidWorkOrder = {
        title: 'a'.repeat(201),
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'medium',
      }

      const result = workOrderSchema.safeParse(invalidWorkOrder)
      expect(result.success).toBe(false)
    })
  })

  describe('Status Transition', () => {
    it('should validate valid status transitions', () => {
      const validTransition = {
        status: 'in_progress',
        notes: 'Starting work now',
      }

      const result = statusTransitionSchema.safeParse(validTransition)
      expect(result.success).toBe(true)
    })

    it('should require valid status enum', () => {
      const invalidTransition = {
        status: 'invalid_status',
      }

      const result = statusTransitionSchema.safeParse(invalidTransition)
      expect(result.success).toBe(false)
    })

    it('should allow notes to be optional', () => {
      const transition = {
        status: 'completed',
      }

      const result = statusTransitionSchema.safeParse(transition)
      expect(result.success).toBe(true)
    })
  })
})

describe('Status Transition Rules', () => {
  const validTransitions: Record<string, string[]> = {
    draft: ['open'],
    open: ['in_progress', 'closed'],
    in_progress: ['pending_parts', 'completed', 'open'],
    pending_parts: ['in_progress', 'open'],
    completed: ['closed', 'in_progress'],
    closed: [],
  }

  it('should allow draft to transition to open', () => {
    expect(validTransitions.draft).toContain('open')
  })

  it('should allow open to transition to in_progress', () => {
    expect(validTransitions.open).toContain('in_progress')
  })

  it('should allow in_progress to transition to completed', () => {
    expect(validTransitions.in_progress).toContain('completed')
  })

  it('should allow in_progress to transition to pending_parts', () => {
    expect(validTransitions.in_progress).toContain('pending_parts')
  })

  it('should not allow closed to transition anywhere', () => {
    expect(validTransitions.closed).toHaveLength(0)
  })

  it('should allow reverting from completed to in_progress', () => {
    expect(validTransitions.completed).toContain('in_progress')
  })

  it('should not allow draft to transition directly to completed', () => {
    expect(validTransitions.draft).not.toContain('completed')
  })

  it('should not allow open to transition directly to completed', () => {
    expect(validTransitions.open).not.toContain('completed')
  })
})

describe('Work Order Number Generation', () => {
  function generateWorkOrderNumber(lastNumber: number): string {
    return `WO-${String(lastNumber + 1).padStart(4, '0')}`
  }

  it('should generate WO-0001 for the first work order', () => {
    expect(generateWorkOrderNumber(0)).toBe('WO-0001')
  })

  it('should generate sequential numbers', () => {
    expect(generateWorkOrderNumber(1)).toBe('WO-0002')
    expect(generateWorkOrderNumber(9)).toBe('WO-0010')
    expect(generateWorkOrderNumber(99)).toBe('WO-0100')
    expect(generateWorkOrderNumber(999)).toBe('WO-1000')
  })

  it('should pad numbers correctly', () => {
    expect(generateWorkOrderNumber(0)).toHaveLength(7)
    expect(generateWorkOrderNumber(9999)).toBe('WO-10000')
  })
})

describe('Checklist Item Validation', () => {
  const checklistItemSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
    isRequired: z.boolean().default(false),
  })

  it('should validate a valid checklist item', () => {
    const item = {
      title: 'Check oil level',
      description: 'Ensure oil is at proper level',
      isRequired: true,
    }

    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('should require title', () => {
    const item = {
      description: 'No title',
      isRequired: false,
    }

    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should default isRequired to false', () => {
    const item = {
      title: 'Check oil level',
    }

    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isRequired).toBe(false)
    }
  })
})

describe('Parts Validation', () => {
  const partSchema = z.object({
    partName: z.string().min(1).max(200),
    partNumber: z.string().max(100).optional().nullable(),
    quantity: z.number().int().positive().default(1),
    unitCost: z.number().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
  })

  it('should validate a valid part', () => {
    const part = {
      partName: 'Oil Filter',
      partNumber: 'OIL-1234',
      quantity: 1,
      unitCost: 15.99,
      notes: 'OEM part',
    }

    const result = partSchema.safeParse(part)
    expect(result.success).toBe(true)
  })

  it('should require partName', () => {
    const part = {
      partNumber: 'TEST-123',
      quantity: 1,
    }

    const result = partSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should require positive quantity', () => {
    const part = {
      partName: 'Oil Filter',
      quantity: 0,
    }

    const result = partSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should default quantity to 1', () => {
    const part = {
      partName: 'Oil Filter',
    }

    const result = partSchema.safeParse(part)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
    }
  })

  it('should calculate total cost correctly', () => {
    const unitCost = 15.99
    const quantity = 3
    const totalCost = (unitCost * quantity).toFixed(2)
    expect(totalCost).toBe('47.97')
  })
})

describe('Photo Validation', () => {
  const photoSchema = z.object({
    photoUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional().nullable(),
    photoType: z.enum(['before', 'during', 'after', 'issue', 'other']).default('other'),
    caption: z.string().max(500).optional().nullable(),
  })

  it('should validate a valid photo', () => {
    const photo = {
      photoUrl: 'https://example.com/photo.jpg',
      photoType: 'before',
      caption: 'Before starting work',
    }

    const result = photoSchema.safeParse(photo)
    expect(result.success).toBe(true)
  })

  it('should require valid URL for photoUrl', () => {
    const photo = {
      photoUrl: 'not-a-url',
      photoType: 'before',
    }

    const result = photoSchema.safeParse(photo)
    expect(result.success).toBe(false)
  })

  it('should default photoType to other', () => {
    const photo = {
      photoUrl: 'https://example.com/photo.jpg',
    }

    const result = photoSchema.safeParse(photo)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.photoType).toBe('other')
    }
  })

  it('should allow all valid photo types', () => {
    const types = ['before', 'during', 'after', 'issue', 'other']
    for (const photoType of types) {
      const photo = {
        photoUrl: 'https://example.com/photo.jpg',
        photoType,
      }
      const result = photoSchema.safeParse(photo)
      expect(result.success).toBe(true)
    }
  })
})

describe('Task Template Validation', () => {
  const templateChecklistItemSchema = z.object({
    id: z.string(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    isRequired: z.boolean(),
    order: z.number().int().nonnegative(),
  })

  const templateSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
    estimatedDuration: z.number().int().positive().optional().nullable(),
    checklistItems: z.array(templateChecklistItemSchema).default([]),
    isActive: z.boolean().default(true),
  })

  it('should validate a valid template', () => {
    const template = {
      name: 'Oil Change',
      description: 'Standard oil change procedure',
      estimatedDuration: 30,
      checklistItems: [
        {
          id: '1',
          title: 'Drain oil',
          description: 'Remove drain plug',
          isRequired: true,
          order: 0,
        },
        { id: '2', title: 'Replace filter', isRequired: true, order: 1 },
        { id: '3', title: 'Add new oil', isRequired: true, order: 2 },
      ],
      isActive: true,
    }

    const result = templateSchema.safeParse(template)
    expect(result.success).toBe(true)
  })

  it('should require name', () => {
    const template = {
      description: 'No name template',
    }

    const result = templateSchema.safeParse(template)
    expect(result.success).toBe(false)
  })

  it('should default checklistItems to empty array', () => {
    const template = {
      name: 'Empty Template',
    }

    const result = templateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.checklistItems).toHaveLength(0)
    }
  })

  it('should default isActive to true', () => {
    const template = {
      name: 'Active Template',
    }

    const result = templateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(true)
    }
  })
})

describe('Work Order Filtering/Search Validation', () => {
  const filterSchema = z.object({
    search: z.string().optional(),
    status: z
      .enum([
        'draft',
        'pending_approval',
        'open',
        'in_progress',
        'pending_parts',
        'completed',
        'closed',
      ])
      .optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assignedToId: z.string().uuid().or(z.literal('null')).optional(),
    assetId: z.string().uuid().optional(),
    scheduleId: z.string().uuid().optional(),
    overdue: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
  })

  it('should validate empty filter (all work orders)', () => {
    const result = filterSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should validate filter by status', () => {
    const result = filterSchema.safeParse({ status: 'open' })
    expect(result.success).toBe(true)
  })

  it('should validate filter by priority', () => {
    const result = filterSchema.safeParse({ priority: 'high' })
    expect(result.success).toBe(true)
  })

  it('should validate filter by assignedToId as UUID', () => {
    const result = filterSchema.safeParse({
      assignedToId: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.success).toBe(true)
  })

  it('should validate filter by assignedToId as "null" for unassigned', () => {
    const result = filterSchema.safeParse({ assignedToId: 'null' })
    expect(result.success).toBe(true)
  })

  it('should validate search string', () => {
    const result = filterSchema.safeParse({ search: 'oil change' })
    expect(result.success).toBe(true)
  })

  it('should validate combined filters', () => {
    const result = filterSchema.safeParse({
      search: 'brake',
      status: 'in_progress',
      priority: 'critical',
      overdue: true,
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid status', () => {
    const result = filterSchema.safeParse({ status: 'invalid_status' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid priority', () => {
    const result = filterSchema.safeParse({ priority: 'urgent' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid assignedToId', () => {
    const result = filterSchema.safeParse({ assignedToId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('Technician Assignment Validation', () => {
  const assignmentSchema = z.object({
    assignedToId: z.string().uuid().nullable(),
  })

  it('should validate valid technician assignment', () => {
    const result = assignmentSchema.safeParse({
      assignedToId: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.success).toBe(true)
  })

  it('should validate unassignment (null)', () => {
    const result = assignmentSchema.safeParse({ assignedToId: null })
    expect(result.success).toBe(true)
  })

  it('should reject invalid UUID for technician', () => {
    const result = assignmentSchema.safeParse({ assignedToId: 'invalid-id' })
    expect(result.success).toBe(false)
  })

  it('should reject assignment without valid UUID', () => {
    const result = assignmentSchema.safeParse({ assignedToId: '' })
    expect(result.success).toBe(false)
  })
})

describe('Work Order Approval Workflow Validation', () => {
  const approvalRequestSchema = z.object({
    notes: z.string().optional(),
  })

  const approvalStatusEnum = z.enum(['pending', 'approved', 'rejected'])

  const approvalSchema = z.object({
    status: approvalStatusEnum,
    notes: z.string().optional(),
  })

  const emergencyOverrideSchema = z.object({
    reason: z.string().min(1, 'Emergency reason is required'),
    notes: z.string().optional(),
  })

  describe('Approval Request', () => {
    it('should validate approval request with notes', () => {
      const result = approvalRequestSchema.safeParse({
        notes: 'High priority work order for fleet vehicle',
      })
      expect(result.success).toBe(true)
    })

    it('should validate approval request without notes', () => {
      const result = approvalRequestSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('Approval Status', () => {
    it('should validate pending status', () => {
      const result = approvalStatusEnum.safeParse('pending')
      expect(result.success).toBe(true)
    })

    it('should validate approved status', () => {
      const result = approvalStatusEnum.safeParse('approved')
      expect(result.success).toBe(true)
    })

    it('should validate rejected status', () => {
      const result = approvalStatusEnum.safeParse('rejected')
      expect(result.success).toBe(true)
    })

    it('should reject invalid approval status', () => {
      const result = approvalStatusEnum.safeParse('cancelled')
      expect(result.success).toBe(false)
    })
  })

  describe('Emergency Override', () => {
    it('should validate emergency override with reason', () => {
      const result = emergencyOverrideSchema.safeParse({
        reason: 'Critical safety issue requiring immediate attention',
      })
      expect(result.success).toBe(true)
    })

    it('should validate emergency override with reason and notes', () => {
      const result = emergencyOverrideSchema.safeParse({
        reason: 'Vehicle brake failure',
        notes: 'Approved by fleet manager over phone',
      })
      expect(result.success).toBe(true)
    })

    it('should reject emergency override without reason', () => {
      const result = emergencyOverrideSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject emergency override with empty reason', () => {
      const result = emergencyOverrideSchema.safeParse({ reason: '' })
      expect(result.success).toBe(false)
    })
  })
})

describe('Work Order Completion Validation', () => {
  const completionSchema = z.object({
    status: z.literal('completed'),
    completionNotes: z.string().optional(),
    actualDuration: z.number().int().positive().optional(),
    signatureUrl: z.string().url().optional(),
  })

  it('should validate basic completion', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
    })
    expect(result.success).toBe(true)
  })

  it('should validate completion with notes', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      completionNotes: 'Work completed successfully. Oil changed and filter replaced.',
    })
    expect(result.success).toBe(true)
  })

  it('should validate completion with actual duration', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      actualDuration: 45,
    })
    expect(result.success).toBe(true)
  })

  it('should validate completion with signature URL', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      signatureUrl: 'https://storage.example.com/signatures/abc123.png',
    })
    expect(result.success).toBe(true)
  })

  it('should validate full completion data', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      completionNotes: 'All tasks completed',
      actualDuration: 90,
      signatureUrl: 'https://storage.example.com/signatures/def456.png',
    })
    expect(result.success).toBe(true)
  })

  it('should reject zero actual duration', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      actualDuration: 0,
    })
    expect(result.success).toBe(false)
  })

  it('should reject negative actual duration', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      actualDuration: -30,
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid signature URL', () => {
    const result = completionSchema.safeParse({
      status: 'completed',
      signatureUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('Cost Calculation Tests', () => {
  function calculatePartsCost(parts: Array<{ quantity: number; unitCost: number }>): number {
    return parts.reduce((total, part) => total + part.quantity * part.unitCost, 0)
  }

  function calculateLaborCost(actualDurationMinutes: number, hourlyRate: number): number {
    const hours = actualDurationMinutes / 60
    return hours * hourlyRate
  }

  function calculateTotalCost(partsCost: number, laborCost: number): number {
    return partsCost + laborCost
  }

  describe('Parts Cost Calculation', () => {
    it('should calculate cost for single part', () => {
      const parts = [{ quantity: 1, unitCost: 25.99 }]
      expect(calculatePartsCost(parts)).toBeCloseTo(25.99, 2)
    })

    it('should calculate cost for multiple same parts', () => {
      const parts = [{ quantity: 5, unitCost: 10.0 }]
      expect(calculatePartsCost(parts)).toBeCloseTo(50.0, 2)
    })

    it('should calculate cost for multiple different parts', () => {
      const parts = [
        { quantity: 1, unitCost: 35.0 }, // Oil filter
        { quantity: 5, unitCost: 8.99 }, // Quarts of oil
        { quantity: 1, unitCost: 2.5 }, // Drain plug gasket
      ]
      // 35.00 + 44.95 + 2.50 = 82.45
      expect(calculatePartsCost(parts)).toBeCloseTo(82.45, 2)
    })

    it('should return 0 for empty parts list', () => {
      expect(calculatePartsCost([])).toBe(0)
    })

    it('should handle decimal quantities', () => {
      const parts = [{ quantity: 2.5, unitCost: 10.0 }]
      expect(calculatePartsCost(parts)).toBeCloseTo(25.0, 2)
    })
  })

  describe('Labor Cost Calculation', () => {
    it('should calculate labor cost for 1 hour', () => {
      expect(calculateLaborCost(60, 50.0)).toBeCloseTo(50.0, 2)
    })

    it('should calculate labor cost for 30 minutes', () => {
      expect(calculateLaborCost(30, 50.0)).toBeCloseTo(25.0, 2)
    })

    it('should calculate labor cost for 90 minutes', () => {
      expect(calculateLaborCost(90, 60.0)).toBeCloseTo(90.0, 2)
    })

    it('should calculate labor cost for partial hours', () => {
      // 45 minutes at $40/hour
      expect(calculateLaborCost(45, 40.0)).toBeCloseTo(30.0, 2)
    })

    it('should return 0 for 0 duration', () => {
      expect(calculateLaborCost(0, 50.0)).toBe(0)
    })

    it('should handle high hourly rates', () => {
      expect(calculateLaborCost(120, 125.0)).toBeCloseTo(250.0, 2)
    })
  })

  describe('Total Cost Calculation', () => {
    it('should calculate total with parts and labor', () => {
      const partsCost = 82.45
      const laborCost = 50.0
      expect(calculateTotalCost(partsCost, laborCost)).toBeCloseTo(132.45, 2)
    })

    it('should calculate total with parts only', () => {
      expect(calculateTotalCost(100.0, 0)).toBeCloseTo(100.0, 2)
    })

    it('should calculate total with labor only', () => {
      expect(calculateTotalCost(0, 75.0)).toBeCloseTo(75.0, 2)
    })

    it('should return 0 for no parts and no labor', () => {
      expect(calculateTotalCost(0, 0)).toBe(0)
    })

    it('should handle large total costs', () => {
      const partsCost = 2500.0
      const laborCost = 800.0
      expect(calculateTotalCost(partsCost, laborCost)).toBeCloseTo(3300.0, 2)
    })
  })

  describe('Realistic Work Order Cost Scenarios', () => {
    it('should calculate cost for oil change work order', () => {
      const parts = [
        { quantity: 1, unitCost: 12.99 }, // Oil filter
        { quantity: 5, unitCost: 6.99 }, // Quarts synthetic oil
      ]
      const partsCost = calculatePartsCost(parts) // 12.99 + 34.95 = 47.94
      const laborCost = calculateLaborCost(30, 65.0) // 30 min at $65/hr = 32.50
      const totalCost = calculateTotalCost(partsCost, laborCost)

      expect(partsCost).toBeCloseTo(47.94, 2)
      expect(laborCost).toBeCloseTo(32.5, 2)
      expect(totalCost).toBeCloseTo(80.44, 2)
    })

    it('should calculate cost for brake replacement work order', () => {
      const parts = [
        { quantity: 1, unitCost: 89.99 }, // Brake pads set
        { quantity: 2, unitCost: 45.0 }, // Rotors
        { quantity: 1, unitCost: 15.0 }, // Brake fluid
      ]
      const partsCost = calculatePartsCost(parts) // 89.99 + 90.00 + 15.00 = 194.99
      const laborCost = calculateLaborCost(120, 75.0) // 2 hours at $75/hr = 150.00
      const totalCost = calculateTotalCost(partsCost, laborCost)

      expect(partsCost).toBeCloseTo(194.99, 2)
      expect(laborCost).toBeCloseTo(150.0, 2)
      expect(totalCost).toBeCloseTo(344.99, 2)
    })

    it('should calculate cost for diagnostic work order (labor only)', () => {
      const partsCost = calculatePartsCost([])
      const laborCost = calculateLaborCost(60, 95.0) // 1 hour diagnostic at $95/hr
      const totalCost = calculateTotalCost(partsCost, laborCost)

      expect(partsCost).toBe(0)
      expect(laborCost).toBeCloseTo(95.0, 2)
      expect(totalCost).toBeCloseTo(95.0, 2)
    })
  })
})

describe('Approval Threshold Validation', () => {
  function requiresApproval(
    estimatedCost: number,
    threshold: number | null,
    requireAllWorkOrders: boolean,
  ): { required: boolean; reason?: string } {
    if (requireAllWorkOrders) {
      return {
        required: true,
        reason: 'Organisation requires approval for all work orders',
      }
    }

    if (threshold !== null && estimatedCost >= threshold) {
      return {
        required: true,
        reason: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds threshold ($${threshold.toFixed(2)})`,
      }
    }

    return { required: false }
  }

  it('should not require approval when cost is below threshold', () => {
    const result = requiresApproval(100.0, 500.0, false)
    expect(result.required).toBe(false)
  })

  it('should require approval when cost equals threshold', () => {
    const result = requiresApproval(500.0, 500.0, false)
    expect(result.required).toBe(true)
  })

  it('should require approval when cost exceeds threshold', () => {
    const result = requiresApproval(750.0, 500.0, false)
    expect(result.required).toBe(true)
    expect(result.reason).toContain('exceeds threshold')
  })

  it('should not require approval when threshold is null', () => {
    const result = requiresApproval(1000.0, null, false)
    expect(result.required).toBe(false)
  })

  it('should require approval when requireAllWorkOrders is true', () => {
    const result = requiresApproval(50.0, 500.0, true)
    expect(result.required).toBe(true)
    expect(result.reason).toContain('all work orders')
  })

  it('should require approval for all work orders even with zero cost', () => {
    const result = requiresApproval(0, 500.0, true)
    expect(result.required).toBe(true)
  })
})
