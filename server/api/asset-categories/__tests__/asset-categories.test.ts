import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Schema definitions based on server/api/asset-categories/index.post.ts
const maintenanceScheduleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  intervalDays: z.number().int().positive().optional(),
  intervalHours: z.number().positive().optional(),
  intervalMileage: z.number().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  checklistItems: z.array(z.string()).optional(),
})

const defaultPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  defaultMaintenanceSchedules: z.array(maintenanceScheduleSchema).optional().default([]),
  defaultParts: z.array(defaultPartSchema).optional().default([]),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  defaultMaintenanceSchedules: z.array(maintenanceScheduleSchema).optional(),
  defaultParts: z.array(defaultPartSchema).optional(),
})

describe('Asset Category Schema Validation', () => {
  describe('Create Category', () => {
    it('should validate a complete category', () => {
      const validCategory = {
        name: 'Heavy Trucks',
        description: 'Category for all heavy duty trucks over 10 tons',
        parentId: null,
        defaultMaintenanceSchedules: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Oil Change',
            description: 'Regular oil change',
            intervalDays: 90,
            intervalMileage: 5000,
            estimatedDuration: 30,
            checklistItems: ['Drain old oil', 'Replace filter', 'Add new oil'],
          },
        ],
        defaultParts: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            partName: 'Oil Filter',
            partNumber: 'OF-1234',
            quantity: 1,
            estimatedCost: 15.99,
            notes: 'OEM replacement',
          },
        ],
      }

      const result = createCategorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should require name field', () => {
      const invalidCategory = {
        description: 'Category without name',
      }

      const result = createCategorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const invalidCategory = {
        name: '',
      }

      const result = createCategorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 100', () => {
      const invalidCategory = {
        name: 'A'.repeat(101),
      }

      const result = createCategorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })

    it('should accept name at max length', () => {
      const validCategory = {
        name: 'A'.repeat(100),
      }

      const result = createCategorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should validate a minimal category with just name', () => {
      const minimalCategory = {
        name: 'Vehicles',
      }

      const result = createCategorySchema.safeParse(minimalCategory)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.defaultMaintenanceSchedules).toEqual([])
        expect(result.data.defaultParts).toEqual([])
      }
    })

    it('should validate category with parentId', () => {
      const category = {
        name: 'Light Trucks',
        parentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createCategorySchema.safeParse(category)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID for parentId', () => {
      const invalidCategory = {
        name: 'Invalid Parent',
        parentId: 'not-a-uuid',
      }

      const result = createCategorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })

    it('should allow null parentId for root categories', () => {
      const rootCategory = {
        name: 'Root Category',
        parentId: null,
      }

      const result = createCategorySchema.safeParse(rootCategory)
      expect(result.success).toBe(true)
    })
  })

  describe('Update Category', () => {
    it('should validate partial update with just name', () => {
      const update = {
        name: 'Updated Name',
      }

      const result = updateCategorySchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate update with isActive field', () => {
      const update = {
        isActive: false,
      }

      const result = updateCategorySchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow empty update (no fields)', () => {
      const update = {}

      const result = updateCategorySchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow changing parentId to null', () => {
      const update = {
        parentId: null,
      }

      const result = updateCategorySchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })

  describe('Maintenance Schedule Validation', () => {
    it('should validate a complete maintenance schedule', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Brake Inspection',
        description: 'Inspect brake pads and rotors',
        intervalDays: 180,
        intervalHours: 500,
        intervalMileage: 15000,
        estimatedDuration: 60,
        checklistItems: ['Check brake pads', 'Measure rotor thickness', 'Test brake fluid'],
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(true)
    })

    it('should require id field', () => {
      const schedule = {
        name: 'Schedule without ID',
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should require name field', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should require positive intervalDays', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        intervalDays: 0,
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should require positive intervalHours', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        intervalHours: -10,
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should require positive intervalMileage', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        intervalMileage: 0,
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should require positive estimatedDuration', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        estimatedDuration: -5,
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should accept schedule with only required fields', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Minimal Schedule',
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(true)
    })

    it('should enforce name max length of 100', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'A'.repeat(101),
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(false)
    })

    it('should validate empty checklist items array', () => {
      const schedule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'No Checklist',
        checklistItems: [],
      }

      const result = maintenanceScheduleSchema.safeParse(schedule)
      expect(result.success).toBe(true)
    })
  })

  describe('Default Part Validation', () => {
    it('should validate a complete default part', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        partName: 'Oil Filter',
        partNumber: 'OF-1234',
        quantity: 2,
        estimatedCost: 25.99,
        notes: 'Premium quality filter',
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(true)
    })

    it('should require id field', () => {
      const part = {
        partName: 'No ID Part',
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(false)
    })

    it('should require partName field', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(false)
    })

    it('should default quantity to 1', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        partName: 'Test Part',
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(1)
      }
    })

    it('should require positive quantity', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        partName: 'Test Part',
        quantity: 0,
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(false)
    })

    it('should require positive estimatedCost if provided', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        partName: 'Test Part',
        estimatedCost: -10,
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(false)
    })

    it('should enforce partName max length of 200', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        partName: 'A'.repeat(201),
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(false)
    })

    it('should enforce partNumber max length of 100', () => {
      const part = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        partName: 'Test Part',
        partNumber: 'A'.repeat(101),
      }

      const result = defaultPartSchema.safeParse(part)
      expect(result.success).toBe(false)
    })
  })
})

