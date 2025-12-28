import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Parts Schema Validation Tests
 * Tests for part management including schema validation, stock levels, and adjustments.
 */

// Part unit enum schema
const partUnitSchema = z.enum([
  'each',
  'liters',
  'gallons',
  'kg',
  'lbs',
  'meters',
  'feet',
  'box',
  'set',
  'pair',
])

// Create part schema
const createPartSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  unit: partUnitSchema.default('each'),
  quantityInStock: z.number().nonnegative().default(0),
  minimumStock: z.number().nonnegative().optional().nullable(),
  reorderThreshold: z.number().nonnegative().optional().nullable(),
  reorderQuantity: z.number().positive().optional().nullable(),
  unitCost: z.number().nonnegative().optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  supplierPartNumber: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
})

// Update part schema
const updatePartSchema = createPartSchema.partial().omit({ sku: true })

// Stock adjustment schema
const adjustStockSchema = z.object({
  usageType: z.enum(['adjustment', 'restock', 'return', 'damaged', 'expired']),
  quantityChange: z.number().refine((val) => val !== 0, 'Quantity change cannot be zero'),
  notes: z.string().optional(),
  reference: z.string().max(200).optional(),
})

// Search/filter schema
const searchPartsSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  includeInactive: z.boolean().default(false),
  lowStock: z.boolean().default(false),
  supplier: z.string().optional(),
  location: z.string().optional(),
  minCost: z.number().nonnegative().optional(),
  maxCost: z.number().nonnegative().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z
    .enum([
      'sku',
      'name',
      'quantityInStock',
      'unitCost',
      'supplier',
      'location',
      'createdAt',
      'updatedAt',
    ])
    .default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

