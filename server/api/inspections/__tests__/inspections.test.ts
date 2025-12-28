import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Pre-Start Inspections Tests
 * Tests for inspection checklists, results, and completion rules (TEST-F09)
 *
 * Note: Inspections in this system use work orders with checklist items.
 * Pre-start inspections are a specialized type of work order where operators
 * complete a checklist before operating an asset.
 */

// Inspection result enum - what can happen with each checklist item
const inspectionResultEnum = z.enum(['pass', 'fail', 'n/a'])

// Checklist item schema (from work order checklist items)
const checklistItemSchema = z.object({
  id: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  templateItemId: z.string().max(36).optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().default(false),
  isCompleted: z.boolean().default(false),
  completedAt: z.date().optional().nullable(),
  completedById: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  order: z.number().int().min(0).default(0),
})

// Inspection submission schema
const inspectionSubmissionSchema = z.object({
  workOrderId: z.string().uuid(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      result: inspectionResultEnum,
      notes: z.string().optional().nullable(),
      defectTitle: z.string().optional().nullable(), // For failed items that create defects
      defectSeverity: z.enum(['minor', 'major', 'critical']).optional().nullable(),
    }),
  ),
  signature: z.string().url().optional().nullable(),
  completionNotes: z.string().optional().nullable(),
})

