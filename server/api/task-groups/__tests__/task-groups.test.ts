import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// ===============================================
// Schema Definitions (matching API validation)
// ===============================================

const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

const reorderSchema = z.object({
  groupId: z.string().uuid(),
  newSortOrder: z.number().int().min(0),
  parentId: z.string().uuid().optional().nullable(),
})

const reorderBatchSchema = z.array(reorderSchema)

// ===============================================
// Test Utilities
// ===============================================

function generateUUID(): string {
  return '123e4567-e89b-12d3-a456-426614174000'
}

function createValidGroup(overrides: Partial<z.infer<typeof createGroupSchema>> = {}) {
  return {
    name: 'Preventive Maintenance',
    description: 'Tasks for regular preventive maintenance',
    parentId: null,
    sortOrder: 0,
    ...overrides,
  }
}

// ===============================================
// Task Group Schema Validation Tests
// ===============================================

describe('Task Group Schema Validation', () => {
  describe('Create Task Group', () => {
    it('should validate a complete valid group', () => {
      const group = createValidGroup()
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(true)
    })

    it('should validate a minimal group with only name', () => {
      const group = { name: 'Simple Group' }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sortOrder).toBe(0)
      }
    })

    it('should require name field', () => {
      const group = {
        description: 'Group without name',
        sortOrder: 1,
      }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('name'))).toBe(true)
      }
    })

    it('should reject empty name', () => {
      const group = { name: '' }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 200 characters', () => {
      const group = { name: 'a'.repeat(201) }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(false)

      // Valid at max length
      const validGroup = { name: 'a'.repeat(200) }
      const validResult = createGroupSchema.safeParse(validGroup)
      expect(validResult.success).toBe(true)
    })

    it('should allow null for optional fields', () => {
      const group = {
        name: 'Test Group',
        description: null,
        parentId: null,
      }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(true)
    })

    it('should validate parentId as UUID when provided', () => {
      const group = { name: 'Child Group', parentId: 'not-a-uuid' }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(false)

      const validGroup = { name: 'Child Group', parentId: generateUUID() }
      const validResult = createGroupSchema.safeParse(validGroup)
      expect(validResult.success).toBe(true)
    })

    it('should default sortOrder to 0', () => {
      const group = { name: 'New Group' }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sortOrder).toBe(0)
      }
    })

    it('should allow positive sortOrder', () => {
      const group = { name: 'Ordered Group', sortOrder: 5 }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(true)
    })

    it('should reject negative sortOrder', () => {
      const group = { name: 'Invalid Group', sortOrder: -1 }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })

    it('should require sortOrder to be an integer', () => {
      const group = { name: 'Invalid Group', sortOrder: 1.5 }
      const result = createGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })
  })

  describe('Update Task Group', () => {
    it('should allow updating only name', () => {
      const update = { name: 'Updated Name' }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow updating only description', () => {
      const update = { description: 'Updated description' }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow updating only sortOrder', () => {
      const update = { sortOrder: 10 }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow partial updates with multiple fields', () => {
      const update = {
        name: 'Updated Name',
        sortOrder: 5,
      }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow clearing description with null', () => {
      const update = { description: null }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow changing parent with valid UUID', () => {
      const update = { parentId: generateUUID() }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow removing parent with null', () => {
      const update = { parentId: null }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate name when provided', () => {
      const update = { name: '' }
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should allow empty object for partial update', () => {
      const update = {}
      const result = updateGroupSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })
})

// ===============================================
// Task Group Ordering Tests
// ===============================================