describe('Parts Schema Validation', () => {
  describe('Part Unit Enum', () => {
    it('should accept valid unit values', () => {
      const validUnits = [
        'each',
        'liters',
        'gallons',
        'kg',
        'lbs',
        'meters',
        'feet',
        'box',
        'set',
        'pair',
      ]
      for (const unit of validUnits) {
        const result = partUnitSchema.safeParse(unit)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid unit values', () => {
      const invalidUnits = ['pieces', 'units', 'items', 'quantity']
      for (const unit of invalidUnits) {
        const result = partUnitSchema.safeParse(unit)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('Create Part', () => {
    it('should validate a minimal valid part', () => {
      const validPart = {
        sku: 'OIL-001',
        name: 'Engine Oil 5W-30',
      }

      const result = createPartSchema.safeParse(validPart)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.unit).toBe('each')
        expect(result.data.quantityInStock).toBe(0)
      }
    })

    it('should validate a complete part with all fields', () => {
      const validPart = {
        sku: 'OIL-001',
        name: 'Engine Oil 5W-30',
        description: 'Synthetic motor oil for modern engines',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        unit: 'liters',
        quantityInStock: 50,
        minimumStock: 10,
        reorderThreshold: 15,
        reorderQuantity: 100,
        unitCost: 12.99,
        supplier: 'AutoParts Inc',
        supplierPartNumber: 'AP-OIL-5W30',
        location: 'Warehouse A, Shelf 3',
      }

      const result = createPartSchema.safeParse(validPart)
      expect(result.success).toBe(true)
    })

    it('should require SKU', () => {
      const invalidPart = {
        name: 'Engine Oil 5W-30',
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should require name', () => {
      const invalidPart = {
        sku: 'OIL-001',
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should enforce SKU max length of 50', () => {
      const invalidPart = {
        sku: 'a'.repeat(51),
        name: 'Test Part',
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 200', () => {
      const invalidPart = {
        sku: 'TEST-001',
        name: 'a'.repeat(201),
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for categoryId', () => {
      const invalidPart = {
        sku: 'TEST-001',
        name: 'Test Part',
        categoryId: 'not-a-uuid',
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should reject negative quantities', () => {
      const invalidPart = {
        sku: 'TEST-001',
        name: 'Test Part',
        quantityInStock: -10,
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should reject negative unit cost', () => {
      const invalidPart = {
        sku: 'TEST-001',
        name: 'Test Part',
        unitCost: -5.99,
      }

      const result = createPartSchema.safeParse(invalidPart)
      expect(result.success).toBe(false)
    })

    it('should allow null for optional fields', () => {
      const validPart = {
        sku: 'TEST-001',
        name: 'Test Part',
        description: null,
        categoryId: null,
        minimumStock: null,
        reorderThreshold: null,
        reorderQuantity: null,
        unitCost: null,
        supplier: null,
        supplierPartNumber: null,
        location: null,
      }

      const result = createPartSchema.safeParse(validPart)
      expect(result.success).toBe(true)
    })
  })

  describe('Update Part', () => {
    it('should allow partial updates', () => {
      const validUpdate = {
        name: 'Updated Part Name',
      }

      const result = updatePartSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should not allow SKU updates', () => {
      const updateWithSku = {
        sku: 'NEW-SKU',
        name: 'Test',
      }

      const result = updatePartSchema.safeParse(updateWithSku)
      // SKU should be stripped, not cause an error
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('sku')
      }
    })

    it('should allow updating unit cost', () => {
      const validUpdate = {
        unitCost: 25.99,
      }

      const result = updatePartSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow updating stock thresholds', () => {
      const validUpdate = {
        minimumStock: 5,
        reorderThreshold: 10,
        reorderQuantity: 50,
      }

      const result = updatePartSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })
  })
})

describe('Stock Level Validation', () => {
  describe('Stock Thresholds', () => {
    function isLowStock(quantityInStock: number, reorderThreshold: number | null): boolean {
      if (reorderThreshold === null) return false
      return quantityInStock <= reorderThreshold
    }

    function needsReorder(
      quantityInStock: number,
      minimumStock: number | null,
      reorderThreshold: number | null,
    ): boolean {
      if (reorderThreshold !== null && quantityInStock <= reorderThreshold) {
        return true
      }
      if (minimumStock !== null && quantityInStock <= minimumStock) {
        return true
      }
      return false
    }

    it('should identify low stock when at threshold', () => {
      expect(isLowStock(10, 10)).toBe(true)
    })

    it('should identify low stock when below threshold', () => {
      expect(isLowStock(5, 10)).toBe(true)
    })

    it('should not flag low stock when above threshold', () => {
      expect(isLowStock(15, 10)).toBe(false)
    })

    it('should not flag low stock when threshold is null', () => {
      expect(isLowStock(0, null)).toBe(false)
    })

    it('should need reorder when at reorder threshold', () => {
      expect(needsReorder(10, 5, 10)).toBe(true)
    })

    it('should need reorder when at minimum stock', () => {
      expect(needsReorder(5, 5, 10)).toBe(true)
    })

    it('should not need reorder when above all thresholds', () => {
      expect(needsReorder(20, 5, 10)).toBe(false)
    })

    it('should handle null thresholds', () => {
      expect(needsReorder(5, null, null)).toBe(false)
    })
  })

  describe('Stock Value Calculation', () => {
    function calculateStockValue(quantityInStock: number, unitCost: number | null): number {
      if (unitCost === null) return 0
      return quantityInStock * unitCost
    }

    it('should calculate stock value correctly', () => {
      expect(calculateStockValue(10, 5.99)).toBeCloseTo(59.9)
    })

    it('should return zero when no unit cost', () => {
      expect(calculateStockValue(10, null)).toBe(0)
    })

    it('should return zero when no stock', () => {
      expect(calculateStockValue(0, 5.99)).toBe(0)
    })

    it('should handle decimal quantities', () => {
      expect(calculateStockValue(2.5, 10)).toBe(25)
    })
  })
})

describe('Stock Adjustment Validation', () => {
  describe('Adjustment Schema', () => {
    it('should validate a valid stock increase', () => {
      const adjustment = {
        usageType: 'restock',
        quantityChange: 50,
        notes: 'Received shipment',
        reference: 'PO-12345',
      }

      const result = adjustStockSchema.safeParse(adjustment)
      expect(result.success).toBe(true)
    })

    it('should validate a valid stock decrease', () => {
      const adjustment = {
        usageType: 'adjustment',
        quantityChange: -10,
        notes: 'Correcting inventory count',
      }

      const result = adjustStockSchema.safeParse(adjustment)
      expect(result.success).toBe(true)
    })

    it('should reject zero quantity change', () => {
      const adjustment = {
        usageType: 'adjustment',
        quantityChange: 0,
      }

      const result = adjustStockSchema.safeParse(adjustment)
      expect(result.success).toBe(false)
    })

    it('should require valid usage type', () => {
      const adjustment = {
        usageType: 'invalid_type',
        quantityChange: 10,
      }

      const result = adjustStockSchema.safeParse(adjustment)
      expect(result.success).toBe(false)
    })

    it('should accept all valid usage types', () => {
      const usageTypes = ['adjustment', 'restock', 'return', 'damaged', 'expired']
      for (const usageType of usageTypes) {
        const adjustment = {
          usageType,
          quantityChange: 1,
        }
        const result = adjustStockSchema.safeParse(adjustment)
        expect(result.success).toBe(true)
      }
    })

    it('should allow optional notes', () => {
      const adjustment = {
        usageType: 'restock',
        quantityChange: 10,
      }

      const result = adjustStockSchema.safeParse(adjustment)
      expect(result.success).toBe(true)
    })

    it('should enforce reference max length', () => {
      const adjustment = {
        usageType: 'restock',
        quantityChange: 10,
        reference: 'a'.repeat(201),
      }

      const result = adjustStockSchema.safeParse(adjustment)
      expect(result.success).toBe(false)
    })
  })

  describe('Stock Adjustment Logic', () => {
    function applyStockAdjustment(
      currentQuantity: number,
      quantityChange: number,
    ): { newQuantity: number; isValid: boolean; error?: string } {
      const newQuantity = currentQuantity + quantityChange
      if (newQuantity < 0) {
        return {
          newQuantity: currentQuantity,
          isValid: false,
          error: 'Cannot reduce stock below zero',
        }
      }
      return { newQuantity, isValid: true }
    }

    it('should increase stock correctly', () => {
      const result = applyStockAdjustment(10, 5)
      expect(result.isValid).toBe(true)
      expect(result.newQuantity).toBe(15)
    })

    it('should decrease stock correctly', () => {
      const result = applyStockAdjustment(10, -5)
      expect(result.isValid).toBe(true)
      expect(result.newQuantity).toBe(5)
    })

    it('should allow decreasing to zero', () => {
      const result = applyStockAdjustment(10, -10)
      expect(result.isValid).toBe(true)
      expect(result.newQuantity).toBe(0)
    })

    it('should prevent negative stock', () => {
      const result = applyStockAdjustment(10, -15)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot reduce stock below zero')
    })

    it('should handle decimal quantities', () => {
      const result = applyStockAdjustment(10.5, 2.5)
      expect(result.isValid).toBe(true)
      expect(result.newQuantity).toBe(13)
    })
  })
})

describe('Part Search/Filter Validation', () => {
  describe('Search Schema', () => {
    it('should validate default search parameters', () => {
      const search = {}

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0)
        expect(result.data.sortBy).toBe('name')
        expect(result.data.sortOrder).toBe('asc')
        expect(result.data.includeInactive).toBe(false)
        expect(result.data.lowStock).toBe(false)
      }
    })

    it('should validate search with text query', () => {
      const search = {
        search: 'oil filter',
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
    })

    it('should validate search by category', () => {
      const search = {
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
    })

    it('should reject invalid category UUID', () => {
      const search = {
        categoryId: 'invalid-uuid',
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should validate low stock filter', () => {
      const search = {
        lowStock: true,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
    })

    it('should validate cost range filters', () => {
      const search = {
        minCost: 10,
        maxCost: 50,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
    })

    it('should reject negative cost values', () => {
      const search = {
        minCost: -10,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should validate pagination', () => {
      const search = {
        limit: 25,
        offset: 50,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
    })

    it('should reject limit above max', () => {
      const search = {
        limit: 150,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should reject limit below min', () => {
      const search = {
        limit: 0,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const search = {
        offset: -10,
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should validate sorting options', () => {
      const validSortFields = [
        'sku',
        'name',
        'quantityInStock',
        'unitCost',
        'supplier',
        'location',
        'createdAt',
        'updatedAt',
      ]

      for (const sortBy of validSortFields) {
        const search = { sortBy }
        const result = searchPartsSchema.safeParse(search)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid sort field', () => {
      const search = {
        sortBy: 'invalidField',
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should validate sort order', () => {
      const ascSearch = { sortOrder: 'asc' }
      const descSearch = { sortOrder: 'desc' }

      expect(searchPartsSchema.safeParse(ascSearch).success).toBe(true)
      expect(searchPartsSchema.safeParse(descSearch).success).toBe(true)
    })

    it('should reject invalid sort order', () => {
      const search = {
        sortOrder: 'random',
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(false)
    })

    it('should validate multiple filters together', () => {
      const search = {
        search: 'brake',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        lowStock: true,
        supplier: 'AutoParts Inc',
        location: 'Warehouse A',
        minCost: 5,
        maxCost: 100,
        limit: 20,
        offset: 40,
        sortBy: 'unitCost',
        sortOrder: 'desc',
      }

      const result = searchPartsSchema.safeParse(search)
      expect(result.success).toBe(true)
    })
  })
})

describe('Part Business Rules', () => {
  describe('SKU Uniqueness', () => {
    function isSkuUnique(sku: string, existingSkus: string[]): boolean {
      return !existingSkus.includes(sku.toUpperCase())
    }

    it('should detect unique SKU', () => {
      const existingSkus = ['OIL-001', 'FILTER-001', 'BRAKE-001']
      expect(isSkuUnique('NEW-001', existingSkus)).toBe(true)
    })

    it('should detect duplicate SKU', () => {
      const existingSkus = ['OIL-001', 'FILTER-001', 'BRAKE-001']
      expect(isSkuUnique('oil-001', existingSkus)).toBe(false)
    })

    it('should be case insensitive', () => {
      const existingSkus = ['OIL-001']
      expect(isSkuUnique('OIL-001', existingSkus)).toBe(false)
      expect(isSkuUnique('oil-001', existingSkus)).toBe(false)
    })
  })

  describe('On-Order Status', () => {
    const onOrderSchema = z.object({
      quantity: z.number().positive(),
      expectedDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    })

    it('should validate on-order request', () => {
      const onOrder = {
        quantity: 100,
        expectedDate: '2024-12-31T00:00:00.000Z',
        notes: 'Rush order',
      }

      const result = onOrderSchema.safeParse(onOrder)
      expect(result.success).toBe(true)
    })

    it('should require positive quantity', () => {
      const onOrder = {
        quantity: 0,
      }

      const result = onOrderSchema.safeParse(onOrder)
      expect(result.success).toBe(false)
    })

    it('should validate expected date format', () => {
      const onOrder = {
        quantity: 10,
        expectedDate: 'invalid-date',
      }

      const result = onOrderSchema.safeParse(onOrder)
      expect(result.success).toBe(false)
    })
  })

  describe('Part Receive', () => {
    const receiveSchema = z.object({
      quantity: z.number().positive(),
      notes: z.string().optional(),
    })

    function processReceive(
      currentStock: number,
      onOrderQuantity: number,
      receivedQuantity: number,
    ): { newStock: number; newOnOrder: number } {
      const newStock = currentStock + receivedQuantity
      const newOnOrder = Math.max(0, onOrderQuantity - receivedQuantity)
      return { newStock, newOnOrder }
    }

    it('should validate receive request', () => {
      const receive = {
        quantity: 50,
        notes: 'Shipment received',
      }

      const result = receiveSchema.safeParse(receive)
      expect(result.success).toBe(true)
    })

    it('should require positive quantity', () => {
      const receive = {
        quantity: -10,
      }

      const result = receiveSchema.safeParse(receive)
      expect(result.success).toBe(false)
    })

    it('should increase stock on receive', () => {
      const result = processReceive(10, 50, 30)
      expect(result.newStock).toBe(40)
    })

    it('should decrease on-order quantity on receive', () => {
      const result = processReceive(10, 50, 30)
      expect(result.newOnOrder).toBe(20)
    })

    it('should not allow negative on-order', () => {
      const result = processReceive(10, 20, 30)
      expect(result.newOnOrder).toBe(0)
    })

    it('should handle receiving more than on-order', () => {
      const result = processReceive(0, 10, 15)
      expect(result.newStock).toBe(15)
      expect(result.newOnOrder).toBe(0)
    })
  })
})