describe('Inspection Checklist Schema Validation', () => {
  describe('Checklist Item Schema', () => {
    it('should validate a complete checklist item', () => {
      const item = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workOrderId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Check tire pressure',
        description: 'Verify all tires are inflated to proper PSI',
        isRequired: true,
        isCompleted: false,
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(true)
    })

    it('should require title', () => {
      const item = {
        isRequired: true,
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
      const item = {
        title: '',
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(false)
    })

    it('should enforce title max length of 200', () => {
      const item = {
        title: 'a'.repeat(201),
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(false)
    })

    it('should default isRequired to false', () => {
      const item = {
        title: 'Optional check',
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isRequired).toBe(false)
      }
    })

    it('should default isCompleted to false', () => {
      const item = {
        title: 'Check item',
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isCompleted).toBe(false)
      }
    })

    it('should default order to 0', () => {
      const item = {
        title: 'Check item',
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toBe(0)
      }
    })

    it('should reject negative order', () => {
      const item = {
        title: 'Check item',
        order: -1,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(false)
    })

    it('should allow templateItemId for items from templates', () => {
      const item = {
        title: 'Template-based check',
        templateItemId: '123e4567-e89b-12d3-a456-426614174099',
        order: 0,
      }

      const result = checklistItemSchema.safeParse(item)
      expect(result.success).toBe(true)
    })
  })
})

describe('Inspection Result Validation', () => {
  it('should accept pass result', () => {
    const result = inspectionResultEnum.safeParse('pass')
    expect(result.success).toBe(true)
  })

  it('should accept fail result', () => {
    const result = inspectionResultEnum.safeParse('fail')
    expect(result.success).toBe(true)
  })

  it('should accept n/a result', () => {
    const result = inspectionResultEnum.safeParse('n/a')
    expect(result.success).toBe(true)
  })

  it('should reject invalid result', () => {
    const invalidResults = ['passed', 'failed', 'na', 'skip', 'pending', '']

    for (const invalid of invalidResults) {
      const result = inspectionResultEnum.safeParse(invalid)
      expect(result.success).toBe(false)
    }
  })
})

describe('Inspection Submission Schema', () => {
  it('should validate a complete inspection submission', () => {
    const submission = {
      workOrderId: '123e4567-e89b-12d3-a456-426614174000',
      items: [
        { id: '123e4567-e89b-12d3-a456-426614174001', result: 'pass', notes: null },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          result: 'fail',
          notes: 'Tire pressure low',
          defectTitle: 'Low tire pressure on front left',
          defectSeverity: 'minor',
        },
        { id: '123e4567-e89b-12d3-a456-426614174003', result: 'n/a', notes: 'Not applicable' },
      ],
      signature: 'https://storage.example.com/signatures/123.png',
      completionNotes: 'Inspection completed with one defect noted',
    }

    const result = inspectionSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(true)
  })

  it('should require workOrderId', () => {
    const submission = {
      items: [{ id: '123e4567-e89b-12d3-a456-426614174001', result: 'pass' }],
    }

    const result = inspectionSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(false)
  })

  it('should require items array', () => {
    const submission = {
      workOrderId: '123e4567-e89b-12d3-a456-426614174000',
    }

    const result = inspectionSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(false)
  })

  it('should allow empty items array', () => {
    const submission = {
      workOrderId: '123e4567-e89b-12d3-a456-426614174000',
      items: [],
    }

    const result = inspectionSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(true)
  })

  it('should validate each item has required fields', () => {
    const submission = {
      workOrderId: '123e4567-e89b-12d3-a456-426614174000',
      items: [
        { id: '123e4567-e89b-12d3-a456-426614174001' }, // missing result
      ],
    }

    const result = inspectionSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(false)
  })

  it('should allow signature to be optional', () => {
    const submission = {
      workOrderId: '123e4567-e89b-12d3-a456-426614174000',
      items: [{ id: '123e4567-e89b-12d3-a456-426614174001', result: 'pass' }],
    }

    const result = inspectionSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(true)
  })
})

describe('Inspection Completion Rules', () => {
  interface ChecklistItem {
    id: string
    title: string
    isRequired: boolean
    isCompleted: boolean
    result?: 'pass' | 'fail' | 'n/a'
  }

  function canCompleteInspection(items: ChecklistItem[]): {
    canComplete: boolean
    reason?: string
    failedItems: ChecklistItem[]
  } {
    const requiredItems = items.filter((item) => item.isRequired)
    const incompleteRequired = requiredItems.filter((item) => !item.isCompleted)
    const failedItems = items.filter((item) => item.result === 'fail')

    if (incompleteRequired.length > 0) {
      return {
        canComplete: false,
        reason: `${incompleteRequired.length} required item(s) not completed`,
        failedItems,
      }
    }

    return {
      canComplete: true,
      failedItems,
    }
  }

  it('should allow completion when all required items are completed', () => {
    const items: ChecklistItem[] = [
      { id: '1', title: 'Check brakes', isRequired: true, isCompleted: true, result: 'pass' },
      { id: '2', title: 'Check lights', isRequired: true, isCompleted: true, result: 'pass' },
      { id: '3', title: 'Check mirrors', isRequired: false, isCompleted: false },
    ]

    const result = canCompleteInspection(items)
    expect(result.canComplete).toBe(true)
  })

  it('should not allow completion when required items are incomplete', () => {
    const items: ChecklistItem[] = [
      { id: '1', title: 'Check brakes', isRequired: true, isCompleted: true, result: 'pass' },
      { id: '2', title: 'Check lights', isRequired: true, isCompleted: false },
    ]

    const result = canCompleteInspection(items)
    expect(result.canComplete).toBe(false)
    expect(result.reason).toContain('1 required item(s) not completed')
  })

  it('should allow completion even with failed items', () => {
    const items: ChecklistItem[] = [
      { id: '1', title: 'Check brakes', isRequired: true, isCompleted: true, result: 'pass' },
      { id: '2', title: 'Check lights', isRequired: true, isCompleted: true, result: 'fail' },
    ]

    const result = canCompleteInspection(items)
    expect(result.canComplete).toBe(true)
    expect(result.failedItems).toHaveLength(1)
  })

  it('should report all failed items for defect creation', () => {
    const items: ChecklistItem[] = [
      { id: '1', title: 'Check brakes', isRequired: true, isCompleted: true, result: 'fail' },
      { id: '2', title: 'Check lights', isRequired: true, isCompleted: true, result: 'fail' },
      { id: '3', title: 'Check mirrors', isRequired: true, isCompleted: true, result: 'pass' },
    ]

    const result = canCompleteInspection(items)
    expect(result.canComplete).toBe(true)
    expect(result.failedItems).toHaveLength(2)
  })

  it('should allow completion when no required items exist', () => {
    const items: ChecklistItem[] = [
      { id: '1', title: 'Optional check 1', isRequired: false, isCompleted: false },
      { id: '2', title: 'Optional check 2', isRequired: false, isCompleted: true, result: 'pass' },
    ]

    const result = canCompleteInspection(items)
    expect(result.canComplete).toBe(true)
  })

  it('should allow completion with empty checklist', () => {
    const items: ChecklistItem[] = []

    const result = canCompleteInspection(items)
    expect(result.canComplete).toBe(true)
    expect(result.failedItems).toHaveLength(0)
  })
})

describe('Defect Creation from Failed Inspection Items', () => {
  interface FailedInspectionItem {
    id: string
    title: string
    notes: string | null
    defectTitle: string | null
    defectSeverity: 'minor' | 'major' | 'critical' | null
  }

  interface DefectToCreate {
    title: string
    description: string | null
    severity: 'minor' | 'major' | 'critical'
  }

  function createDefectsFromFailedItems(
    items: FailedInspectionItem[],
    _assetId: string,
  ): DefectToCreate[] {
    return items
      .filter((item) => item.defectTitle) // Only create defects if title is provided
      .map((item) => ({
        title: item.defectTitle!,
        description: item.notes,
        severity: item.defectSeverity || 'minor',
      }))
  }

  it('should create defect for failed item with defect title', () => {
    const items: FailedInspectionItem[] = [
      {
        id: '1',
        title: 'Check tire pressure',
        notes: 'Front left tire is low',
        defectTitle: 'Low tire pressure - front left',
        defectSeverity: 'minor',
      },
    ]

    const defects = createDefectsFromFailedItems(items, 'asset-123')
    expect(defects).toHaveLength(1)
    expect(defects[0].title).toBe('Low tire pressure - front left')
    expect(defects[0].description).toBe('Front left tire is low')
    expect(defects[0].severity).toBe('minor')
  })

  it('should not create defect for failed item without defect title', () => {
    const items: FailedInspectionItem[] = [
      {
        id: '1',
        title: 'Check tire pressure',
        notes: 'Noted for monitoring',
        defectTitle: null,
        defectSeverity: null,
      },
    ]

    const defects = createDefectsFromFailedItems(items, 'asset-123')
    expect(defects).toHaveLength(0)
  })

  it('should default severity to minor when not specified', () => {
    const items: FailedInspectionItem[] = [
      {
        id: '1',
        title: 'Check something',
        notes: null,
        defectTitle: 'Defect found',
        defectSeverity: null,
      },
    ]

    const defects = createDefectsFromFailedItems(items, 'asset-123')
    expect(defects[0].severity).toBe('minor')
  })

  it('should create multiple defects from multiple failed items', () => {
    const items: FailedInspectionItem[] = [
      {
        id: '1',
        title: 'Check brakes',
        notes: 'Squeaking sound',
        defectTitle: 'Brake noise',
        defectSeverity: 'major',
      },
      {
        id: '2',
        title: 'Check lights',
        notes: 'Rear left not working',
        defectTitle: 'Brake light out',
        defectSeverity: 'minor',
      },
      {
        id: '3',
        title: 'Check engine',
        notes: 'Running rough',
        defectTitle: 'Engine misfire',
        defectSeverity: 'critical',
      },
    ]

    const defects = createDefectsFromFailedItems(items, 'asset-123')
    expect(defects).toHaveLength(3)
    expect(defects.map((d) => d.severity)).toEqual(['major', 'minor', 'critical'])
  })
})

describe('Pre-Start Inspection Checklist Order', () => {
  interface OrderedItem {
    id: string
    title: string
    order: number
  }

  function sortByOrder(items: OrderedItem[]): OrderedItem[] {
    return [...items].sort((a, b) => a.order - b.order)
  }

  function validateOrderSequence(items: OrderedItem[]): boolean {
    const sorted = sortByOrder(items)
    // Order doesn't need to be sequential (0,1,2...), just properly ordered
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].order < sorted[i - 1].order) {
        return false
      }
    }
    return true
  }

  it('should sort items by order', () => {
    const items: OrderedItem[] = [
      { id: '3', title: 'Third', order: 2 },
      { id: '1', title: 'First', order: 0 },
      { id: '2', title: 'Second', order: 1 },
    ]

    const sorted = sortByOrder(items)
    expect(sorted[0].title).toBe('First')
    expect(sorted[1].title).toBe('Second')
    expect(sorted[2].title).toBe('Third')
  })

  it('should validate correct order sequence', () => {
    const items: OrderedItem[] = [
      { id: '1', title: 'First', order: 0 },
      { id: '2', title: 'Second', order: 5 },
      { id: '3', title: 'Third', order: 10 },
    ]

    expect(validateOrderSequence(items)).toBe(true)
  })

  it('should handle items with same order value', () => {
    const items: OrderedItem[] = [
      { id: '1', title: 'First', order: 0 },
      { id: '2', title: 'Also first', order: 0 },
      { id: '3', title: 'Second', order: 1 },
    ]

    expect(validateOrderSequence(items)).toBe(true)
  })

  it('should handle empty array', () => {
    const items: OrderedItem[] = []
    expect(validateOrderSequence(items)).toBe(true)
  })

  it('should handle single item', () => {
    const items: OrderedItem[] = [{ id: '1', title: 'Only', order: 0 }]
    expect(validateOrderSequence(items)).toBe(true)
  })
})