describe('Category Hierarchy Validation', () => {
  interface CategoryNode {
    id: string
    name: string
    parentId: string | null
    children: CategoryNode[]
    depth: number
  }

  function buildCategoryTree(
    categories: Array<{ id: string; name: string; parentId: string | null }>,
  ): CategoryNode[] {
    const categoryMap = new Map<string, CategoryNode>()

    // First pass: create all nodes
    for (const cat of categories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        parentId: cat.parentId,
        children: [],
        depth: 0,
      })
    }

    // Second pass: build parent-child relationships and calculate depth
    const rootCategories: CategoryNode[] = []

    for (const cat of categories) {
      const node = categoryMap.get(cat.id)!
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!
        parent.children.push(node)
        node.depth = parent.depth + 1
      } else {
        rootCategories.push(node)
      }
    }

    return rootCategories
  }

  function getMaxDepth(nodes: CategoryNode[], currentDepth = 0): number {
    if (nodes.length === 0) return currentDepth
    return Math.max(...nodes.map((node) => getMaxDepth(node.children, currentDepth + 1)))
  }

  function findCircularReference(
    categories: Array<{ id: string; parentId: string | null }>,
  ): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    function hasCycle(id: string): boolean {
      if (recursionStack.has(id)) return true
      if (visited.has(id)) return false

      visited.add(id)
      recursionStack.add(id)

      const category = categories.find((c) => c.id === id)
      if (category?.parentId) {
        if (hasCycle(category.parentId)) return true
      }

      recursionStack.delete(id)
      return false
    }

    for (const category of categories) {
      if (hasCycle(category.id)) return true
    }

    return false
  }

  it('should build a valid tree from flat categories', () => {
    const categories = [
      { id: '1', name: 'Vehicles', parentId: null },
      { id: '2', name: 'Trucks', parentId: '1' },
      { id: '3', name: 'Light Trucks', parentId: '2' },
      { id: '4', name: 'Heavy Trucks', parentId: '2' },
      { id: '5', name: 'Cars', parentId: '1' },
    ]

    const tree = buildCategoryTree(categories)

    expect(tree).toHaveLength(1) // One root
    expect(tree[0].name).toBe('Vehicles')
    expect(tree[0].children).toHaveLength(2) // Trucks and Cars
  })

  it('should correctly calculate tree depth', () => {
    const categories = [
      { id: '1', name: 'Root', parentId: null },
      { id: '2', name: 'Level 1', parentId: '1' },
      { id: '3', name: 'Level 2', parentId: '2' },
      { id: '4', name: 'Level 3', parentId: '3' },
    ]

    const tree = buildCategoryTree(categories)
    const maxDepth = getMaxDepth(tree)

    expect(maxDepth).toBe(4) // 4 levels deep
  })

  it('should handle multiple root categories', () => {
    const categories = [
      { id: '1', name: 'Vehicles', parentId: null },
      { id: '2', name: 'Equipment', parentId: null },
      { id: '3', name: 'Tools', parentId: null },
    ]

    const tree = buildCategoryTree(categories)
    expect(tree).toHaveLength(3)
  })

  it('should detect circular reference', () => {
    const categoriesWithCycle = [
      { id: '1', parentId: '3' },
      { id: '2', parentId: '1' },
      { id: '3', parentId: '2' }, // Creates a cycle: 1 -> 3 -> 2 -> 1
    ]

    expect(findCircularReference(categoriesWithCycle)).toBe(true)
  })

  it('should not detect circular reference in valid hierarchy', () => {
    const validCategories = [
      { id: '1', parentId: null },
      { id: '2', parentId: '1' },
      { id: '3', parentId: '2' },
    ]

    expect(findCircularReference(validCategories)).toBe(false)
  })

  it('should handle orphaned categories (parent not found)', () => {
    const categories = [
      { id: '1', name: 'Root', parentId: null },
      { id: '2', name: 'Orphan', parentId: 'non-existent-id' },
    ]

    const tree = buildCategoryTree(categories)
    // Orphaned category becomes a root
    expect(tree).toHaveLength(2)
  })

  it('should validate self-referencing parentId is not allowed', () => {
    const selfReference = [{ id: '1', parentId: '1' }]

    expect(findCircularReference(selfReference)).toBe(true)
  })
})

