import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Inventory Transfers Schema Validation Tests
 * Tests for inventory transfer management including validation and status transitions.
 */

// Create transfer schema
const createTransferSchema = z.object({
  partId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
})

// Transfer query schema
const queryTransfersSchema = z.object({
  partId: z.string().uuid().optional(),
  fromLocationId: z.string().uuid().optional(),
  toLocationId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

describe('Inventory Transfer Schema Validation', () => {
  describe('Create Transfer', () => {
    it('should validate a minimal valid transfer', () => {
      const validTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(validTransfer)
      expect(result.success).toBe(true)
    })

    it('should validate a complete transfer with all fields', () => {
      const validTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 25.5,
        notes: 'Transferring to new warehouse',
        referenceNumber: 'TRF-2024-001',
      }

      const result = createTransferSchema.safeParse(validTransfer)
      expect(result.success).toBe(true)
    })

    it('should require partId', () => {
      const invalidTransfer = {
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should require fromLocationId', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should require toLocationId', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should require positive quantity', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 0,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should reject negative quantity', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: -5,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for partId', () => {
      const invalidTransfer = {
        partId: 'not-a-uuid',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for fromLocationId', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: 'invalid',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for toLocationId', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: 'invalid',
        quantity: 10,
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should enforce referenceNumber max length of 100', () => {
      const invalidTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
        referenceNumber: 'a'.repeat(101),
      }

      const result = createTransferSchema.safeParse(invalidTransfer)
      expect(result.success).toBe(false)
    })

    it('should allow decimal quantities', () => {
      const validTransfer = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 5.75,
      }

      const result = createTransferSchema.safeParse(validTransfer)
      expect(result.success).toBe(true)
    })
  })

  describe('Query Transfers', () => {
    it('should validate default query', () => {
      const query = {}

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0)
      }
    })

    it('should validate query by partId', () => {
      const query = {
        partId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate query by fromLocationId', () => {
      const query = {
        fromLocationId: '123e4567-e89b-12d3-a456-426614174001',
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate query by toLocationId', () => {
      const query = {
        toLocationId: '123e4567-e89b-12d3-a456-426614174002',
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate date range filter', () => {
      const query = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should reject invalid date format', () => {
      const query = {
        startDate: 'invalid-date',
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should validate pagination', () => {
      const query = {
        limit: 25,
        offset: 50,
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should reject limit above max', () => {
      const query = {
        limit: 150,
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const query = {
        offset: -10,
      }

      const result = queryTransfersSchema.safeParse(query)
      expect(result.success).toBe(false)
    })
  })
})

describe('Transfer Validation Rules', () => {
  describe('Location Validation', () => {
    function validateTransferLocations(
      fromLocationId: string,
      toLocationId: string,
    ): { valid: boolean; error?: string } {
      if (fromLocationId === toLocationId) {
        return {
          valid: false,
          error: 'Source and destination locations must be different',
        }
      }
      return { valid: true }
    }

    it('should reject same source and destination', () => {
      const result = validateTransferLocations('loc-1', 'loc-1')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Source and destination locations must be different')
    })

    it('should accept different locations', () => {
      const result = validateTransferLocations('loc-1', 'loc-2')
      expect(result.valid).toBe(true)
    })
  })

  describe('Quantity Validation', () => {
    function validateTransferQuantity(
      requestedQuantity: number,
      availableQuantity: number,
    ): { valid: boolean; error?: string } {
      if (requestedQuantity <= 0) {
        return {
          valid: false,
          error: 'Quantity must be positive',
        }
      }

      if (requestedQuantity > availableQuantity) {
        return {
          valid: false,
          error: `Insufficient quantity at source location. Available: ${availableQuantity}, Required: ${requestedQuantity}`,
        }
      }

      return { valid: true }
    }

    it('should accept valid quantity', () => {
      const result = validateTransferQuantity(10, 50)
      expect(result.valid).toBe(true)
    })

    it('should accept quantity equal to available', () => {
      const result = validateTransferQuantity(50, 50)
      expect(result.valid).toBe(true)
    })

    it('should reject quantity exceeding available', () => {
      const result = validateTransferQuantity(60, 50)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Insufficient quantity')
    })

    it('should reject zero quantity', () => {
      const result = validateTransferQuantity(0, 50)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Quantity must be positive')
    })

    it('should reject negative quantity', () => {
      const result = validateTransferQuantity(-10, 50)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Quantity must be positive')
    })

    it('should handle decimal quantities', () => {
      const result = validateTransferQuantity(5.5, 10.0)
      expect(result.valid).toBe(true)
    })

    it('should reject decimal quantity exceeding available', () => {
      const result = validateTransferQuantity(10.5, 10.0)
      expect(result.valid).toBe(false)
    })
  })
})

describe('Transfer Processing', () => {
  describe('Quantity Updates', () => {
    interface LocationQuantity {
      locationId: string
      partId: string
      quantity: number
    }

    function processTransfer(
      fromLocationId: string,
      toLocationId: string,
      partId: string,
      quantity: number,
      existingQuantities: LocationQuantity[],
    ): { success: boolean; updatedQuantities: LocationQuantity[]; error?: string } {
      // Find source quantity
      const fromIndex = existingQuantities.findIndex(
        (q) => q.locationId === fromLocationId && q.partId === partId,
      )

      if (fromIndex === -1) {
        return {
          success: false,
          updatedQuantities: existingQuantities,
          error: 'Part not found at source location',
        }
      }

      const fromQuantity = existingQuantities[fromIndex]
      if (fromQuantity.quantity < quantity) {
        return {
          success: false,
          updatedQuantities: existingQuantities,
          error: `Insufficient quantity. Available: ${fromQuantity.quantity}`,
        }
      }

      // Clone the array for immutability
      const updated = [...existingQuantities]

      // Update source
      const newFromQuantity = fromQuantity.quantity - quantity
      if (newFromQuantity === 0) {
        updated.splice(fromIndex, 1)
      } else {
        updated[fromIndex] = { ...fromQuantity, quantity: newFromQuantity }
      }

      // Update destination
      const toIndex = updated.findIndex((q) => q.locationId === toLocationId && q.partId === partId)

      if (toIndex === -1) {
        updated.push({
          locationId: toLocationId,
          partId,
          quantity,
        })
      } else {
        updated[toIndex] = {
          ...updated[toIndex],
          quantity: updated[toIndex].quantity + quantity,
        }
      }

      return { success: true, updatedQuantities: updated }
    }

    it('should transfer quantity between locations', () => {
      const existing = [
        { locationId: 'loc-1', partId: 'part-1', quantity: 50 },
        { locationId: 'loc-2', partId: 'part-1', quantity: 20 },
      ]

      const result = processTransfer('loc-1', 'loc-2', 'part-1', 10, existing)

      expect(result.success).toBe(true)
      const fromQty = result.updatedQuantities.find((q) => q.locationId === 'loc-1')
      const toQty = result.updatedQuantities.find((q) => q.locationId === 'loc-2')

      expect(fromQty?.quantity).toBe(40)
      expect(toQty?.quantity).toBe(30)
    })

    it('should create destination record if not exists', () => {
      const existing = [{ locationId: 'loc-1', partId: 'part-1', quantity: 50 }]

      const result = processTransfer('loc-1', 'loc-2', 'part-1', 10, existing)

      expect(result.success).toBe(true)
      const toQty = result.updatedQuantities.find((q) => q.locationId === 'loc-2')

      expect(toQty).toBeDefined()
      expect(toQty?.quantity).toBe(10)
    })

    it('should remove source record when quantity becomes zero', () => {
      const existing = [{ locationId: 'loc-1', partId: 'part-1', quantity: 10 }]

      const result = processTransfer('loc-1', 'loc-2', 'part-1', 10, existing)

      expect(result.success).toBe(true)
      const fromQty = result.updatedQuantities.find((q) => q.locationId === 'loc-1')

      expect(fromQty).toBeUndefined()
    })

    it('should fail if part not at source location', () => {
      const existing = [{ locationId: 'loc-1', partId: 'part-2', quantity: 50 }]

      const result = processTransfer('loc-1', 'loc-2', 'part-1', 10, existing)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Part not found at source location')
    })

    it('should fail if insufficient quantity', () => {
      const existing = [{ locationId: 'loc-1', partId: 'part-1', quantity: 5 }]

      const result = processTransfer('loc-1', 'loc-2', 'part-1', 10, existing)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient quantity')
    })

    it('should handle decimal quantities correctly', () => {
      const existing = [
        { locationId: 'loc-1', partId: 'part-1', quantity: 10.5 },
        { locationId: 'loc-2', partId: 'part-1', quantity: 5.25 },
      ]

      const result = processTransfer('loc-1', 'loc-2', 'part-1', 2.5, existing)

      expect(result.success).toBe(true)
      const fromQty = result.updatedQuantities.find((q) => q.locationId === 'loc-1')
      const toQty = result.updatedQuantities.find((q) => q.locationId === 'loc-2')

      expect(fromQty?.quantity).toBe(8)
      expect(toQty?.quantity).toBe(7.75)
    })
  })

  describe('Transfer Reference Number', () => {
    function generateTransferNumber(lastNumber: number, prefix = 'TRF'): string {
      const year = new Date().getFullYear()
      return `${prefix}-${year}-${String(lastNumber + 1).padStart(5, '0')}`
    }

    it('should generate first transfer number of year', () => {
      const year = new Date().getFullYear()
      expect(generateTransferNumber(0)).toBe(`TRF-${year}-00001`)
    })

    it('should generate sequential numbers', () => {
      const year = new Date().getFullYear()
      expect(generateTransferNumber(1)).toBe(`TRF-${year}-00002`)
      expect(generateTransferNumber(99)).toBe(`TRF-${year}-00100`)
      expect(generateTransferNumber(9999)).toBe(`TRF-${year}-10000`)
    })

    it('should use custom prefix', () => {
      const year = new Date().getFullYear()
      expect(generateTransferNumber(0, 'INV')).toBe(`INV-${year}-00001`)
    })
  })

  describe('Transfer History', () => {
    interface Transfer {
      id: string
      partId: string
      fromLocationId: string
      toLocationId: string
      quantity: number
      createdAt: Date
    }

    function getPartMovementHistory(partId: string, transfers: Transfer[]): Transfer[] {
      return transfers
        .filter((t) => t.partId === partId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    function calculateNetMovement(locationId: string, transfers: Transfer[]): number {
      let net = 0
      for (const transfer of transfers) {
        if (transfer.toLocationId === locationId) {
          net += transfer.quantity
        }
        if (transfer.fromLocationId === locationId) {
          net -= transfer.quantity
        }
      }
      return net
    }

    it('should filter transfers by part', () => {
      const transfers: Transfer[] = [
        {
          id: '1',
          partId: 'part-1',
          fromLocationId: 'loc-1',
          toLocationId: 'loc-2',
          quantity: 10,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          partId: 'part-2',
          fromLocationId: 'loc-1',
          toLocationId: 'loc-2',
          quantity: 5,
          createdAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          partId: 'part-1',
          fromLocationId: 'loc-2',
          toLocationId: 'loc-3',
          quantity: 5,
          createdAt: new Date('2024-01-03'),
        },
      ]

      const history = getPartMovementHistory('part-1', transfers)
      expect(history).toHaveLength(2)
      expect(history[0].id).toBe('3') // Most recent first
    })

    it('should calculate net movement for location', () => {
      const transfers: Transfer[] = [
        {
          id: '1',
          partId: 'part-1',
          fromLocationId: 'loc-1',
          toLocationId: 'loc-2',
          quantity: 10,
          createdAt: new Date(),
        },
        {
          id: '2',
          partId: 'part-1',
          fromLocationId: 'loc-2',
          toLocationId: 'loc-3',
          quantity: 3,
          createdAt: new Date(),
        },
      ]

      // loc-2 received 10, sent 3 = net +7
      expect(calculateNetMovement('loc-2', transfers)).toBe(7)

      // loc-1 only sent = net -10
      expect(calculateNetMovement('loc-1', transfers)).toBe(-10)

      // loc-3 only received = net +3
      expect(calculateNetMovement('loc-3', transfers)).toBe(3)
    })

    it('should handle empty transfer history', () => {
      const history = getPartMovementHistory('part-1', [])
      expect(history).toHaveLength(0)

      const net = calculateNetMovement('loc-1', [])
      expect(net).toBe(0)
    })
  })
})

describe('Transfer Business Rules', () => {
  describe('Active Location Requirement', () => {
    function canTransferToLocation(location: { isActive: boolean } | null): {
      allowed: boolean
      error?: string
    } {
      if (!location) {
        return { allowed: false, error: 'Location not found' }
      }
      if (!location.isActive) {
        return { allowed: false, error: 'Cannot transfer to inactive location' }
      }
      return { allowed: true }
    }

    function canTransferFromLocation(location: { isActive: boolean } | null): {
      allowed: boolean
      error?: string
    } {
      if (!location) {
        return { allowed: false, error: 'Location not found' }
      }
      if (!location.isActive) {
        return { allowed: false, error: 'Cannot transfer from inactive location' }
      }
      return { allowed: true }
    }

    it('should allow transfer to active location', () => {
      const result = canTransferToLocation({ isActive: true })
      expect(result.allowed).toBe(true)
    })

    it('should reject transfer to inactive location', () => {
      const result = canTransferToLocation({ isActive: false })
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Cannot transfer to inactive location')
    })

    it('should reject transfer to non-existent location', () => {
      const result = canTransferToLocation(null)
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Location not found')
    })

    it('should allow transfer from active location', () => {
      const result = canTransferFromLocation({ isActive: true })
      expect(result.allowed).toBe(true)
    })

    it('should reject transfer from inactive location', () => {
      const result = canTransferFromLocation({ isActive: false })
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Cannot transfer from inactive location')
    })
  })

  describe('Part Existence Check', () => {
    function canTransferPart(part: { isActive: boolean } | null): {
      allowed: boolean
      error?: string
    } {
      if (!part) {
        return { allowed: false, error: 'Part not found' }
      }
      if (!part.isActive) {
        return { allowed: false, error: 'Cannot transfer inactive part' }
      }
      return { allowed: true }
    }

    it('should allow transfer of active part', () => {
      const result = canTransferPart({ isActive: true })
      expect(result.allowed).toBe(true)
    })

    it('should reject transfer of inactive part', () => {
      const result = canTransferPart({ isActive: false })
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Cannot transfer inactive part')
    })

    it('should reject transfer of non-existent part', () => {
      const result = canTransferPart(null)
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Part not found')
    })
  })

  describe('Batch Transfer', () => {
    interface BatchTransferItem {
      partId: string
      quantity: number
    }

    function validateBatchTransfer(
      items: BatchTransferItem[],
      fromLocationId: string,
      toLocationId: string,
    ): { valid: boolean; errors: string[] } {
      const errors: string[] = []

      if (items.length === 0) {
        errors.push('At least one item required for batch transfer')
      }

      if (fromLocationId === toLocationId) {
        errors.push('Source and destination must be different')
      }

      for (let i = 0; i < items.length; i++) {
        if (items[i].quantity <= 0) {
          errors.push(`Item ${i + 1}: Quantity must be positive`)
        }
      }

      // Check for duplicate parts
      const partIds = items.map((i) => i.partId)
      const uniquePartIds = new Set(partIds)
      if (uniquePartIds.size !== partIds.length) {
        errors.push('Duplicate parts in batch transfer')
      }

      return { valid: errors.length === 0, errors }
    }

    it('should validate valid batch transfer', () => {
      const items = [
        { partId: 'part-1', quantity: 10 },
        { partId: 'part-2', quantity: 5 },
      ]

      const result = validateBatchTransfer(items, 'loc-1', 'loc-2')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty batch', () => {
      const result = validateBatchTransfer([], 'loc-1', 'loc-2')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one item required for batch transfer')
    })

    it('should reject same source and destination', () => {
      const items = [{ partId: 'part-1', quantity: 10 }]
      const result = validateBatchTransfer(items, 'loc-1', 'loc-1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Source and destination must be different')
    })

    it('should reject items with non-positive quantity', () => {
      const items = [
        { partId: 'part-1', quantity: 10 },
        { partId: 'part-2', quantity: 0 },
      ]

      const result = validateBatchTransfer(items, 'loc-1', 'loc-2')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Item 2: Quantity must be positive')
    })

    it('should reject duplicate parts', () => {
      const items = [
        { partId: 'part-1', quantity: 10 },
        { partId: 'part-1', quantity: 5 },
      ]

      const result = validateBatchTransfer(items, 'loc-1', 'loc-2')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate parts in batch transfer')
    })
  })
})