describe('Inspection Pass/Fail Summary', () => {
  interface InspectionItem {
    result: 'pass' | 'fail' | 'n/a'
  }

  interface InspectionSummary {
    totalItems: number
    passedCount: number
    failedCount: number
    naCount: number
    passRate: number
    hasCriticalFailures: boolean
  }

  function calculateSummary(
    items: InspectionItem[],
    criticalItemIds: string[] = [],
    itemIds: string[] = [],
  ): InspectionSummary {
    const passedCount = items.filter((i) => i.result === 'pass').length
    const failedCount = items.filter((i) => i.result === 'fail').length
    const naCount = items.filter((i) => i.result === 'n/a').length
    const applicableItems = passedCount + failedCount

    const hasCriticalFailures = items.some(
      (item, index) => item.result === 'fail' && criticalItemIds.includes(itemIds[index]),
    )

    return {
      totalItems: items.length,
      passedCount,
      failedCount,
      naCount,
      passRate: applicableItems > 0 ? (passedCount / applicableItems) * 100 : 100,
      hasCriticalFailures,
    }
  }

  it('should calculate 100% pass rate when all items pass', () => {
    const items: InspectionItem[] = [{ result: 'pass' }, { result: 'pass' }, { result: 'pass' }]

    const summary = calculateSummary(items)
    expect(summary.passRate).toBe(100)
    expect(summary.passedCount).toBe(3)
    expect(summary.failedCount).toBe(0)
  })

  it('should calculate 0% pass rate when all items fail', () => {
    const items: InspectionItem[] = [{ result: 'fail' }, { result: 'fail' }]

    const summary = calculateSummary(items)
    expect(summary.passRate).toBe(0)
    expect(summary.failedCount).toBe(2)
  })

  it('should exclude n/a items from pass rate calculation', () => {
    const items: InspectionItem[] = [
      { result: 'pass' },
      { result: 'pass' },
      { result: 'n/a' },
      { result: 'n/a' },
    ]

    const summary = calculateSummary(items)
    expect(summary.passRate).toBe(100) // 2 pass out of 2 applicable
    expect(summary.naCount).toBe(2)
  })

  it('should calculate correct pass rate with mixed results', () => {
    const items: InspectionItem[] = [
      { result: 'pass' },
      { result: 'pass' },
      { result: 'pass' },
      { result: 'fail' },
    ]

    const summary = calculateSummary(items)
    expect(summary.passRate).toBe(75) // 3 pass out of 4 applicable
  })

  it('should return 100% for empty inspection', () => {
    const items: InspectionItem[] = []

    const summary = calculateSummary(items)
    expect(summary.passRate).toBe(100)
    expect(summary.totalItems).toBe(0)
  })

  it('should return 100% when all items are n/a', () => {
    const items: InspectionItem[] = [{ result: 'n/a' }, { result: 'n/a' }]

    const summary = calculateSummary(items)
    expect(summary.passRate).toBe(100) // No applicable items = 100%
  })
})