describe('Task Group Ordering', () => {
  describe('Reorder Single Group', () => {
    it('should validate a valid reorder request', () => {
      const reorder = {
        groupId: generateUUID(),
        newSortOrder: 5,
      }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(true)
    })

    it('should require groupId', () => {
      const reorder = { newSortOrder: 5 }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for groupId', () => {
      const reorder = { groupId: 'not-a-uuid', newSortOrder: 5 }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(false)
    })

    it('should require newSortOrder', () => {
      const reorder = { groupId: generateUUID() }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(false)
    })

    it('should require non-negative newSortOrder', () => {
      const reorder = { groupId: generateUUID(), newSortOrder: -1 }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(false)
    })

    it('should require newSortOrder to be an integer', () => {
      const reorder = { groupId: generateUUID(), newSortOrder: 2.5 }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(false)
    })

    it('should allow parentId in reorder (for moving to different parent)', () => {
      const reorder = {
        groupId: generateUUID(),
        newSortOrder: 0,
        parentId: '123e4567-e89b-12d3-a456-426614174001',
      }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(true)
    })

    it('should allow null parentId (moving to root)', () => {
      const reorder = {
        groupId: generateUUID(),
        newSortOrder: 0,
        parentId: null,
      }
      const result = reorderSchema.safeParse(reorder)
      expect(result.success).toBe(true)
    })
  })

  describe('Batch Reorder', () => {
    it('should validate an empty batch reorder', () => {
      const batch: z.infer<typeof reorderSchema>[] = []
      const result = reorderBatchSchema.safeParse(batch)
      expect(result.success).toBe(true)
    })

    it('should validate a batch with single reorder', () => {
      const batch = [
        {
          groupId: generateUUID(),
          newSortOrder: 0,
        },
      ]
      const result = reorderBatchSchema.safeParse(batch)
      expect(result.success).toBe(true)
    })

    it('should validate a batch with multiple reorders', () => {
      const batch = [
        { groupId: '123e4567-e89b-12d3-a456-426614174000', newSortOrder: 0 },
        { groupId: '123e4567-e89b-12d3-a456-426614174001', newSortOrder: 1 },
        { groupId: '123e4567-e89b-12d3-a456-426614174002', newSortOrder: 2 },
      ]
      const result = reorderBatchSchema.safeParse(batch)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(3)
      }
    })

    it('should reject batch with invalid item', () => {
      const batch = [
        { groupId: generateUUID(), newSortOrder: 0 },
        { groupId: 'not-a-uuid', newSortOrder: 1 },
      ]
      const result = reorderBatchSchema.safeParse(batch)
      expect(result.success).toBe(false)
    })

    it('should validate batch with mixed parent changes', () => {
      const batch = [
        { groupId: '123e4567-e89b-12d3-a456-426614174000', newSortOrder: 0, parentId: null },
        {
          groupId: '123e4567-e89b-12d3-a456-426614174001',
          newSortOrder: 0,
          parentId: '123e4567-e89b-12d3-a456-426614174000',
        },
        {
          groupId: '123e4567-e89b-12d3-a456-426614174002',
          newSortOrder: 1,
          parentId: '123e4567-e89b-12d3-a456-426614174000',
        },
      ]
      const result = reorderBatchSchema.safeParse(batch)
      expect(result.success).toBe(true)
    })
  })
})

// ===============================================
// Hierarchical Group Structure Tests
// ===============================================

describe('Hierarchical Group Structure', () => {
  it('should support root-level groups (no parent)', () => {
    const group = createValidGroup({ parentId: null })
    const result = createGroupSchema.safeParse(group)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parentId).toBeNull()
    }
  })

  it('should support child groups with valid parent', () => {
    const group = createValidGroup({
      name: 'Child Group',
      parentId: generateUUID(),
    })
    const result = createGroupSchema.safeParse(group)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parentId).toBe(generateUUID())
    }
  })

  it('should organize groups by sortOrder within same parent', () => {
    const groups = [
      { id: '1', name: 'First', parentId: null, sortOrder: 0 },
      { id: '2', name: 'Second', parentId: null, sortOrder: 1 },
      { id: '3', name: 'Third', parentId: null, sortOrder: 2 },
    ]

    const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder)
    expect(sortedGroups[0].name).toBe('First')
    expect(sortedGroups[1].name).toBe('Second')
    expect(sortedGroups[2].name).toBe('Third')
  })

  it('should filter groups by parent', () => {
    const parentId = '123e4567-e89b-12d3-a456-426614174000'
    const groups = [
      { id: '1', name: 'Root 1', parentId: null, sortOrder: 0 },
      { id: '2', name: 'Root 2', parentId: null, sortOrder: 1 },
      { id: '3', name: 'Child 1', parentId, sortOrder: 0 },
      { id: '4', name: 'Child 2', parentId, sortOrder: 1 },
    ]

    const rootGroups = groups.filter((g) => g.parentId === null)
    const childGroups = groups.filter((g) => g.parentId === parentId)

    expect(rootGroups).toHaveLength(2)
    expect(childGroups).toHaveLength(2)
  })

  it('should maintain order after reordering', () => {
    const groups = [
      { id: '1', name: 'Was First', sortOrder: 2 },
      { id: '2', name: 'Was Second', sortOrder: 0 },
      { id: '3', name: 'Was Third', sortOrder: 1 },
    ]

    const reorderedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder)

    expect(reorderedGroups[0].name).toBe('Was Second')
    expect(reorderedGroups[1].name).toBe('Was Third')
    expect(reorderedGroups[2].name).toBe('Was First')
  })
})

// ===============================================
// Group Name Validation Edge Cases
// ===============================================

describe('Group Name Validation Edge Cases', () => {
  it('should accept names with special characters', () => {
    const names = [
      'Preventive Maintenance (PM)',
      'Oil & Fluid Changes',
      'Tier 1 - Basic',
      "Driver's Responsibility",
      'A/C & Heating',
    ]

    for (const name of names) {
      const result = createGroupSchema.safeParse({ name })
      expect(result.success).toBe(true)
    }
  })

  it('should accept names with numbers', () => {
    const group = { name: '90-Day Maintenance' }
    const result = createGroupSchema.safeParse(group)
    expect(result.success).toBe(true)
  })

  it('should accept names with unicode characters', () => {
    const group = { name: 'Mantenimiento Preventivo' }
    const result = createGroupSchema.safeParse(group)
    expect(result.success).toBe(true)
  })

  it('should handle whitespace in names', () => {
    const group = { name: '  Trimmed Name  ' }
    const result = createGroupSchema.safeParse(group)
    // Note: Zod doesn't trim by default, the API might handle trimming
    expect(result.success).toBe(true)
  })
})

