import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// ===============================================
// Schema Definitions (matching API validation)
// ===============================================

const addPartSchema = z.object({
  partId: z.string().uuid('Invalid part ID'),
  quantity: z.coerce.number().positive('Quantity must be positive').default(1),
  notes: z.string().max(500).optional().nullable(),
})

const updatePartSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be positive').optional(),
  notes: z.string().max(500).optional().nullable(),
})

const copyPartsSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
})

// ===============================================
// Test Utilities
// ===============================================

function generateUUID(): string {
  return '123e4567-e89b-12d3-a456-426614174000'
}

function createValidAddPart(overrides: Partial<z.infer<typeof addPartSchema>> = {}) {
  return {
    partId: generateUUID(),
    quantity: 2,
    notes: 'Use OEM part only',
    ...overrides,
  }
}

// ===============================================
// Add Part to Template Tests
// ===============================================

describe('Task Template Parts Schema Validation', () => {
  describe('Add Part to Template', () => {
    it('should validate a complete valid add part request', () => {
      const request = createValidAddPart()
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should validate minimal add part request with only partId', () => {
      const request = { partId: generateUUID() }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(1)
      }
    })

    it('should require partId', () => {
      const request = { quantity: 2 }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for partId', () => {
      const request = { partId: 'not-a-uuid', quantity: 1 }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid part ID')
      }
    })

    it('should default quantity to 1', () => {
      const request = { partId: generateUUID() }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(1)
      }
    })

    it('should require positive quantity', () => {
      const request = { partId: generateUUID(), quantity: 0 }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Quantity must be positive')
      }
    })

    it('should reject negative quantity', () => {
      const request = { partId: generateUUID(), quantity: -5 }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should coerce string quantity to number', () => {
      const request = { partId: generateUUID(), quantity: '5' }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(5)
        expect(typeof result.data.quantity).toBe('number')
      }
    })

    it('should accept decimal quantity (for units like liters)', () => {
      const request = { partId: generateUUID(), quantity: 5.5 }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(5.5)
      }
    })

    it('should allow notes to be optional', () => {
      const request = { partId: generateUUID(), quantity: 1 }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should allow notes to be null', () => {
      const request = { partId: generateUUID(), quantity: 1, notes: null }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should enforce notes max length of 500 characters', () => {
      const request = { partId: generateUUID(), notes: 'a'.repeat(501) }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(false)

      const validRequest = { partId: generateUUID(), notes: 'a'.repeat(500) }
      const validResult = addPartSchema.safeParse(validRequest)
      expect(validResult.success).toBe(true)
    })
  })
})

// ===============================================
// Update Template Part Tests
// ===============================================

describe('Update Template Part Schema Validation', () => {
  describe('Update Part Quantity', () => {
    it('should validate updating only quantity', () => {
      const update = { quantity: 5 }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate updating only notes', () => {
      const update = { notes: 'Updated notes' }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate updating both quantity and notes', () => {
      const update = { quantity: 3, notes: 'Updated' }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow empty object (no changes)', () => {
      const update = {}
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should require positive quantity when provided', () => {
      const update = { quantity: 0 }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should reject negative quantity', () => {
      const update = { quantity: -1 }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should coerce string quantity to number', () => {
      const update = { quantity: '10' }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(10)
      }
    })

    it('should allow clearing notes with null', () => {
      const update = { notes: null }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should enforce notes max length when updating', () => {
      const update = { notes: 'a'.repeat(501) }
      const result = updatePartSchema.safeParse(update)
      expect(result.success).toBe(false)
    })
  })
})

// ===============================================
// Copy Parts to Work Order Tests
// ===============================================

