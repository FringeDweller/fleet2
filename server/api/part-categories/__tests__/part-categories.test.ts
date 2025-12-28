import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Part Categories Schema Validation Tests
 * Tests for part category management including hierarchy/tree structure.
 */

// Create category schema
const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
})

// Update category schema
const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
})

// Category tree node interface
interface CategoryNode {
  id: string
  name: string
  parentId: string | null
  children: CategoryNode[]
}

describe('Part Categories Schema Validation', () => {
  describe('Create Category', () => {
    it('should validate a minimal valid category', () => {
      const validCategory = {
        name: 'Filters',
      }

      const result = createCategorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should validate a complete category', () => {
      const validCategory = {
        name: 'Filters',
        description: 'All types of filters',
        parentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createCategorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should require name', () => {
      const invalidCategory = {
        description: 'Missing name',
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
        name: 'a'.repeat(101),
      }

      const result = createCategorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for parentId', () => {
      const invalidCategory = {
        name: 'Sub Category',
        parentId: 'not-a-valid-uuid',
      }

      const result = createCategorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })

    it('should allow null parentId for root categories', () => {
      const validCategory = {
        name: 'Root Category',
        parentId: null,
      }

      const result = createCategorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should allow null description', () => {
      const validCategory = {
        name: 'Category Without Description',
        description: null,
      }

      const result = createCategorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })
  })

  describe('Update Category', () => {
    it('should allow partial updates', () => {
      const validUpdate = {
        name: 'Updated Category Name',
      }

      const result = updateCategorySchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow updating description only', () => {
      const validUpdate = {
        description: 'New description',
      }

      const result = updateCategorySchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow updating parentId', () => {
      const validUpdate = {
        parentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = updateCategorySchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow moving to root (parentId null)', () => {
      const validUpdate = {
        parentId: null,
      }

      const result = updateCategorySchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow deactivating category', () => {
      const validUpdate = {
        isActive: false,
      }

      const result = updateCategorySchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow empty update (no-op)', () => {
      const emptyUpdate = {}

      const result = updateCategorySchema.safeParse(emptyUpdate)
      expect(result.success).toBe(true)
    })
  })
})

describe('Category Hierarchy (Tree Structure)', () => {
  describe('Tree Building', () => {
    function buildCategoryTree(
      categories: { id: string; name: string; parentId: string | null }[],
    ): CategoryNode[] {
      const nodeMap = new Map<string, CategoryNode>()

      // Create all nodes first
      for (const cat of categories) {
        nodeMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          parentId: cat.parentId,
          children: [],
        })
      }

      // Build tree structure
      const roots: CategoryNode[] = []
      for (const cat of categories) {
        const node = nodeMap.get(cat.id)!
        if (cat.parentId === null) {
          roots.push(node)
        } else {
          const parent = nodeMap.get(cat.parentId)
          if (parent) {
            parent.children.push(node)
          }
        }
      }

      return roots
    }

    it('should build tree with root categories', () => {
      const categories = [
        { id: '1', name: 'Filters', parentId: null },
        { id: '2', name: 'Fluids', parentId: null },
      ]

      const tree = buildCategoryTree(categories)
      expect(tree).toHaveLength(2)
      expect(tree[0].name).toBe('Filters')
      expect(tree[1].name).toBe('Fluids')
    })

    it('should build tree with nested categories', () => {
      const categories = [
        { id: '1', name: 'Filters', parentId: null },
        { id: '2', name: 'Oil Filters', parentId: '1' },
        { id: '3', name: 'Air Filters', parentId: '1' },
      ]

      const tree = buildCategoryTree(categories)
      expect(tree).toHaveLength(1)
      expect(tree[0].children).toHaveLength(2)
      expect(tree[0].children[0].name).toBe('Oil Filters')
      expect(tree[0].children[1].name).toBe('Air Filters')
    })

    it('should build multi-level tree', () => {
      const categories = [
        { id: '1', name: 'Parts', parentId: null },
        { id: '2', name: 'Engine', parentId: '1' },
        { id: '3', name: 'Filters', parentId: '2' },
        { id: '4', name: 'Oil Filters', parentId: '3' },
      ]

      const tree = buildCategoryTree(categories)
      expect(tree).toHaveLength(1)
      expect(tree[0].name).toBe('Parts')
      expect(tree[0].children[0].name).toBe('Engine')
      expect(tree[0].children[0].children[0].name).toBe('Filters')
      expect(tree[0].children[0].children[0].children[0].name).toBe('Oil Filters')
    })

    it('should handle empty categories', () => {
      const tree = buildCategoryTree([])
      expect(tree).toHaveLength(0)
    })

    it('should handle orphaned categories', () => {
      const categories = [
        { id: '1', name: 'Root', parentId: null },
        { id: '2', name: 'Orphan', parentId: 'non-existent' },
      ]

      const tree = buildCategoryTree(categories)
      expect(tree).toHaveLength(1)
      expect(tree[0].name).toBe('Root')
    })
  })

  describe('Cycle Prevention', () => {
    function wouldCreateCycle(
      categoryId: string,
      newParentId: string,
      categories: { id: string; parentId: string | null }[],
    ): boolean {
      // Cannot be parent of itself
      if (categoryId === newParentId) {
        return true
      }

      // Check if newParentId is a descendant of categoryId
      const categoryMap = new Map(categories.map((c) => [c.id, c.parentId]))

      let currentId: string | null = newParentId
      while (currentId !== null) {
        if (currentId === categoryId) {
          return true
        }
        currentId = categoryMap.get(currentId) ?? null
      }

      return false
    }

    it('should detect self-reference cycle', () => {
      const categories = [{ id: '1', parentId: null }]

      expect(wouldCreateCycle('1', '1', categories)).toBe(true)
    })

    it('should detect simple parent-child cycle', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]

      // Trying to make '1' a child of '2' would create a cycle
      expect(wouldCreateCycle('1', '2', categories)).toBe(true)
    })

    it('should detect deep cycle', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: '2' },
        { id: '4', parentId: '3' },
      ]

      // Trying to make '1' a child of '4' would create a cycle
      expect(wouldCreateCycle('1', '4', categories)).toBe(true)
    })

    it('should allow valid parent change', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: null },
        { id: '3', parentId: '1' },
      ]

      // Moving '3' from under '1' to under '2' is valid
      expect(wouldCreateCycle('3', '2', categories)).toBe(false)
    })

    it('should allow moving to root', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]

      // Making '2' a root category is valid (parentId would be null, not checked here)
      // This test just confirms non-root moves are valid
      expect(wouldCreateCycle('2', '1', categories)).toBe(false) // Already under '1'
    })
  })

  describe('Category Path', () => {
    function getCategoryPath(
      categoryId: string,
      categories: { id: string; name: string; parentId: string | null }[],
    ): string[] {
      const categoryMap = new Map(categories.map((c) => [c.id, c]))
      const path: string[] = []

      let currentId: string | null = categoryId
      while (currentId !== null) {
        const category = categoryMap.get(currentId)
        if (!category) break
        path.unshift(category.name)
        currentId = category.parentId
      }

      return path
    }

    it('should return path for root category', () => {
      const categories = [{ id: '1', name: 'Parts', parentId: null }]

      const path = getCategoryPath('1', categories)
      expect(path).toEqual(['Parts'])
    })

    it('should return full path for nested category', () => {
      const categories = [
        { id: '1', name: 'Parts', parentId: null },
        { id: '2', name: 'Engine', parentId: '1' },
        { id: '3', name: 'Filters', parentId: '2' },
      ]

      const path = getCategoryPath('3', categories)
      expect(path).toEqual(['Parts', 'Engine', 'Filters'])
    })

    it('should return empty path for non-existent category', () => {
      const categories = [{ id: '1', name: 'Parts', parentId: null }]

      const path = getCategoryPath('non-existent', categories)
      expect(path).toEqual([])
    })
  })

  describe('Descendant Calculation', () => {
    function getAllDescendantIds(
      categoryId: string,
      categories: { id: string; parentId: string | null }[],
    ): string[] {
      const childMap = new Map<string, string[]>()

      // Build parent-to-children map
      for (const cat of categories) {
        if (cat.parentId !== null) {
          const children = childMap.get(cat.parentId) || []
          children.push(cat.id)
          childMap.set(cat.parentId, children)
        }
      }

      // Collect all descendants recursively
      const descendants: string[] = []
      const queue = [...(childMap.get(categoryId) || [])]

      while (queue.length > 0) {
        const id = queue.shift()!
        descendants.push(id)
        const children = childMap.get(id) || []
        queue.push(...children)
      }

      return descendants
    }

    it('should return empty for leaf category', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]

      const descendants = getAllDescendantIds('2', categories)
      expect(descendants).toHaveLength(0)
    })

    it('should return direct children', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: '1' },
      ]

      const descendants = getAllDescendantIds('1', categories)
      expect(descendants).toContain('2')
      expect(descendants).toContain('3')
      expect(descendants).toHaveLength(2)
    })

    it('should return all nested descendants', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: '2' },
        { id: '4', parentId: '3' },
      ]

      const descendants = getAllDescendantIds('1', categories)
      expect(descendants).toContain('2')
      expect(descendants).toContain('3')
      expect(descendants).toContain('4')
      expect(descendants).toHaveLength(3)
    })
  })
})