describe('Category Tree Response Validation', () => {
  const categoryNodeSchema: z.ZodType<{
    id: string
    name: string
    description: string | null
    parentId: string | null
    isActive: boolean
    assetCount: number
    children: unknown[]
  }> = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    parentId: z.string().uuid().nullable(),
    isActive: z.boolean(),
    assetCount: z.number().int().nonnegative(),
    children: z.array(z.lazy(() => categoryNodeSchema)),
  })

  it('should validate a valid category tree node', () => {
    const node = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Vehicles',
      description: 'All vehicles',
      parentId: null,
      isActive: true,
      assetCount: 25,
      children: [],
    }

    const result = categoryNodeSchema.safeParse(node)
    expect(result.success).toBe(true)
  })

  it('should validate nested children', () => {
    const node = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Vehicles',
      description: null,
      parentId: null,
      isActive: true,
      assetCount: 25,
      children: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Trucks',
          description: 'All trucks',
          parentId: '123e4567-e89b-12d3-a456-426614174000',
          isActive: true,
          assetCount: 10,
          children: [],
        },
      ],
    }

    const result = categoryNodeSchema.safeParse(node)
    expect(result.success).toBe(true)
  })

  it('should require non-negative assetCount', () => {
    const node = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test',
      description: null,
      parentId: null,
      isActive: true,
      assetCount: -1,
      children: [],
    }

    const result = categoryNodeSchema.safeParse(node)
    expect(result.success).toBe(false)
  })
})

describe('Category Filter Validation', () => {
  const categoryFilterSchema = z.object({
    includeInactive: z.boolean().optional().default(false),
    parentId: z.string().uuid().optional(),
    search: z.string().optional(),
  })

  it('should validate empty filters', () => {
    const result = categoryFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.includeInactive).toBe(false)
    }
  })

  it('should validate includeInactive filter', () => {
    const filters = { includeInactive: true }
    const result = categoryFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should validate parentId filter', () => {
    const filters = { parentId: '123e4567-e89b-12d3-a456-426614174000' }
    const result = categoryFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should reject invalid parentId', () => {
    const filters = { parentId: 'invalid' }
    const result = categoryFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should validate search filter', () => {
    const filters = { search: 'truck' }
    const result = categoryFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })
})