describe('Copy Parts to Work Order Schema Validation', () => {
  describe('Copy Parts Request', () => {
    it('should validate a valid copy request', () => {
      const request = { workOrderId: generateUUID() }
      const result = copyPartsSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should require workOrderId', () => {
      const request = {}
      const result = copyPartsSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for workOrderId', () => {
      const request = { workOrderId: 'not-a-uuid' }
      const result = copyPartsSchema.safeParse(request)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid work order ID')
      }
    })

    it('should reject null workOrderId', () => {
      const request = { workOrderId: null }
      const result = copyPartsSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should reject empty string workOrderId', () => {
      const request = { workOrderId: '' }
      const result = copyPartsSchema.safeParse(request)
      expect(result.success).toBe(false)
    })
  })
})

// ===============================================
// Part Quantity Validation Edge Cases
// ===============================================

describe('Part Quantity Validation Edge Cases', () => {
  it('should accept small decimal quantities', () => {
    const request = { partId: generateUUID(), quantity: 0.5 }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  it('should accept large quantities', () => {
    const request = { partId: generateUUID(), quantity: 9999 }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  it('should accept very small positive quantities', () => {
    const request = { partId: generateUUID(), quantity: 0.01 }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  it('should reject quantity of exactly 0', () => {
    const request = { partId: generateUUID(), quantity: 0 }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(false)
  })
})

// ===============================================
// Business Logic Tests
// ===============================================

describe('Template Parts Business Logic', () => {
  describe('Cost Calculation', () => {
    interface TemplatePart {
      id: string
      partId: string
      quantity: number
      part: {
        name: string
        unitCost: number | null
        quantityInStock: number
      }
    }

    function calculateLineCost(templatePart: TemplatePart): string {
      const unitCost = templatePart.part.unitCost || 0
      return (unitCost * templatePart.quantity).toFixed(2)
    }

    function calculateTotalCost(templateParts: TemplatePart[]): string {
      const total = templateParts.reduce((sum, tp) => {
        const unitCost = tp.part.unitCost || 0
        return sum + unitCost * tp.quantity
      }, 0)
      return total.toFixed(2)
    }

    it('should calculate line cost correctly', () => {
      const templatePart: TemplatePart = {
        id: '1',
        partId: 'p1',
        quantity: 3,
        part: { name: 'Oil Filter', unitCost: 15.99, quantityInStock: 10 },
      }

      expect(calculateLineCost(templatePart)).toBe('47.97')
    })

    it('should handle null unit cost', () => {
      const templatePart: TemplatePart = {
        id: '1',
        partId: 'p1',
        quantity: 3,
        part: { name: 'Free Part', unitCost: null, quantityInStock: 10 },
      }

      expect(calculateLineCost(templatePart)).toBe('0.00')
    })

    it('should calculate total cost for multiple parts', () => {
      const templateParts: TemplatePart[] = [
        {
          id: '1',
          partId: 'p1',
          quantity: 1,
          part: { name: 'Oil Filter', unitCost: 15.99, quantityInStock: 10 },
        },
        {
          id: '2',
          partId: 'p2',
          quantity: 5,
          part: { name: 'Engine Oil', unitCost: 8.99, quantityInStock: 20 },
        },
        {
          id: '3',
          partId: 'p3',
          quantity: 1,
          part: { name: 'Drain Plug', unitCost: 2.5, quantityInStock: 50 },
        },
      ]

      // 15.99 + (5 * 8.99) + 2.50 = 15.99 + 44.95 + 2.50 = 63.44
      expect(calculateTotalCost(templateParts)).toBe('63.44')
    })
  })

  describe('Stock Availability', () => {
    interface TemplatePart {
      quantity: number
      part: {
        quantityInStock: number
      }
    }

    function isInStock(templatePart: TemplatePart): boolean {
      return templatePart.part.quantityInStock >= templatePart.quantity
    }

    function checkAllPartsAvailable(templateParts: TemplatePart[]): {
      allAvailable: boolean
      unavailable: number[]
    } {
      const unavailable: number[] = []
      for (let i = 0; i < templateParts.length; i++) {
        if (!isInStock(templateParts[i])) {
          unavailable.push(i)
        }
      }
      return {
        allAvailable: unavailable.length === 0,
        unavailable,
      }
    }

    it('should return true when stock is sufficient', () => {
      const templatePart: TemplatePart = {
        quantity: 5,
        part: { quantityInStock: 10 },
      }
      expect(isInStock(templatePart)).toBe(true)
    })

    it('should return true when stock equals required quantity', () => {
      const templatePart: TemplatePart = {
        quantity: 5,
        part: { quantityInStock: 5 },
      }
      expect(isInStock(templatePart)).toBe(true)
    })

    it('should return false when stock is insufficient', () => {
      const templatePart: TemplatePart = {
        quantity: 10,
        part: { quantityInStock: 5 },
      }
      expect(isInStock(templatePart)).toBe(false)
    })

    it('should identify all unavailable parts', () => {
      const templateParts: TemplatePart[] = [
        { quantity: 2, part: { quantityInStock: 10 } },
        { quantity: 5, part: { quantityInStock: 3 } }, // Insufficient
        { quantity: 1, part: { quantityInStock: 1 } },
        { quantity: 8, part: { quantityInStock: 5 } }, // Insufficient
      ]

      const result = checkAllPartsAvailable(templateParts)
      expect(result.allAvailable).toBe(false)
      expect(result.unavailable).toEqual([1, 3])
    })

    it('should return all available when stock is sufficient', () => {
      const templateParts: TemplatePart[] = [
        { quantity: 2, part: { quantityInStock: 10 } },
        { quantity: 5, part: { quantityInStock: 10 } },
      ]

      const result = checkAllPartsAvailable(templateParts)
      expect(result.allAvailable).toBe(true)
      expect(result.unavailable).toEqual([])
    })
  })

  describe('Copy to Work Order Logic', () => {
    interface TemplatePart {
      quantity: number
      notes: string | null
      part: {
        id: string
        name: string
        sku: string
        unitCost: string | null
      }
    }

    interface WorkOrderPart {
      partName: string
      partNumber: string
      quantity: number
      unitCost: string | null
      totalCost: string
      notes: string
    }

    function copyPartToWorkOrder(templatePart: TemplatePart, templateName: string): WorkOrderPart {
      const quantity = templatePart.quantity
      const unitCost = templatePart.part.unitCost ? parseFloat(templatePart.part.unitCost) : 0
      const totalCost = (unitCost * quantity).toFixed(2)

      return {
        partName: templatePart.part.name,
        partNumber: templatePart.part.sku,
        quantity: Math.round(quantity),
        unitCost: templatePart.part.unitCost,
        totalCost,
        notes: templatePart.notes || `Copied from template: ${templateName}`,
      }
    }

    it('should copy part with all fields', () => {
      const templatePart: TemplatePart = {
        quantity: 2,
        notes: 'OEM only',
        part: {
          id: 'p1',
          name: 'Oil Filter',
          sku: 'OIL-1234',
          unitCost: '15.99',
        },
      }

      const copied = copyPartToWorkOrder(templatePart, 'Oil Change')

      expect(copied.partName).toBe('Oil Filter')
      expect(copied.partNumber).toBe('OIL-1234')
      expect(copied.quantity).toBe(2)
      expect(copied.unitCost).toBe('15.99')
      expect(copied.totalCost).toBe('31.98')
      expect(copied.notes).toBe('OEM only')
    })

    it('should use default notes when template part has no notes', () => {
      const templatePart: TemplatePart = {
        quantity: 1,
        notes: null,
        part: {
          id: 'p1',
          name: 'Oil Filter',
          sku: 'OIL-1234',
          unitCost: '15.99',
        },
      }

      const copied = copyPartToWorkOrder(templatePart, 'Oil Change')

      expect(copied.notes).toBe('Copied from template: Oil Change')
    })

    it('should round decimal quantities for work order', () => {
      const templatePart: TemplatePart = {
        quantity: 5.7,
        notes: null,
        part: {
          id: 'p1',
          name: 'Engine Oil',
          sku: 'OIL-5W30',
          unitCost: '8.99',
        },
      }

      const copied = copyPartToWorkOrder(templatePart, 'Oil Change')

      expect(copied.quantity).toBe(6)
    })

    it('should handle null unit cost', () => {
      const templatePart: TemplatePart = {
        quantity: 1,
        notes: null,
        part: {
          id: 'p1',
          name: 'Free Part',
          sku: 'FREE-001',
          unitCost: null,
        },
      }

      const copied = copyPartToWorkOrder(templatePart, 'Template')

      expect(copied.unitCost).toBeNull()
      expect(copied.totalCost).toBe('0.00')
    })
  })

  describe('Work Order Status Validation for Parts', () => {
    const closedStatuses = ['closed', 'completed']
    const openStatuses = ['draft', 'open', 'in_progress', 'pending_parts']

    function canAddParts(status: string): boolean {
      return !closedStatuses.includes(status)
    }

    it('should allow adding parts to open work orders', () => {
      for (const status of openStatuses) {
        expect(canAddParts(status)).toBe(true)
      }
    })

    it('should prevent adding parts to closed work orders', () => {
      for (const status of closedStatuses) {
        expect(canAddParts(status)).toBe(false)
      }
    })
  })
})

// ===============================================
// Duplicate Part Detection Tests
// ===============================================

describe('Duplicate Part Detection', () => {
  interface ExistingPart {
    templateId: string
    partId: string
  }

  function isDuplicatePart(
    templateId: string,
    partId: string,
    existingParts: ExistingPart[],
  ): boolean {
    return existingParts.some((p) => p.templateId === templateId && p.partId === partId)
  }

  it('should detect duplicate part', () => {
    const existingParts: ExistingPart[] = [
      { templateId: 't1', partId: 'p1' },
      { templateId: 't1', partId: 'p2' },
    ]

    expect(isDuplicatePart('t1', 'p1', existingParts)).toBe(true)
  })

  it('should allow same part in different templates', () => {
    const existingParts: ExistingPart[] = [
      { templateId: 't1', partId: 'p1' },
      { templateId: 't2', partId: 'p2' },
    ]

    expect(isDuplicatePart('t2', 'p1', existingParts)).toBe(false)
  })

  it('should allow adding new part to template', () => {
    const existingParts: ExistingPart[] = [
      { templateId: 't1', partId: 'p1' },
      { templateId: 't1', partId: 'p2' },
    ]

    expect(isDuplicatePart('t1', 'p3', existingParts)).toBe(false)
  })

  it('should handle empty existing parts', () => {
    const existingParts: ExistingPart[] = []
    expect(isDuplicatePart('t1', 'p1', existingParts)).toBe(false)
  })
})

// ===============================================
// Notes Validation Edge Cases
// ===============================================

describe('Notes Validation Edge Cases', () => {
  it('should accept notes with special characters', () => {
    const notes = [
      'Use OEM part only!',
      "Check manufacturer's specifications",
      'Qty: 5 @ $15.99/ea',
      'Part #ABC-123 (alternative: XYZ-456)',
    ]

    for (const note of notes) {
      const request = { partId: generateUUID(), notes: note }
      const result = addPartSchema.safeParse(request)
      expect(result.success).toBe(true)
    }
  })

  it('should accept notes with newlines', () => {
    const request = {
      partId: generateUUID(),
      notes: 'Line 1\nLine 2\nLine 3',
    }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  it('should accept empty string as notes', () => {
    const request = { partId: generateUUID(), notes: '' }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  it('should accept notes with unicode characters', () => {
    const request = {
      partId: generateUUID(),
      notes: 'Verificar especificaciones del fabricante',
    }
    const result = addPartSchema.safeParse(request)
    expect(result.success).toBe(true)
  })
})
