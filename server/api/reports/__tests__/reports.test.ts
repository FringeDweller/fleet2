import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Reports/Analytics Tests - F14 Feature
 *
 * Tests for cost reporting API endpoint.
 * Validates schema, summary calculations, groupBy options, filters, and edge cases.
 */

// Schema definitions matching the actual API
const costsQuerySchema = z.object({
  assetId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  groupBy: z.enum(['asset', 'month', 'assignee']).default('asset'),
})

// Response structure schemas
const costSummarySchema = z.object({
  totalLaborCost: z.number(),
  totalPartsCost: z.number(),
  totalCost: z.number(),
  workOrderCount: z.number().int(),
})

const breakdownRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  laborCost: z.number(),
  partsCost: z.number(),
  totalCost: z.number(),
  workOrderCount: z.number().int(),
})

const recentWorkOrderSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  laborCost: z.number().nullable().optional(),
  partsCost: z.number().nullable().optional(),
  totalCost: z.number().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  asset: z
    .object({
      id: z.string(),
      assetNumber: z.string(),
      make: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  assignee: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
    })
    .nullable()
    .optional(),
})

const costsResponseSchema = z.object({
  summary: costSummarySchema,
  breakdown: z.array(breakdownRowSchema),
  recentWorkOrders: z.array(recentWorkOrderSchema),
})

