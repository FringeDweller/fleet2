import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Fuel Tracking Tests - Mobile App Core Feature
 *
 * Tests for fuel transaction recording and reporting.
 * Validates schema, summary calculations, and efficiency metrics.
 */

// Schema definitions matching the actual API
const createFuelTransactionSchema = z.object({
  assetId: z.string().uuid('Asset is required'),
  operatorSessionId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().positive().optional().nullable(),
  totalCost: z.number().positive().optional().nullable(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']).default('diesel'),
  odometer: z.number().min(0).optional().nullable(),
  engineHours: z.number().min(0).optional().nullable(),
  receiptPhotoPath: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  syncStatus: z.enum(['synced', 'pending']).default('synced'),
  transactionDate: z.string().datetime().or(z.date()),
})

const queryFuelTransactionsSchema = z.object({
  search: z.string().optional(),
  assetId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z
    .enum(['transactionDate', 'quantity', 'totalCost', 'odometer', 'engineHours', 'createdAt'])
    .default('transactionDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

describe('Fuel Transaction Schema Validation', () => {
  describe('Create Fuel Transaction', () => {
    it('should validate a valid fuel transaction with all fields', () => {
      const validTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        operatorSessionId: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 50.5,
        unitCost: 1.85,
        totalCost: 93.43,
        fuelType: 'diesel',
        odometer: 125000.5,
        engineHours: 5000.25,
        receiptPhotoPath: '/uploads/receipts/receipt-001.jpg',
        latitude: -37.8136,
        longitude: 144.9631,
        locationName: 'Shell Fuel Station',
        locationAddress: '123 Main Street, Melbourne VIC 3000',
        vendor: 'Shell',
        notes: 'Regular fill-up',
        syncStatus: 'synced',
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(validTransaction)
      expect(result.success).toBe(true)
    })

    it('should validate minimal fuel transaction', () => {
      const minimalTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(minimalTransaction)
      expect(result.success).toBe(true)
    })

    it('should require assetId', () => {
      const invalidTransaction = {
        quantity: 50,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for assetId', () => {
      const invalidTransaction = {
        assetId: 'not-a-uuid',
        quantity: 50,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should require quantity', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should require positive quantity', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 0,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should reject negative quantity', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: -50,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should require transactionDate', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should accept Date object for transactionDate', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        transactionDate: new Date(),
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
    })

    it('should default fuelType to diesel', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fuelType).toBe('diesel')
      }
    })

    it('should accept all valid fuel types', () => {
      const fuelTypes = ['diesel', 'petrol', 'electric', 'lpg', 'other'] as const
      for (const fuelType of fuelTypes) {
        const transaction = {
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 50,
          fuelType,
          transactionDate: '2024-12-28T10:00:00.000Z',
        }
        const result = createFuelTransactionSchema.safeParse(transaction)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid fuel type', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        fuelType: 'hydrogen',
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should default syncStatus to synced', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.syncStatus).toBe('synced')
      }
    })

    it('should accept pending syncStatus', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        syncStatus: 'pending',
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
    })

    it('should require positive unitCost if provided', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        unitCost: -1.5,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should require positive totalCost if provided', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        totalCost: 0,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should require non-negative odometer', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        odometer: -100,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should accept zero odometer (new vehicle)', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        odometer: 0,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
    })

    it('should require non-negative engineHours', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        engineHours: -5,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should accept zero engineHours', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        engineHours: 0,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
    })

    it('should enforce max length for receiptPhotoPath', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        receiptPhotoPath: 'a'.repeat(501),
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should enforce max length for locationName', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        locationName: 'a'.repeat(256),
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should enforce max length for vendor', () => {
      const invalidTransaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        vendor: 'a'.repeat(256),
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should validate GPS coordinates if provided', () => {
      const invalidLatitude = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        latitude: -91,
        longitude: 144.9631,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const invalidLongitude = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        latitude: -37.8136,
        longitude: 181,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      expect(createFuelTransactionSchema.safeParse(invalidLatitude).success).toBe(false)
      expect(createFuelTransactionSchema.safeParse(invalidLongitude).success).toBe(false)
    })

    it('should allow null for optional fields', () => {
      const transaction = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        operatorSessionId: null,
        unitCost: null,
        totalCost: null,
        odometer: null,
        engineHours: null,
        receiptPhotoPath: null,
        latitude: null,
        longitude: null,
        locationName: null,
        locationAddress: null,
        vendor: null,
        notes: null,
        transactionDate: '2024-12-28T10:00:00.000Z',
      }

      const result = createFuelTransactionSchema.safeParse(transaction)
      expect(result.success).toBe(true)
    })
  })

  describe('Query Fuel Transactions', () => {
    it('should provide default values', () => {
      const query = {}

      const result = queryFuelTransactionsSchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0)
        expect(result.data.sortBy).toBe('transactionDate')
        expect(result.data.sortOrder).toBe('desc')
      }
    })

    it('should validate all filter options', () => {
      const query = {
        search: 'Shell',
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        fuelType: 'diesel',
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-12-31T23:59:59.000Z',
        limit: 25,
        offset: 50,
        sortBy: 'quantity',
        sortOrder: 'asc',
      }

      const result = queryFuelTransactionsSchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should reject limit greater than 100', () => {
      const invalidQuery = {
        limit: 101,
      }

      const result = queryFuelTransactionsSchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const invalidQuery = {
        offset: -1,
      }

      const result = queryFuelTransactionsSchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should accept all valid sortBy fields', () => {
      const sortFields = [
        'transactionDate',
        'quantity',
        'totalCost',
        'odometer',
        'engineHours',
        'createdAt',
      ] as const

      for (const sortBy of sortFields) {
        const query = { sortBy }
        const result = queryFuelTransactionsSchema.safeParse(query)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid sortBy field', () => {
      const invalidQuery = {
        sortBy: 'invalidField',
      }

      const result = queryFuelTransactionsSchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should coerce string numbers for pagination', () => {
      const query = {
        limit: '25',
        offset: '10',
      }

      const result = queryFuelTransactionsSchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(25)
        expect(result.data.offset).toBe(10)
      }
    })
  })
})