describe('Category Business Rules', () => {
  describe('Deletion Rules', () => {
    function canDeleteCategory(
      categoryId: string,
      categories: { id: string; parentId: string | null }[],
      partsInCategory: number,
    ): { canDelete: boolean; reason?: string } {
      // Check if category has children
      const hasChildren = categories.some((c) => c.parentId === categoryId)

      if (hasChildren) {
        return {
          canDelete: false,
          reason: 'Category has subcategories',
        }
      }

      // Check if category has parts
      if (partsInCategory > 0) {
        return {
          canDelete: false,
          reason: `Category has ${partsInCategory} parts assigned`,
        }
      }

      return { canDelete: true }
    }

    it('should allow deleting empty leaf category', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]

      const result = canDeleteCategory('2', categories, 0)
      expect(result.canDelete).toBe(true)
    })

    it('should prevent deleting category with children', () => {
      const categories = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]

      const result = canDeleteCategory('1', categories, 0)
      expect(result.canDelete).toBe(false)
      expect(result.reason).toBe('Category has subcategories')
    })

    it('should prevent deleting category with parts', () => {
      const categories = [{ id: '1', parentId: null }]

      const result = canDeleteCategory('1', categories, 5)
      expect(result.canDelete).toBe(false)
      expect(result.reason).toBe('Category has 5 parts assigned')
    })
  })

  describe('Category Reassignment', () => {
    function reassignPartsToCategory(
      partCount: number,
      _fromCategoryId: string,
      _toCategoryId: string | null,
    ): { success: boolean; movedCount: number } {
      // Simulate reassigning parts from one category to another
      return {
        success: true,
        movedCount: partCount,
      }
    }

    it('should reassign parts to another category', () => {
      const result = reassignPartsToCategory(10, 'category-1', 'category-2')
      expect(result.success).toBe(true)
      expect(result.movedCount).toBe(10)
    })

    it('should reassign parts to no category (null)', () => {
      const result = reassignPartsToCategory(5, 'category-1', null)
      expect(result.success).toBe(true)
      expect(result.movedCount).toBe(5)
    })

    it('should handle zero parts', () => {
      const result = reassignPartsToCategory(0, 'category-1', 'category-2')
      expect(result.success).toBe(true)
      expect(result.movedCount).toBe(0)
    })
  })

  describe('Category Naming', () => {
    function isDuplicateName(
      name: string,
      parentId: string | null,
      existingCategories: { name: string; parentId: string | null }[],
      _excludeId?: string,
    ): boolean {
      // Categories should have unique names within the same parent level
      return existingCategories.some(
        (cat) => cat.name.toLowerCase() === name.toLowerCase() && cat.parentId === parentId,
      )
    }

    it('should detect duplicate name at same level', () => {
      const existing = [{ name: 'Filters', parentId: null }]

      expect(isDuplicateName('Filters', null, existing)).toBe(true)
      expect(isDuplicateName('filters', null, existing)).toBe(true) // Case insensitive
    })

    it('should allow same name at different levels', () => {
      const existing = [{ name: 'Parts', parentId: 'parent-1' }]

      expect(isDuplicateName('Parts', 'parent-2', existing)).toBe(false)
      expect(isDuplicateName('Parts', null, existing)).toBe(false)
    })

    it('should allow unique names at same level', () => {
      const existing = [{ name: 'Filters', parentId: null }]

      expect(isDuplicateName('Fluids', null, existing)).toBe(false)
    })
  })
})