// ===============================================
// Business Logic Tests
// ===============================================

describe('Task Group Business Logic', () => {
  describe('Group Tree Structure', () => {
    function buildTree(
      groups: { id: string; name: string; parentId: string | null; sortOrder: number }[],
    ): Map<string | null, typeof groups> {
      const tree = new Map<string | null, typeof groups>()

      for (const group of groups) {
        const parentKey = group.parentId
        if (!tree.has(parentKey)) {
          tree.set(parentKey, [])
        }
        tree.get(parentKey)!.push(group)
      }

      // Sort children by sortOrder
      for (const [, children] of tree) {
        children.sort((a, b) => a.sortOrder - b.sortOrder)
      }

      return tree
    }

    it('should build a tree structure from flat groups', () => {
      const groups = [
        { id: '1', name: 'Root 1', parentId: null, sortOrder: 0 },
        { id: '2', name: 'Root 2', parentId: null, sortOrder: 1 },
        { id: '3', name: 'Child 1-1', parentId: '1', sortOrder: 0 },
        { id: '4', name: 'Child 1-2', parentId: '1', sortOrder: 1 },
        { id: '5', name: 'Child 2-1', parentId: '2', sortOrder: 0 },
      ]

      const tree = buildTree(groups)

      expect(tree.get(null)).toHaveLength(2)
      expect(tree.get('1')).toHaveLength(2)
      expect(tree.get('2')).toHaveLength(1)
      expect(tree.get('3')).toBeUndefined() // No children
    })

    it('should correctly order siblings', () => {
      const groups = [
        { id: '3', name: 'Third', parentId: null, sortOrder: 2 },
        { id: '1', name: 'First', parentId: null, sortOrder: 0 },
        { id: '2', name: 'Second', parentId: null, sortOrder: 1 },
      ]

      const tree = buildTree(groups)
      const rootChildren = tree.get(null)!

      expect(rootChildren[0].name).toBe('First')
      expect(rootChildren[1].name).toBe('Second')
      expect(rootChildren[2].name).toBe('Third')
    })
  })

  describe('Path Calculation', () => {
    it('should calculate full path for nested groups', () => {
      const groupsById = new Map([
        ['1', { id: '1', name: 'Fleet Maintenance', parentId: null }],
        ['2', { id: '2', name: 'Preventive', parentId: '1' }],
        ['3', { id: '3', name: 'Oil Changes', parentId: '2' }],
      ])

      function getPath(groupId: string): string[] {
        const path: string[] = []
        let current = groupsById.get(groupId)

        while (current) {
          path.unshift(current.name)
          current = current.parentId ? groupsById.get(current.parentId) : undefined
        }

        return path
      }

      expect(getPath('3')).toEqual(['Fleet Maintenance', 'Preventive', 'Oil Changes'])
      expect(getPath('2')).toEqual(['Fleet Maintenance', 'Preventive'])
      expect(getPath('1')).toEqual(['Fleet Maintenance'])
    })

    it('should build breadcrumb string', () => {
      function buildBreadcrumb(path: string[]): string {
        return path.join(' > ')
      }

      expect(buildBreadcrumb(['Fleet Maintenance', 'Preventive', 'Oil Changes'])).toBe(
        'Fleet Maintenance > Preventive > Oil Changes',
      )
    })
  })

  describe('Circular Reference Prevention', () => {
    it('should detect when a group would be its own ancestor', () => {
      function wouldCreateCircle(
        groupId: string,
        newParentId: string | null,
        groupsById: Map<string, { id: string; parentId: string | null }>,
      ): boolean {
        if (!newParentId) return false
        if (newParentId === groupId) return true

        let current = groupsById.get(newParentId)
        while (current) {
          if (current.id === groupId) return true
          if (!current.parentId) break
          current = groupsById.get(current.parentId)
        }

        return false
      }

      const groupsById = new Map([
        ['1', { id: '1', parentId: null }],
        ['2', { id: '2', parentId: '1' }],
        ['3', { id: '3', parentId: '2' }],
      ])

      // Valid: moving 3 under 1
      expect(wouldCreateCircle('3', '1', groupsById)).toBe(false)

      // Invalid: moving 1 under 3 (would create circle)
      expect(wouldCreateCircle('1', '3', groupsById)).toBe(true)

      // Invalid: moving 1 under 2 (would create circle)
      expect(wouldCreateCircle('1', '2', groupsById)).toBe(true)

      // Invalid: setting self as parent
      expect(wouldCreateCircle('2', '2', groupsById)).toBe(true)

      // Valid: moving to root
      expect(wouldCreateCircle('3', null, groupsById)).toBe(false)
    })
  })
})