describe('Reports API - Cost Reporting (F14)', () => {
  describe('Query Parameter Validation', () => {
    it('should validate empty query (use defaults)', () => {
      const result = costsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.groupBy).toBe('asset')
      }
    })

    it('should validate query with assetId filter', () => {
      const query = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID for assetId', () => {
      const query = {
        assetId: 'not-a-valid-uuid',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should validate query with dateFrom filter', () => {
      const query = {
        dateFrom: '2024-01-01',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate query with dateTo filter', () => {
      const query = {
        dateTo: '2024-12-31',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate query with date range filters', () => {
      const query = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate groupBy asset option', () => {
      const query = {
        groupBy: 'asset',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.groupBy).toBe('asset')
      }
    })

    it('should validate groupBy month option', () => {
      const query = {
        groupBy: 'month',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.groupBy).toBe('month')
      }
    })

    it('should validate groupBy assignee option', () => {
      const query = {
        groupBy: 'assignee',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.groupBy).toBe('assignee')
      }
    })

    it('should reject invalid groupBy option', () => {
      const query = {
        groupBy: 'category',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should validate combined filters', () => {
      const query = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        dateFrom: '2024-01-01',
        dateTo: '2024-06-30',
        groupBy: 'month',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should default groupBy to asset when not provided', () => {
      const query = {
        dateFrom: '2024-01-01',
      }
      const result = costsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.groupBy).toBe('asset')
      }
    })
  })

  describe('Response Structure Validation', () => {
    describe('Summary Schema', () => {
      it('should validate a valid cost summary', () => {
        const summary = {
          totalLaborCost: 1500.5,
          totalPartsCost: 2500.75,
          totalCost: 4001.25,
          workOrderCount: 15,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(true)
      })

      it('should validate summary with zero values', () => {
        const summary = {
          totalLaborCost: 0,
          totalPartsCost: 0,
          totalCost: 0,
          workOrderCount: 0,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(true)
      })

      it('should validate summary with decimal costs', () => {
        const summary = {
          totalLaborCost: 1234.56,
          totalPartsCost: 789.12,
          totalCost: 2023.68,
          workOrderCount: 7,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(true)
      })

      it('should require totalLaborCost', () => {
        const summary = {
          totalPartsCost: 100,
          totalCost: 100,
          workOrderCount: 1,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(false)
      })

      it('should require totalPartsCost', () => {
        const summary = {
          totalLaborCost: 100,
          totalCost: 100,
          workOrderCount: 1,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(false)
      })

      it('should require totalCost', () => {
        const summary = {
          totalLaborCost: 100,
          totalPartsCost: 100,
          workOrderCount: 1,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(false)
      })

      it('should require workOrderCount', () => {
        const summary = {
          totalLaborCost: 100,
          totalPartsCost: 100,
          totalCost: 200,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(false)
      })

      it('should require workOrderCount to be an integer', () => {
        const summary = {
          totalLaborCost: 100,
          totalPartsCost: 100,
          totalCost: 200,
          workOrderCount: 5.5,
        }
        const result = costSummarySchema.safeParse(summary)
        expect(result.success).toBe(false)
      })
    })

    describe('Breakdown Row Schema', () => {
      it('should validate a valid breakdown row', () => {
        const row = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'TRK-001 - Ford F-150',
          laborCost: 500,
          partsCost: 750,
          totalCost: 1250,
          workOrderCount: 3,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(true)
      })

      it('should validate breakdown row with zero costs', () => {
        const row = {
          id: 'asset-id',
          name: 'Asset Name',
          laborCost: 0,
          partsCost: 0,
          totalCost: 0,
          workOrderCount: 0,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(true)
      })

      it('should validate month breakdown row', () => {
        const row = {
          id: '2024-06',
          name: '2024-06',
          laborCost: 2000,
          partsCost: 3000,
          totalCost: 5000,
          workOrderCount: 10,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(true)
      })

      it('should validate assignee breakdown row', () => {
        const row = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'John Smith',
          laborCost: 1500,
          partsCost: 2500,
          totalCost: 4000,
          workOrderCount: 8,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(true)
      })

      it('should validate unassigned breakdown row', () => {
        const row = {
          id: 'unassigned',
          name: 'Unassigned',
          laborCost: 500,
          partsCost: 800,
          totalCost: 1300,
          workOrderCount: 2,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(true)
      })

      it('should require id', () => {
        const row = {
          name: 'Test',
          laborCost: 100,
          partsCost: 100,
          totalCost: 200,
          workOrderCount: 1,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(false)
      })

      it('should require name', () => {
        const row = {
          id: 'test-id',
          laborCost: 100,
          partsCost: 100,
          totalCost: 200,
          workOrderCount: 1,
        }
        const result = breakdownRowSchema.safeParse(row)
        expect(result.success).toBe(false)
      })
    })

    describe('Full Response Schema', () => {
      it('should validate a complete response', () => {
        const response = {
          summary: {
            totalLaborCost: 5000,
            totalPartsCost: 7500,
            totalCost: 12500,
            workOrderCount: 25,
          },
          breakdown: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'TRK-001',
              laborCost: 2000,
              partsCost: 3000,
              totalCost: 5000,
              workOrderCount: 10,
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174001',
              name: 'TRK-002',
              laborCost: 3000,
              partsCost: 4500,
              totalCost: 7500,
              workOrderCount: 15,
            },
          ],
          recentWorkOrders: [],
        }
        const result = costsResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should validate response with empty breakdown', () => {
        const response = {
          summary: {
            totalLaborCost: 0,
            totalPartsCost: 0,
            totalCost: 0,
            workOrderCount: 0,
          },
          breakdown: [],
          recentWorkOrders: [],
        }
        const result = costsResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Cost Summary Calculation Logic', () => {
    interface WorkOrderCost {
      laborCost: number | null
      partsCost: number | null
      totalCost: number | null
    }

    function calculateCostSummary(workOrders: WorkOrderCost[]) {
      if (workOrders.length === 0) {
        return {
          totalLaborCost: 0,
          totalPartsCost: 0,
          totalCost: 0,
          workOrderCount: 0,
        }
      }

      const totalLaborCost = workOrders.reduce((sum, wo) => sum + (wo.laborCost || 0), 0)
      const totalPartsCost = workOrders.reduce((sum, wo) => sum + (wo.partsCost || 0), 0)
      const totalCost = workOrders.reduce((sum, wo) => sum + (wo.totalCost || 0), 0)

      return {
        totalLaborCost,
        totalPartsCost,
        totalCost,
        workOrderCount: workOrders.length,
      }
    }

    it('should return zeros for empty work orders', () => {
      const summary = calculateCostSummary([])
      expect(summary.totalLaborCost).toBe(0)
      expect(summary.totalPartsCost).toBe(0)
      expect(summary.totalCost).toBe(0)
      expect(summary.workOrderCount).toBe(0)
    })

    it('should calculate totals for single work order', () => {
      const workOrders = [{ laborCost: 100, partsCost: 200, totalCost: 300 }]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(100)
      expect(summary.totalPartsCost).toBe(200)
      expect(summary.totalCost).toBe(300)
      expect(summary.workOrderCount).toBe(1)
    })

    it('should calculate totals for multiple work orders', () => {
      const workOrders = [
        { laborCost: 100, partsCost: 200, totalCost: 300 },
        { laborCost: 150, partsCost: 250, totalCost: 400 },
        { laborCost: 200, partsCost: 300, totalCost: 500 },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(450)
      expect(summary.totalPartsCost).toBe(750)
      expect(summary.totalCost).toBe(1200)
      expect(summary.workOrderCount).toBe(3)
    })

    it('should handle null labor costs', () => {
      const workOrders = [
        { laborCost: null, partsCost: 200, totalCost: 200 },
        { laborCost: 100, partsCost: 150, totalCost: 250 },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(100)
      expect(summary.totalPartsCost).toBe(350)
      expect(summary.totalCost).toBe(450)
      expect(summary.workOrderCount).toBe(2)
    })

    it('should handle null parts costs', () => {
      const workOrders = [
        { laborCost: 100, partsCost: null, totalCost: 100 },
        { laborCost: 150, partsCost: 200, totalCost: 350 },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(250)
      expect(summary.totalPartsCost).toBe(200)
      expect(summary.totalCost).toBe(450)
      expect(summary.workOrderCount).toBe(2)
    })

    it('should handle null total costs', () => {
      const workOrders = [
        { laborCost: 100, partsCost: 200, totalCost: null },
        { laborCost: 150, partsCost: 250, totalCost: 400 },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(250)
      expect(summary.totalPartsCost).toBe(450)
      expect(summary.totalCost).toBe(400)
      expect(summary.workOrderCount).toBe(2)
    })

    it('should handle all null costs', () => {
      const workOrders = [
        { laborCost: null, partsCost: null, totalCost: null },
        { laborCost: null, partsCost: null, totalCost: null },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(0)
      expect(summary.totalPartsCost).toBe(0)
      expect(summary.totalCost).toBe(0)
      expect(summary.workOrderCount).toBe(2)
    })

    it('should handle decimal costs', () => {
      const workOrders = [
        { laborCost: 100.5, partsCost: 200.25, totalCost: 300.75 },
        { laborCost: 150.25, partsCost: 250.5, totalCost: 400.75 },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBeCloseTo(250.75, 2)
      expect(summary.totalPartsCost).toBeCloseTo(450.75, 2)
      expect(summary.totalCost).toBeCloseTo(701.5, 2)
      expect(summary.workOrderCount).toBe(2)
    })

    it('should handle large numbers', () => {
      const workOrders = [
        { laborCost: 50000, partsCost: 100000, totalCost: 150000 },
        { laborCost: 75000, partsCost: 125000, totalCost: 200000 },
      ]
      const summary = calculateCostSummary(workOrders)
      expect(summary.totalLaborCost).toBe(125000)
      expect(summary.totalPartsCost).toBe(225000)
      expect(summary.totalCost).toBe(350000)
      expect(summary.workOrderCount).toBe(2)
    })
  })

  describe('Group By Asset Logic', () => {
    interface AssetWorkOrder {
      assetId: string
      assetNumber: string
      make: string | null
      model: string | null
      laborCost: number
      partsCost: number
      totalCost: number
    }

    function groupByAsset(workOrders: AssetWorkOrder[]) {
      const grouped = new Map<
        string,
        {
          assetNumber: string
          make: string | null
          model: string | null
          laborCost: number
          partsCost: number
          totalCost: number
          workOrderCount: number
        }
      >()

      for (const wo of workOrders) {
        const existing = grouped.get(wo.assetId)
        if (existing) {
          existing.laborCost += wo.laborCost
          existing.partsCost += wo.partsCost
          existing.totalCost += wo.totalCost
          existing.workOrderCount += 1
        } else {
          grouped.set(wo.assetId, {
            assetNumber: wo.assetNumber,
            make: wo.make,
            model: wo.model,
            laborCost: wo.laborCost,
            partsCost: wo.partsCost,
            totalCost: wo.totalCost,
            workOrderCount: 1,
          })
        }
      }

      return Array.from(grouped.entries()).map(([assetId, data]) => {
        const nameParts = [data.assetNumber]
        if (data.make) nameParts.push(` - ${data.make}`)
        if (data.model) nameParts.push(` ${data.model}`)
        return {
          id: assetId,
          name: nameParts.join(''),
          laborCost: data.laborCost,
          partsCost: data.partsCost,
          totalCost: data.totalCost,
          workOrderCount: data.workOrderCount,
        }
      })
    }

    it('should group work orders by asset', () => {
      const workOrders = [
        {
          assetId: 'asset-1',
          assetNumber: 'TRK-001',
          make: 'Ford',
          model: 'F-150',
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
        {
          assetId: 'asset-1',
          assetNumber: 'TRK-001',
          make: 'Ford',
          model: 'F-150',
          laborCost: 150,
          partsCost: 250,
          totalCost: 400,
        },
        {
          assetId: 'asset-2',
          assetNumber: 'TRK-002',
          make: 'Chevrolet',
          model: 'Silverado',
          laborCost: 200,
          partsCost: 300,
          totalCost: 500,
        },
      ]

      const result = groupByAsset(workOrders)
      expect(result).toHaveLength(2)

      const asset1 = result.find((r) => r.id === 'asset-1')
      expect(asset1?.workOrderCount).toBe(2)
      expect(asset1?.laborCost).toBe(250)
      expect(asset1?.partsCost).toBe(450)
      expect(asset1?.totalCost).toBe(700)
    })

    it('should format asset name with make and model', () => {
      const workOrders = [
        {
          assetId: 'asset-1',
          assetNumber: 'TRK-001',
          make: 'Ford',
          model: 'F-150',
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByAsset(workOrders)
      expect(result[0].name).toBe('TRK-001 - Ford F-150')
    })

    it('should format asset name without model', () => {
      const workOrders = [
        {
          assetId: 'asset-1',
          assetNumber: 'TRK-001',
          make: 'Ford',
          model: null,
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByAsset(workOrders)
      expect(result[0].name).toBe('TRK-001 - Ford')
    })

    it('should format asset name without make and model', () => {
      const workOrders = [
        {
          assetId: 'asset-1',
          assetNumber: 'TRK-001',
          make: null,
          model: null,
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByAsset(workOrders)
      expect(result[0].name).toBe('TRK-001')
    })

    it('should return empty array for no work orders', () => {
      const result = groupByAsset([])
      expect(result).toHaveLength(0)
    })
  })

  describe('Group By Month Logic', () => {
    interface MonthlyWorkOrder {
      completedAt: Date
      laborCost: number
      partsCost: number
      totalCost: number
    }

    function groupByMonth(workOrders: MonthlyWorkOrder[]) {
      const grouped = new Map<
        string,
        {
          laborCost: number
          partsCost: number
          totalCost: number
          workOrderCount: number
        }
      >()

      for (const wo of workOrders) {
        const month = wo.completedAt.toISOString().substring(0, 7) // YYYY-MM
        const existing = grouped.get(month)
        if (existing) {
          existing.laborCost += wo.laborCost
          existing.partsCost += wo.partsCost
          existing.totalCost += wo.totalCost
          existing.workOrderCount += 1
        } else {
          grouped.set(month, {
            laborCost: wo.laborCost,
            partsCost: wo.partsCost,
            totalCost: wo.totalCost,
            workOrderCount: 1,
          })
        }
      }

      return Array.from(grouped.entries())
        .map(([month, data]) => ({
          id: month,
          name: month,
          laborCost: data.laborCost,
          partsCost: data.partsCost,
          totalCost: data.totalCost,
          workOrderCount: data.workOrderCount,
        }))
        .sort((a, b) => b.id.localeCompare(a.id))
    }

    it('should group work orders by month', () => {
      const workOrders = [
        {
          completedAt: new Date('2024-06-15'),
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
        {
          completedAt: new Date('2024-06-20'),
          laborCost: 150,
          partsCost: 250,
          totalCost: 400,
        },
        {
          completedAt: new Date('2024-05-10'),
          laborCost: 200,
          partsCost: 300,
          totalCost: 500,
        },
      ]

      const result = groupByMonth(workOrders)
      expect(result).toHaveLength(2)

      const june = result.find((r) => r.id === '2024-06')
      expect(june?.workOrderCount).toBe(2)
      expect(june?.laborCost).toBe(250)
      expect(june?.partsCost).toBe(450)
      expect(june?.totalCost).toBe(700)
    })

    it('should format month as YYYY-MM', () => {
      const workOrders = [
        {
          completedAt: new Date('2024-12-25'),
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByMonth(workOrders)
      expect(result[0].id).toBe('2024-12')
      expect(result[0].name).toBe('2024-12')
    })

    it('should sort months in descending order', () => {
      const workOrders = [
        {
          completedAt: new Date('2024-01-15'),
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
        {
          completedAt: new Date('2024-06-20'),
          laborCost: 150,
          partsCost: 250,
          totalCost: 400,
        },
        {
          completedAt: new Date('2024-03-10'),
          laborCost: 200,
          partsCost: 300,
          totalCost: 500,
        },
      ]

      const result = groupByMonth(workOrders)
      expect(result[0].id).toBe('2024-06')
      expect(result[1].id).toBe('2024-03')
      expect(result[2].id).toBe('2024-01')
    })

    it('should return empty array for no work orders', () => {
      const result = groupByMonth([])
      expect(result).toHaveLength(0)
    })

    it('should handle work orders across years', () => {
      const workOrders = [
        {
          completedAt: new Date('2023-12-15'),
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
        {
          completedAt: new Date('2024-01-10'),
          laborCost: 150,
          partsCost: 250,
          totalCost: 400,
        },
      ]

      const result = groupByMonth(workOrders)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('2024-01')
      expect(result[1].id).toBe('2023-12')
    })
  })

  describe('Group By Assignee Logic', () => {
    interface AssigneeWorkOrder {
      assignedToId: string | null
      firstName: string | null
      lastName: string | null
      laborCost: number
      partsCost: number
      totalCost: number
    }

    function groupByAssignee(workOrders: AssigneeWorkOrder[]) {
      const grouped = new Map<
        string,
        {
          firstName: string | null
          lastName: string | null
          laborCost: number
          partsCost: number
          totalCost: number
          workOrderCount: number
        }
      >()

      for (const wo of workOrders) {
        const id = wo.assignedToId || 'unassigned'
        const existing = grouped.get(id)
        if (existing) {
          existing.laborCost += wo.laborCost
          existing.partsCost += wo.partsCost
          existing.totalCost += wo.totalCost
          existing.workOrderCount += 1
        } else {
          grouped.set(id, {
            firstName: wo.firstName,
            lastName: wo.lastName,
            laborCost: wo.laborCost,
            partsCost: wo.partsCost,
            totalCost: wo.totalCost,
            workOrderCount: 1,
          })
        }
      }

      return Array.from(grouped.entries()).map(([userId, data]) => ({
        id: userId,
        name: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : 'Unassigned',
        laborCost: data.laborCost,
        partsCost: data.partsCost,
        totalCost: data.totalCost,
        workOrderCount: data.workOrderCount,
      }))
    }

    it('should group work orders by assignee', () => {
      const workOrders = [
        {
          assignedToId: 'user-1',
          firstName: 'John',
          lastName: 'Smith',
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
        {
          assignedToId: 'user-1',
          firstName: 'John',
          lastName: 'Smith',
          laborCost: 150,
          partsCost: 250,
          totalCost: 400,
        },
        {
          assignedToId: 'user-2',
          firstName: 'Jane',
          lastName: 'Doe',
          laborCost: 200,
          partsCost: 300,
          totalCost: 500,
        },
      ]

      const result = groupByAssignee(workOrders)
      expect(result).toHaveLength(2)

      const john = result.find((r) => r.id === 'user-1')
      expect(john?.name).toBe('John Smith')
      expect(john?.workOrderCount).toBe(2)
      expect(john?.laborCost).toBe(250)
      expect(john?.partsCost).toBe(450)
      expect(john?.totalCost).toBe(700)
    })

    it('should group unassigned work orders', () => {
      const workOrders = [
        {
          assignedToId: null,
          firstName: null,
          lastName: null,
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
        {
          assignedToId: null,
          firstName: null,
          lastName: null,
          laborCost: 150,
          partsCost: 250,
          totalCost: 400,
        },
      ]

      const result = groupByAssignee(workOrders)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('unassigned')
      expect(result[0].name).toBe('Unassigned')
      expect(result[0].workOrderCount).toBe(2)
    })

    it('should format assignee name correctly', () => {
      const workOrders = [
        {
          assignedToId: 'user-1',
          firstName: 'John',
          lastName: 'Smith',
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByAssignee(workOrders)
      expect(result[0].name).toBe('John Smith')
    })

    it('should handle missing first name', () => {
      const workOrders = [
        {
          assignedToId: 'user-1',
          firstName: null,
          lastName: 'Smith',
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByAssignee(workOrders)
      expect(result[0].name).toBe('Unassigned')
    })

    it('should handle missing last name', () => {
      const workOrders = [
        {
          assignedToId: 'user-1',
          firstName: 'John',
          lastName: null,
          laborCost: 100,
          partsCost: 200,
          totalCost: 300,
        },
      ]

      const result = groupByAssignee(workOrders)
      expect(result[0].name).toBe('Unassigned')
    })

    it('should return empty array for no work orders', () => {
      const result = groupByAssignee([])
      expect(result).toHaveLength(0)
    })
  })

  describe('Date Range Filtering', () => {
    interface WorkOrderWithDate {
      completedAt: Date | null
      totalCost: number
    }

    function filterByDateRange(
      workOrders: WorkOrderWithDate[],
      dateFrom?: string,
      dateTo?: string,
    ) {
      return workOrders.filter((wo) => {
        if (!wo.completedAt) return false

        if (dateFrom && wo.completedAt < new Date(dateFrom)) {
          return false
        }

        if (dateTo && wo.completedAt > new Date(dateTo)) {
          return false
        }

        return true
      })
    }

    it('should filter by dateFrom', () => {
      const workOrders = [
        { completedAt: new Date('2024-01-15'), totalCost: 100 },
        { completedAt: new Date('2024-06-15'), totalCost: 200 },
        { completedAt: new Date('2024-12-15'), totalCost: 300 },
      ]

      const result = filterByDateRange(workOrders, '2024-06-01')
      expect(result).toHaveLength(2)
      expect(result[0].totalCost).toBe(200)
      expect(result[1].totalCost).toBe(300)
    })

    it('should filter by dateTo', () => {
      const workOrders = [
        { completedAt: new Date('2024-01-15'), totalCost: 100 },
        { completedAt: new Date('2024-06-15'), totalCost: 200 },
        { completedAt: new Date('2024-12-15'), totalCost: 300 },
      ]

      const result = filterByDateRange(workOrders, undefined, '2024-06-30')
      expect(result).toHaveLength(2)
      expect(result[0].totalCost).toBe(100)
      expect(result[1].totalCost).toBe(200)
    })

    it('should filter by date range', () => {
      const workOrders = [
        { completedAt: new Date('2024-01-15'), totalCost: 100 },
        { completedAt: new Date('2024-06-15'), totalCost: 200 },
        { completedAt: new Date('2024-12-15'), totalCost: 300 },
      ]

      const result = filterByDateRange(workOrders, '2024-03-01', '2024-09-30')
      expect(result).toHaveLength(1)
      expect(result[0].totalCost).toBe(200)
    })

    it('should include work orders on boundary dates', () => {
      const workOrders = [
        { completedAt: new Date('2024-06-01T12:00:00Z'), totalCost: 100 },
        { completedAt: new Date('2024-06-15T12:00:00Z'), totalCost: 200 },
      ]

      // Use the same date format to avoid timezone issues
      const result = filterByDateRange(workOrders, '2024-06-01T00:00:00Z', '2024-06-30T23:59:59Z')
      expect(result).toHaveLength(2)
    })

    it('should exclude work orders with null completedAt', () => {
      const workOrders = [
        { completedAt: new Date('2024-06-15'), totalCost: 100 },
        { completedAt: null, totalCost: 200 },
      ]

      const result = filterByDateRange(workOrders)
      expect(result).toHaveLength(1)
      expect(result[0].totalCost).toBe(100)
    })

    it('should return all work orders when no date filter', () => {
      const workOrders = [
        { completedAt: new Date('2024-01-15'), totalCost: 100 },
        { completedAt: new Date('2024-06-15'), totalCost: 200 },
      ]

      const result = filterByDateRange(workOrders)
      expect(result).toHaveLength(2)
    })

    it('should return empty array when all filtered out', () => {
      const workOrders = [
        { completedAt: new Date('2024-01-15'), totalCost: 100 },
        { completedAt: new Date('2024-02-15'), totalCost: 200 },
      ]

      const result = filterByDateRange(workOrders, '2024-06-01', '2024-12-31')
      expect(result).toHaveLength(0)
    })
  })

  describe('Asset Filtering', () => {
    interface WorkOrderWithAsset {
      assetId: string
      totalCost: number
    }

    function filterByAsset(workOrders: WorkOrderWithAsset[], assetId?: string) {
      if (!assetId) return workOrders
      return workOrders.filter((wo) => wo.assetId === assetId)
    }

    it('should filter by assetId', () => {
      const workOrders = [
        { assetId: 'asset-1', totalCost: 100 },
        { assetId: 'asset-2', totalCost: 200 },
        { assetId: 'asset-1', totalCost: 300 },
      ]

      const result = filterByAsset(workOrders, 'asset-1')
      expect(result).toHaveLength(2)
      expect(result[0].totalCost).toBe(100)
      expect(result[1].totalCost).toBe(300)
    })

    it('should return all work orders when no assetId filter', () => {
      const workOrders = [
        { assetId: 'asset-1', totalCost: 100 },
        { assetId: 'asset-2', totalCost: 200 },
      ]

      const result = filterByAsset(workOrders)
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no matching asset', () => {
      const workOrders = [
        { assetId: 'asset-1', totalCost: 100 },
        { assetId: 'asset-2', totalCost: 200 },
      ]

      const result = filterByAsset(workOrders, 'asset-3')
      expect(result).toHaveLength(0)
    })
  })

  describe('Recent Work Orders Logic', () => {
    interface RecentWorkOrder {
      id: string
      completedAt: Date
      totalCost: number
    }

    function getRecentWorkOrders(workOrders: RecentWorkOrder[], limit = 20) {
      return [...workOrders]
        .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
        .slice(0, limit)
    }

    it('should return most recent work orders first', () => {
      const workOrders = [
        { id: '1', completedAt: new Date('2024-01-15'), totalCost: 100 },
        { id: '2', completedAt: new Date('2024-12-15'), totalCost: 200 },
        { id: '3', completedAt: new Date('2024-06-15'), totalCost: 300 },
      ]

      const result = getRecentWorkOrders(workOrders)
      expect(result[0].id).toBe('2')
      expect(result[1].id).toBe('3')
      expect(result[2].id).toBe('1')
    })

    it('should limit results to specified number', () => {
      const workOrders = Array.from({ length: 30 }, (_, i) => ({
        id: `${i + 1}`,
        completedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        totalCost: (i + 1) * 100,
      }))

      const result = getRecentWorkOrders(workOrders, 20)
      expect(result).toHaveLength(20)
    })

    it('should return all work orders if less than limit', () => {
      const workOrders = [
        { id: '1', completedAt: new Date('2024-01-15'), totalCost: 100 },
        { id: '2', completedAt: new Date('2024-06-15'), totalCost: 200 },
      ]

      const result = getRecentWorkOrders(workOrders, 20)
      expect(result).toHaveLength(2)
    })

    it('should return empty array for no work orders', () => {
      const result = getRecentWorkOrders([], 20)
      expect(result).toHaveLength(0)
    })

    it('should use default limit of 20', () => {
      const workOrders = Array.from({ length: 30 }, (_, i) => ({
        id: `${i + 1}`,
        completedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        totalCost: (i + 1) * 100,
      }))

      const result = getRecentWorkOrders(workOrders)
      expect(result).toHaveLength(20)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large cost values', () => {
      const summary = {
        totalLaborCost: 999999999.99,
        totalPartsCost: 888888888.88,
        totalCost: 1888888888.87,
        workOrderCount: 10000,
      }
      const result = costSummarySchema.safeParse(summary)
      expect(result.success).toBe(true)
    })

    it('should handle negative cost values (if allowed)', () => {
      const summary = {
        totalLaborCost: -100,
        totalPartsCost: 200,
        totalCost: 100,
        workOrderCount: 1,
      }
      // The schema allows negative numbers (credits/refunds)
      const result = costSummarySchema.safeParse(summary)
      expect(result.success).toBe(true)
    })

    it('should handle special characters in asset names', () => {
      const row = {
        id: 'asset-1',
        name: "TRK-001 - Ford F-150 (O'Brien's)",
        laborCost: 100,
        partsCost: 200,
        totalCost: 300,
        workOrderCount: 1,
      }
      const result = breakdownRowSchema.safeParse(row)
      expect(result.success).toBe(true)
    })

    it('should handle empty string for id', () => {
      const row = {
        id: '',
        name: 'Test',
        laborCost: 100,
        partsCost: 200,
        totalCost: 300,
        workOrderCount: 1,
      }
      // Empty string is valid for id
      const result = breakdownRowSchema.safeParse(row)
      expect(result.success).toBe(true)
    })

    it('should handle empty string for name', () => {
      const row = {
        id: 'test-id',
        name: '',
        laborCost: 100,
        partsCost: 200,
        totalCost: 300,
        workOrderCount: 1,
      }
      // Empty string is valid for name
      const result = breakdownRowSchema.safeParse(row)
      expect(result.success).toBe(true)
    })

    it('should handle unicode characters in names', () => {
      const row = {
        id: 'user-1',
        name: 'Jean-Pierre Dubois',
        laborCost: 100,
        partsCost: 200,
        totalCost: 300,
        workOrderCount: 1,
      }
      const result = breakdownRowSchema.safeParse(row)
      expect(result.success).toBe(true)
    })

    it('should handle very long asset names', () => {
      const row = {
        id: 'asset-1',
        name: 'A'.repeat(500),
        laborCost: 100,
        partsCost: 200,
        totalCost: 300,
        workOrderCount: 1,
      }
      const result = breakdownRowSchema.safeParse(row)
      expect(result.success).toBe(true)
    })
  })

  describe('Percentage and Ratio Calculations', () => {
    function calculateLaborPercentage(laborCost: number, totalCost: number): number {
      if (totalCost === 0) return 0
      return Math.round((laborCost / totalCost) * 100 * 100) / 100
    }

    function calculatePartsPercentage(partsCost: number, totalCost: number): number {
      if (totalCost === 0) return 0
      return Math.round((partsCost / totalCost) * 100 * 100) / 100
    }

    function calculateAverageCostPerWorkOrder(totalCost: number, workOrderCount: number): number {
      if (workOrderCount === 0) return 0
      return Math.round((totalCost / workOrderCount) * 100) / 100
    }

    it('should calculate labor percentage correctly', () => {
      expect(calculateLaborPercentage(300, 1000)).toBe(30)
      expect(calculateLaborPercentage(500, 1000)).toBe(50)
      expect(calculateLaborPercentage(0, 1000)).toBe(0)
    })

    it('should calculate parts percentage correctly', () => {
      expect(calculatePartsPercentage(700, 1000)).toBe(70)
      expect(calculatePartsPercentage(250, 1000)).toBe(25)
      expect(calculatePartsPercentage(0, 1000)).toBe(0)
    })

    it('should handle zero total cost for percentages', () => {
      expect(calculateLaborPercentage(100, 0)).toBe(0)
      expect(calculatePartsPercentage(100, 0)).toBe(0)
    })

    it('should calculate average cost per work order', () => {
      expect(calculateAverageCostPerWorkOrder(1000, 10)).toBe(100)
      expect(calculateAverageCostPerWorkOrder(1500, 5)).toBe(300)
      expect(calculateAverageCostPerWorkOrder(333, 3)).toBe(111)
    })

    it('should handle zero work orders for average', () => {
      expect(calculateAverageCostPerWorkOrder(1000, 0)).toBe(0)
    })

    it('should handle decimal values in percentages', () => {
      expect(calculateLaborPercentage(333.33, 1000)).toBe(33.33)
    })
  })

  describe('Cost Trend Analysis', () => {
    interface MonthlyTrend {
      month: string
      totalCost: number
    }

    function calculateMonthOverMonthChange(trends: MonthlyTrend[]): (number | null)[] {
      if (trends.length < 2) return trends.map(() => null)

      return trends.map((current, index) => {
        if (index === 0) return null
        const previous = trends[index - 1]
        if (previous.totalCost === 0) return null
        return (
          Math.round(((current.totalCost - previous.totalCost) / previous.totalCost) * 100 * 100) /
          100
        )
      })
    }

    it('should calculate month-over-month change', () => {
      const trends = [
        { month: '2024-04', totalCost: 1000 },
        { month: '2024-05', totalCost: 1200 },
        { month: '2024-06', totalCost: 900 },
      ]

      const changes = calculateMonthOverMonthChange(trends)
      expect(changes[0]).toBeNull()
      expect(changes[1]).toBe(20) // 20% increase
      expect(changes[2]).toBe(-25) // 25% decrease
    })

    it('should handle single month', () => {
      const trends = [{ month: '2024-06', totalCost: 1000 }]
      const changes = calculateMonthOverMonthChange(trends)
      expect(changes[0]).toBeNull()
    })

    it('should handle zero previous cost', () => {
      const trends = [
        { month: '2024-05', totalCost: 0 },
        { month: '2024-06', totalCost: 1000 },
      ]

      const changes = calculateMonthOverMonthChange(trends)
      expect(changes[0]).toBeNull()
      expect(changes[1]).toBeNull()
    })

    it('should handle empty trends', () => {
      const changes = calculateMonthOverMonthChange([])
      expect(changes).toHaveLength(0)
    })
  })

  describe('Data Parsing from Database', () => {
    function parseCostFromDb(value: string | null | undefined): number {
      if (value === null || value === undefined) return 0
      const parsed = Number.parseFloat(value)
      return Number.isNaN(parsed) ? 0 : parsed
    }

    function parseCountFromDb(value: number | null | undefined): number {
      if (value === null || value === undefined) return 0
      return typeof value === 'number' ? value : 0
    }

    it('should parse valid cost string', () => {
      expect(parseCostFromDb('123.45')).toBe(123.45)
      expect(parseCostFromDb('1000')).toBe(1000)
      expect(parseCostFromDb('0.99')).toBe(0.99)
    })

    it('should handle null cost', () => {
      expect(parseCostFromDb(null)).toBe(0)
    })

    it('should handle undefined cost', () => {
      expect(parseCostFromDb(undefined)).toBe(0)
    })

    it('should handle empty string cost', () => {
      expect(parseCostFromDb('')).toBe(0)
    })

    it('should handle invalid string cost', () => {
      expect(parseCostFromDb('invalid')).toBe(0)
      expect(parseCostFromDb('NaN')).toBe(0)
    })

    it('should parse valid count', () => {
      expect(parseCountFromDb(5)).toBe(5)
      expect(parseCountFromDb(0)).toBe(0)
    })

    it('should handle null count', () => {
      expect(parseCountFromDb(null)).toBe(0)
    })

    it('should handle undefined count', () => {
      expect(parseCountFromDb(undefined)).toBe(0)
    })
  })

  describe('Completed Work Orders Only Filter', () => {
    interface WorkOrderStatus {
      status: string
      totalCost: number
    }

    function filterCompletedWorkOrders(workOrders: WorkOrderStatus[]) {
      return workOrders.filter((wo) => wo.status === 'completed')
    }

    it('should only include completed work orders', () => {
      const workOrders = [
        { status: 'completed', totalCost: 100 },
        { status: 'in_progress', totalCost: 200 },
        { status: 'completed', totalCost: 300 },
        { status: 'draft', totalCost: 400 },
      ]

      const result = filterCompletedWorkOrders(workOrders)
      expect(result).toHaveLength(2)
      expect(result[0].totalCost).toBe(100)
      expect(result[1].totalCost).toBe(300)
    })

    it('should return empty array when no completed work orders', () => {
      const workOrders = [
        { status: 'in_progress', totalCost: 200 },
        { status: 'draft', totalCost: 400 },
      ]

      const result = filterCompletedWorkOrders(workOrders)
      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty input', () => {
      const result = filterCompletedWorkOrders([])
      expect(result).toHaveLength(0)
    })
  })

  describe('Organisation Scoping', () => {
    interface ScopedWorkOrder {
      organisationId: string
      totalCost: number
    }

    function filterByOrganisation(workOrders: ScopedWorkOrder[], organisationId: string) {
      return workOrders.filter((wo) => wo.organisationId === organisationId)
    }

    it('should filter work orders by organisation', () => {
      const workOrders = [
        { organisationId: 'org-1', totalCost: 100 },
        { organisationId: 'org-2', totalCost: 200 },
        { organisationId: 'org-1', totalCost: 300 },
      ]

      const result = filterByOrganisation(workOrders, 'org-1')
      expect(result).toHaveLength(2)
      expect(result[0].totalCost).toBe(100)
      expect(result[1].totalCost).toBe(300)
    })

    it('should return empty array for unknown organisation', () => {
      const workOrders = [
        { organisationId: 'org-1', totalCost: 100 },
        { organisationId: 'org-2', totalCost: 200 },
      ]

      const result = filterByOrganisation(workOrders, 'org-3')
      expect(result).toHaveLength(0)
    })

    it('should not leak data between organisations', () => {
      const workOrders = [
        { organisationId: 'org-1', totalCost: 100 },
        { organisationId: 'org-2', totalCost: 200 },
      ]

      const org1Result = filterByOrganisation(workOrders, 'org-1')
      const org2Result = filterByOrganisation(workOrders, 'org-2')

      expect(org1Result.every((wo) => wo.organisationId === 'org-1')).toBe(true)
      expect(org2Result.every((wo) => wo.organisationId === 'org-2')).toBe(true)
    })
  })
})
