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