describe('Fuel Summary Calculations', () => {
  interface FuelTransaction {
    quantity: number
    unitCost: number | null
    totalCost: number | null
    fuelType: string
    odometer: number | null
    transactionDate: Date
  }

  function calculateFuelSummary(transactions: FuelTransaction[]) {
    if (transactions.length === 0) {
      return {
        totalQuantity: 0,
        totalCost: 0,
        avgUnitCost: 0,
        transactionCount: 0,
      }
    }

    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantity, 0)
    const totalCost = transactions.reduce((sum, t) => sum + (t.totalCost ?? 0), 0)
    const unitCosts = transactions.filter((t) => t.unitCost !== null)
    const avgUnitCost =
      unitCosts.length > 0
        ? unitCosts.reduce((sum, t) => sum + t.unitCost!, 0) / unitCosts.length
        : 0

    return {
      totalQuantity,
      totalCost,
      avgUnitCost,
      transactionCount: transactions.length,
    }
  }

  function calculateByFuelType(transactions: FuelTransaction[]) {
    const grouped = new Map<
      string,
      { totalQuantity: number; totalCost: number; count: number; unitCosts: number[] }
    >()

    for (const t of transactions) {
      const existing = grouped.get(t.fuelType) || {
        totalQuantity: 0,
        totalCost: 0,
        count: 0,
        unitCosts: [],
      }
      existing.totalQuantity += t.quantity
      existing.totalCost += t.totalCost ?? 0
      existing.count += 1
      if (t.unitCost !== null) {
        existing.unitCosts.push(t.unitCost)
      }
      grouped.set(t.fuelType, existing)
    }

    return Array.from(grouped.entries()).map(([fuelType, data]) => ({
      fuelType,
      totalQuantity: data.totalQuantity,
      totalCost: data.totalCost,
      avgUnitCost:
        data.unitCosts.length > 0
          ? data.unitCosts.reduce((a, b) => a + b, 0) / data.unitCosts.length
          : 0,
      transactionCount: data.count,
    }))
  }

  describe('Overall Summary', () => {
    it('should return zero values for empty transactions', () => {
      const summary = calculateFuelSummary([])
      expect(summary.totalQuantity).toBe(0)
      expect(summary.totalCost).toBe(0)
      expect(summary.avgUnitCost).toBe(0)
      expect(summary.transactionCount).toBe(0)
    })

    it('should calculate totals for single transaction', () => {
      const transactions = [
        {
          quantity: 50,
          unitCost: 1.85,
          totalCost: 92.5,
          fuelType: 'diesel',
          odometer: 100000,
          transactionDate: new Date(),
        },
      ]

      const summary = calculateFuelSummary(transactions)
      expect(summary.totalQuantity).toBe(50)
      expect(summary.totalCost).toBe(92.5)
      expect(summary.avgUnitCost).toBe(1.85)
      expect(summary.transactionCount).toBe(1)
    })

    it('should calculate totals for multiple transactions', () => {
      const transactions = [
        {
          quantity: 50,
          unitCost: 1.8,
          totalCost: 90,
          fuelType: 'diesel',
          odometer: 100000,
          transactionDate: new Date(),
        },
        {
          quantity: 60,
          unitCost: 1.9,
          totalCost: 114,
          fuelType: 'diesel',
          odometer: 100500,
          transactionDate: new Date(),
        },
        {
          quantity: 40,
          unitCost: 1.85,
          totalCost: 74,
          fuelType: 'diesel',
          odometer: 101000,
          transactionDate: new Date(),
        },
      ]

      const summary = calculateFuelSummary(transactions)
      expect(summary.totalQuantity).toBe(150)
      expect(summary.totalCost).toBe(278)
      expect(summary.avgUnitCost).toBeCloseTo(1.85, 2)
      expect(summary.transactionCount).toBe(3)
    })

    it('should handle transactions with null costs', () => {
      const transactions = [
        {
          quantity: 50,
          unitCost: 1.85,
          totalCost: 92.5,
          fuelType: 'diesel',
          odometer: null,
          transactionDate: new Date(),
        },
        {
          quantity: 30,
          unitCost: null,
          totalCost: null,
          fuelType: 'diesel',
          odometer: null,
          transactionDate: new Date(),
        },
      ]

      const summary = calculateFuelSummary(transactions)
      expect(summary.totalQuantity).toBe(80)
      expect(summary.totalCost).toBe(92.5)
      expect(summary.avgUnitCost).toBe(1.85)
      expect(summary.transactionCount).toBe(2)
    })
  })

  describe('Summary by Fuel Type', () => {
    it('should group transactions by fuel type', () => {
      const transactions = [
        {
          quantity: 50,
          unitCost: 1.85,
          totalCost: 92.5,
          fuelType: 'diesel',
          odometer: 100000,
          transactionDate: new Date(),
        },
        {
          quantity: 40,
          unitCost: 1.95,
          totalCost: 78,
          fuelType: 'petrol',
          odometer: 50000,
          transactionDate: new Date(),
        },
        {
          quantity: 60,
          unitCost: 1.8,
          totalCost: 108,
          fuelType: 'diesel',
          odometer: 100500,
          transactionDate: new Date(),
        },
      ]

      const byType = calculateByFuelType(transactions)
      expect(byType).toHaveLength(2)

      const diesel = byType.find((t) => t.fuelType === 'diesel')
      expect(diesel?.totalQuantity).toBe(110)
      expect(diesel?.totalCost).toBe(200.5)
      expect(diesel?.transactionCount).toBe(2)

      const petrol = byType.find((t) => t.fuelType === 'petrol')
      expect(petrol?.totalQuantity).toBe(40)
      expect(petrol?.totalCost).toBe(78)
      expect(petrol?.transactionCount).toBe(1)
    })

    it('should handle single fuel type', () => {
      const transactions = [
        {
          quantity: 50,
          unitCost: 1.85,
          totalCost: 92.5,
          fuelType: 'diesel',
          odometer: 100000,
          transactionDate: new Date(),
        },
        {
          quantity: 60,
          unitCost: 1.9,
          totalCost: 114,
          fuelType: 'diesel',
          odometer: 100500,
          transactionDate: new Date(),
        },
      ]

      const byType = calculateByFuelType(transactions)
      expect(byType).toHaveLength(1)
      expect(byType[0].fuelType).toBe('diesel')
      expect(byType[0].totalQuantity).toBe(110)
    })

    it('should handle empty transactions', () => {
      const byType = calculateByFuelType([])
      expect(byType).toHaveLength(0)
    })
  })
})

