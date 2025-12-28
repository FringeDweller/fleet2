import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// ===============================================
// Schema Definitions (matching API validation)
// ===============================================

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0),
})

const requiredPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  skillLevel: z.enum(['entry', 'intermediate', 'advanced', 'expert']).optional().nullable(),
  checklistItems: z.array(checklistItemSchema).default([]),
  requiredParts: z.array(requiredPartSchema).default([]),
  isActive: z.boolean().default(true),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  skillLevel: z.enum(['entry', 'intermediate', 'advanced', 'expert']).optional().nullable(),
  checklistItems: z.array(checklistItemSchema).optional(),
  requiredParts: z.array(requiredPartSchema).optional(),
  isActive: z.boolean().optional(),
})

// ===============================================
// Test Utilities
// ===============================================

function generateUUID(): string {
  return '123e4567-e89b-12d3-a456-426614174000'
}

function createValidChecklistItem(overrides: Partial<z.infer<typeof checklistItemSchema>> = {}) {
  return {
    id: generateUUID(),
    title: 'Check oil level',
    description: 'Verify oil is at proper level on dipstick',
    isRequired: true,
    order: 0,
    ...overrides,
  }
}

function createValidRequiredPart(overrides: Partial<z.infer<typeof requiredPartSchema>> = {}) {
  return {
    id: generateUUID(),
    partName: 'Oil Filter',
    partNumber: 'OIL-1234',
    quantity: 1,
    estimatedCost: 15.99,
    notes: 'OEM recommended',
    ...overrides,
  }
}

function createValidTemplate(overrides: Partial<z.infer<typeof createTemplateSchema>> = {}) {
  return {
    name: 'Oil Change',
    description: 'Standard oil change procedure',
    category: 'Preventive Maintenance',
    groupId: null,
    estimatedDuration: 30,
    estimatedCost: 75.99,
    skillLevel: 'entry' as const,
    checklistItems: [
      createValidChecklistItem({ id: generateUUID(), order: 0 }),
      createValidChecklistItem({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Replace filter',
        order: 1,
      }),
    ],
    requiredParts: [createValidRequiredPart()],
    isActive: true,
    ...overrides,
  }
}

// ===============================================
// Task Template Schema Validation Tests
// ===============================================

describe('Task Template Schema Validation', () => {
  describe('Create Template', () => {
    it('should validate a complete valid template', () => {
      const template = createValidTemplate()
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should validate a minimal template with only name', () => {
      const template = { name: 'Simple Template' }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.checklistItems).toEqual([])
        expect(result.data.requiredParts).toEqual([])
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should require name field', () => {
      const template = {
        description: 'Template without name',
        estimatedDuration: 30,
      }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('name'))).toBe(true)
      }
    })

    it('should reject empty name', () => {
      const template = { name: '' }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 200 characters', () => {
      const template = { name: 'a'.repeat(201) }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)

      // Valid at max length
      const validTemplate = { name: 'a'.repeat(200) }
      const validResult = createTemplateSchema.safeParse(validTemplate)
      expect(validResult.success).toBe(true)
    })

    it('should allow null for optional fields', () => {
      const template = {
        name: 'Test Template',
        description: null,
        category: null,
        groupId: null,
        estimatedDuration: null,
        estimatedCost: null,
        skillLevel: null,
      }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should validate groupId as UUID when provided', () => {
      const template = { name: 'Test', groupId: 'not-a-uuid' }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)

      const validTemplate = { name: 'Test', groupId: generateUUID() }
      const validResult = createTemplateSchema.safeParse(validTemplate)
      expect(validResult.success).toBe(true)
    })

    it('should default isActive to true', () => {
      const template = { name: 'Test Template' }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should allow setting isActive to false', () => {
      const template = { name: 'Inactive Template', isActive: false }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(false)
      }
    })
  })

  describe('Estimated Duration Validation', () => {
    it('should require positive integer for estimatedDuration', () => {
      const template = { name: 'Test', estimatedDuration: 0 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should reject negative estimatedDuration', () => {
      const template = { name: 'Test', estimatedDuration: -30 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should reject decimal estimatedDuration', () => {
      const template = { name: 'Test', estimatedDuration: 30.5 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should accept valid positive integer estimatedDuration', () => {
      const template = { name: 'Test', estimatedDuration: 60 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })
  })

  describe('Estimated Cost Validation', () => {
    it('should require positive number for estimatedCost', () => {
      const template = { name: 'Test', estimatedCost: 0 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should reject negative estimatedCost', () => {
      const template = { name: 'Test', estimatedCost: -50.0 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should accept valid decimal estimatedCost', () => {
      const template = { name: 'Test', estimatedCost: 75.99 }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })
  })

  describe('Skill Level Validation', () => {
    it('should accept valid skill levels', () => {
      const skillLevels = ['entry', 'intermediate', 'advanced', 'expert'] as const
      for (const skillLevel of skillLevels) {
        const template = { name: 'Test', skillLevel }
        const result = createTemplateSchema.safeParse(template)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid skill level', () => {
      const template = { name: 'Test', skillLevel: 'beginner' }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })
  })

  describe('Category Validation', () => {
    it('should enforce category max length of 100 characters', () => {
      const template = { name: 'Test', category: 'a'.repeat(101) }
      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)

      const validTemplate = { name: 'Test', category: 'a'.repeat(100) }
      const validResult = createTemplateSchema.safeParse(validTemplate)
      expect(validResult.success).toBe(true)
    })
  })
})

// ===============================================
// Checklist Items Validation Tests
// ===============================================

describe('Template Checklist Items Validation', () => {
  it('should validate a valid checklist item', () => {
    const item = createValidChecklistItem()
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('should require id as UUID', () => {
    const item = createValidChecklistItem({ id: 'not-a-uuid' as any })
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should require title', () => {
    const item = { id: generateUUID(), isRequired: false, order: 0 }
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should reject empty title', () => {
    const item = createValidChecklistItem({ title: '' })
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should enforce title max length of 200 characters', () => {
    const item = createValidChecklistItem({ title: 'a'.repeat(201) })
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)

    const validItem = createValidChecklistItem({ title: 'a'.repeat(200) })
    const validResult = checklistItemSchema.safeParse(validItem)
    expect(validResult.success).toBe(true)
  })

  it('should allow description to be optional', () => {
    const item = {
      id: generateUUID(),
      title: 'Check brake pads',
      isRequired: true,
      order: 0,
    }
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('should default isRequired to false', () => {
    const item = {
      id: generateUUID(),
      title: 'Optional check',
      order: 0,
    }
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isRequired).toBe(false)
    }
  })

  it('should require non-negative order', () => {
    const item = createValidChecklistItem({ order: -1 })
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should require order to be an integer', () => {
    const item = createValidChecklistItem({ order: 1.5 })
    const result = checklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should validate template with multiple ordered checklist items', () => {
    const template = createValidTemplate({
      checklistItems: [
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174000',
          order: 0,
          title: 'Step 1',
        }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174001',
          order: 1,
          title: 'Step 2',
        }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174002',
          order: 2,
          title: 'Step 3',
        }),
      ],
    })
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.checklistItems).toHaveLength(3)
      expect(result.data.checklistItems[0].order).toBe(0)
      expect(result.data.checklistItems[1].order).toBe(1)
      expect(result.data.checklistItems[2].order).toBe(2)
    }
  })

  it('should default to empty checklist items array', () => {
    const template = { name: 'No Checklist' }
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.checklistItems).toEqual([])
    }
  })
})

// ===============================================
// Required Parts Validation Tests
// ===============================================

describe('Template Required Parts Validation', () => {
  it('should validate a valid required part', () => {
    const part = createValidRequiredPart()
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(true)
  })

  it('should require id as UUID', () => {
    const part = createValidRequiredPart({ id: 'not-a-uuid' as any })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should require partName', () => {
    const part = { id: generateUUID(), quantity: 1 }
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should reject empty partName', () => {
    const part = createValidRequiredPart({ partName: '' })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should enforce partName max length of 200 characters', () => {
    const part = createValidRequiredPart({ partName: 'a'.repeat(201) })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)

    const validPart = createValidRequiredPart({ partName: 'a'.repeat(200) })
    const validResult = requiredPartSchema.safeParse(validPart)
    expect(validResult.success).toBe(true)
  })

  it('should allow partNumber to be optional', () => {
    const part = {
      id: generateUUID(),
      partName: 'Generic Part',
      quantity: 2,
    }
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(true)
  })

  it('should enforce partNumber max length of 100 characters', () => {
    const part = createValidRequiredPart({ partNumber: 'a'.repeat(101) })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)

    const validPart = createValidRequiredPart({ partNumber: 'a'.repeat(100) })
    const validResult = requiredPartSchema.safeParse(validPart)
    expect(validResult.success).toBe(true)
  })

  it('should default quantity to 1', () => {
    const part = {
      id: generateUUID(),
      partName: 'Single Part',
    }
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
    }
  })

  it('should require positive quantity', () => {
    const part = createValidRequiredPart({ quantity: 0 })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should reject negative quantity', () => {
    const part = createValidRequiredPart({ quantity: -1 })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should require quantity to be an integer', () => {
    const part = createValidRequiredPart({ quantity: 1.5 })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should require positive estimatedCost when provided', () => {
    const part = createValidRequiredPart({ estimatedCost: 0 })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should reject negative estimatedCost', () => {
    const part = createValidRequiredPart({ estimatedCost: -10.99 })
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should allow notes to be optional', () => {
    const part = {
      id: generateUUID(),
      partName: 'Simple Part',
      quantity: 1,
    }
    const result = requiredPartSchema.safeParse(part)
    expect(result.success).toBe(true)
  })

  it('should validate template with multiple required parts', () => {
    const template = createValidTemplate({
      requiredParts: [
        createValidRequiredPart({
          id: '123e4567-e89b-12d3-a456-426614174000',
          partName: 'Oil Filter',
          quantity: 1,
        }),
        createValidRequiredPart({
          id: '123e4567-e89b-12d3-a456-426614174001',
          partName: 'Oil',
          quantity: 5,
        }),
        createValidRequiredPart({
          id: '123e4567-e89b-12d3-a456-426614174002',
          partName: 'Drain Plug',
          quantity: 1,
        }),
      ],
    })
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.requiredParts).toHaveLength(3)
    }
  })

  it('should default to empty required parts array', () => {
    const template = { name: 'No Parts' }
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.requiredParts).toEqual([])
    }
  })
})