describe('Fuel Efficiency Calculations', () => {
  interface FuelRecord {
    odometer: number
    quantity: number
    transactionDate: Date
  }

  function calculateFuelEfficiency(records: FuelRecord[]): {
    avgKmPerLitre: number
    avgLitresPerKm: number
    totalDistance: number
    totalFuel: number
  } | null {
    if (records.length < 2) {
      return null
    }

    // Sort by odometer
    const sorted = [...records].sort((a, b) => a.odometer - b.odometer)

    // Calculate total distance (excluding first fill as baseline)
    const totalDistance = sorted[sorted.length - 1].odometer - sorted[0].odometer

    // Calculate total fuel used (excluding first fill)
    const totalFuel = sorted.slice(1).reduce((sum, r) => sum + r.quantity, 0)

    if (totalFuel === 0 || totalDistance === 0) {
      return null
    }

    const avgKmPerLitre = totalDistance / totalFuel
    const avgLitresPerKm = totalFuel / totalDistance

    return {
      avgKmPerLitre,
      avgLitresPerKm,
      totalDistance,
      totalFuel,
    }
  }

  function calculateLitresPer100Km(kmPerLitre: number): number {
    if (kmPerLitre === 0) return 0
    return 100 / kmPerLitre
  }

  describe('Efficiency Calculation', () => {
    it('should return null for less than 2 records', () => {
      const singleRecord = [{ odometer: 100000, quantity: 50, transactionDate: new Date() }]

      expect(calculateFuelEfficiency([])).toBeNull()
      expect(calculateFuelEfficiency(singleRecord)).toBeNull()
    })

    it('should calculate efficiency for two records', () => {
      const records = [
        { odometer: 100000, quantity: 50, transactionDate: new Date('2024-12-01') },
        { odometer: 100500, quantity: 50, transactionDate: new Date('2024-12-15') },
      ]

      const result = calculateFuelEfficiency(records)
      expect(result).not.toBeNull()
      expect(result?.totalDistance).toBe(500)
      expect(result?.totalFuel).toBe(50)
      expect(result?.avgKmPerLitre).toBe(10)
    })

    it('should calculate efficiency for multiple records', () => {
      const records = [
        { odometer: 100000, quantity: 50, transactionDate: new Date('2024-12-01') },
        { odometer: 100500, quantity: 50, transactionDate: new Date('2024-12-10') },
        { odometer: 101000, quantity: 60, transactionDate: new Date('2024-12-20') },
        { odometer: 101600, quantity: 70, transactionDate: new Date('2024-12-28') },
      ]

      const result = calculateFuelEfficiency(records)
      expect(result).not.toBeNull()
      expect(result?.totalDistance).toBe(1600)
      expect(result?.totalFuel).toBe(180) // 50 + 60 + 70 (excluding first fill)
      expect(result?.avgKmPerLitre).toBeCloseTo(8.89, 2)
    })

    it('should handle unsorted records', () => {
      const records = [
        { odometer: 101000, quantity: 60, transactionDate: new Date('2024-12-20') },
        { odometer: 100000, quantity: 50, transactionDate: new Date('2024-12-01') },
        { odometer: 100500, quantity: 50, transactionDate: new Date('2024-12-10') },
      ]

      const result = calculateFuelEfficiency(records)
      expect(result).not.toBeNull()
      expect(result?.totalDistance).toBe(1000)
    })
  })

  describe('Litres per 100km Conversion', () => {
    it('should convert km/L to L/100km', () => {
      expect(calculateLitresPer100Km(10)).toBe(10) // 10 km/L = 10 L/100km
      expect(calculateLitresPer100Km(20)).toBe(5) // 20 km/L = 5 L/100km
      expect(calculateLitresPer100Km(8)).toBeCloseTo(12.5, 2) // 8 km/L = 12.5 L/100km
    })

    it('should handle zero input', () => {
      expect(calculateLitresPer100Km(0)).toBe(0)
    })

    it('should handle high efficiency vehicles', () => {
      expect(calculateLitresPer100Km(25)).toBe(4) // 25 km/L = 4 L/100km (hybrid/EV)
    })

    it('should handle low efficiency vehicles', () => {
      expect(calculateLitresPer100Km(4)).toBe(25) // 4 km/L = 25 L/100km (heavy truck)
    })
  })
})