// ===============================================
// Template Activation/Deactivation Tests
// ===============================================

describe('Template Activation/Deactivation', () => {
  it('should create an active template by default', () => {
    const template = { name: 'Default Active Template' }
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(true)
    }
  })

  it('should allow creating an inactive template', () => {
    const template = { name: 'Inactive Template', isActive: false }
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(false)
    }
  })

  it('should allow updating isActive to false (deactivation)', () => {
    const update = { isActive: false }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(false)
    }
  })

  it('should allow updating isActive to true (reactivation)', () => {
    const update = { isActive: true }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(true)
    }
  })

  it('should reject non-boolean isActive value', () => {
    const template = { name: 'Test', isActive: 'yes' as any }
    const result = createTemplateSchema.safeParse(template)
    expect(result.success).toBe(false)
  })
})

// ===============================================
// Update Template Schema Validation Tests
// ===============================================

describe('Update Template Schema Validation', () => {
  it('should allow updating only name', () => {
    const update = { name: 'Updated Name' }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  it('should allow updating only description', () => {
    const update = { description: 'Updated description' }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  it('should allow partial updates with multiple fields', () => {
    const update = {
      name: 'Updated Name',
      estimatedDuration: 45,
      isActive: false,
    }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  it('should allow clearing optional fields with null', () => {
    const update = {
      description: null,
      category: null,
      groupId: null,
      estimatedDuration: null,
      estimatedCost: null,
      skillLevel: null,
    }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  it('should validate name when provided', () => {
    const update = { name: '' }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(false)
  })

  it('should validate checklistItems when provided', () => {
    const update = {
      checklistItems: [createValidChecklistItem()],
    }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  it('should reject invalid checklistItems in update', () => {
    const update = {
      checklistItems: [{ invalid: 'item' }],
    }
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(false)
  })

  it('should allow empty object for partial update', () => {
    const update = {}
    const result = updateTemplateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })
})

// ===============================================
// Edge Cases and Business Logic Tests
// ===============================================

describe('Template Business Logic', () => {
  describe('Cost Calculation', () => {
    it('should be able to calculate total estimated cost from parts', () => {
      const parts = [
        createValidRequiredPart({ partName: 'Oil Filter', quantity: 1, estimatedCost: 15.99 }),
        createValidRequiredPart({
          id: '123e4567-e89b-12d3-a456-426614174001',
          partName: 'Oil',
          quantity: 5,
          estimatedCost: 8.99,
        }),
      ]

      const totalCost = parts.reduce((sum, part) => {
        return sum + (part.estimatedCost || 0) * part.quantity
      }, 0)

      expect(totalCost.toFixed(2)).toBe('60.94')
    })
  })

  describe('Checklist Ordering', () => {
    it('should maintain order integrity for checklist items', () => {
      const items = [
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'First',
          order: 0,
        }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Second',
          order: 1,
        }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Third',
          order: 2,
        }),
      ]

      const sortedItems = [...items].sort((a, b) => a.order - b.order)
      expect(sortedItems[0].title).toBe('First')
      expect(sortedItems[1].title).toBe('Second')
      expect(sortedItems[2].title).toBe('Third')
    })

    it('should allow reordering checklist items', () => {
      const items = [
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Was First',
          order: 2,
        }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Was Second',
          order: 0,
        }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Was Third',
          order: 1,
        }),
      ]

      const sortedItems = [...items].sort((a, b) => a.order - b.order)
      expect(sortedItems[0].title).toBe('Was Second')
      expect(sortedItems[1].title).toBe('Was Third')
      expect(sortedItems[2].title).toBe('Was First')
    })
  })

  describe('Required vs Optional Checklist Items', () => {
    it('should distinguish between required and optional items', () => {
      const items = [
        createValidChecklistItem({ title: 'Required Check', isRequired: true }),
        createValidChecklistItem({
          id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Optional Check',
          isRequired: false,
        }),
      ]

      const requiredItems = items.filter((item) => item.isRequired)
      const optionalItems = items.filter((item) => !item.isRequired)

      expect(requiredItems).toHaveLength(1)
      expect(optionalItems).toHaveLength(1)
      expect(requiredItems[0].title).toBe('Required Check')
      expect(optionalItems[0].title).toBe('Optional Check')
    })
  })
})