describe('Fuel Cost Calculations', () => {
  function calculateTotalCost(quantity: number, unitCost: number): number {
    return Math.round(quantity * unitCost * 100) / 100
  }

  function calculateUnitCost(totalCost: number, quantity: number): number {
    if (quantity === 0) return 0
    return Math.round((totalCost / quantity) * 10000) / 10000
  }

  describe('Total Cost Calculation', () => {
    it('should calculate total cost correctly', () => {
      expect(calculateTotalCost(50, 1.85)).toBe(92.5)
      expect(calculateTotalCost(45.5, 1.899)).toBe(86.4)
      expect(calculateTotalCost(100, 1.5)).toBe(150)
    })

    it('should handle decimal quantities', () => {
      expect(calculateTotalCost(45.678, 1.85)).toBe(84.5)
    })

    it('should round to 2 decimal places', () => {
      const result = calculateTotalCost(33.333, 1.999)
      expect(result.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
    })
  })

  describe('Unit Cost Calculation', () => {
    it('should calculate unit cost correctly', () => {
      expect(calculateUnitCost(92.5, 50)).toBe(1.85)
      expect(calculateUnitCost(150, 100)).toBe(1.5)
    })

    it('should handle zero quantity', () => {
      expect(calculateUnitCost(100, 0)).toBe(0)
    })

    it('should round to 4 decimal places', () => {
      const result = calculateUnitCost(100, 33.333)
      expect(result.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4)
    })
  })
})

describe('Fuel Transaction Validation Edge Cases', () => {
  it('should accept very small quantities (decimal precision)', () => {
    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 0.001,
      transactionDate: '2024-12-28T10:00:00.000Z',
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })

  it('should accept very large quantities', () => {
    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 100000,
      transactionDate: '2024-12-28T10:00:00.000Z',
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })

  it('should accept very high odometer readings', () => {
    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 50,
      odometer: 999999999,
      transactionDate: '2024-12-28T10:00:00.000Z',
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })

  it('should accept very high engine hours', () => {
    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 50,
      engineHours: 100000,
      transactionDate: '2024-12-28T10:00:00.000Z',
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })

  it('should accept very small unit costs', () => {
    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 50,
      unitCost: 0.001,
      transactionDate: '2024-12-28T10:00:00.000Z',
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })

  it('should accept future transaction dates', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 50,
      transactionDate: futureDate.toISOString(),
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })

  it('should accept past transaction dates', () => {
    const pastDate = new Date()
    pastDate.setFullYear(pastDate.getFullYear() - 5)

    const transaction = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 50,
      transactionDate: pastDate.toISOString(),
    }

    const result = createFuelTransactionSchema.safeParse(transaction)
    expect(result.success).toBe(true)
  })
})
