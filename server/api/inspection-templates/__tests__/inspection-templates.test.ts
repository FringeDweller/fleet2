import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Inspection Templates Tests (Task Templates)
 * Tests for Pre-Start Inspection template management (TEST-F09)
 *
 * Inspection templates define the checklist items that should be completed
 * during pre-start inspections. They can be reused across multiple assets
 * and work orders.
 */

// Template checklist item schema
const templateChecklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().min(0),
})

// Template required part schema
const templateRequiredPartSchema = z.object({
  id: z.string().uuid(),
  partName: z.string().min(1, 'Part name is required').max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().default(1),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

// Skill level enum
const skillLevelEnum = z.enum(['entry', 'intermediate', 'advanced', 'expert'])

// Create template schema
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  skillLevel: skillLevelEnum.optional().nullable(),
  checklistItems: z.array(templateChecklistItemSchema).default([]),
  requiredParts: z.array(templateRequiredPartSchema).default([]),
  isActive: z.boolean().default(true),
})

// Update template schema
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  skillLevel: skillLevelEnum.optional().nullable(),
  checklistItems: z.array(templateChecklistItemSchema).optional(),
  requiredParts: z.array(templateRequiredPartSchema).optional(),
  isActive: z.boolean().optional(),
})

describe('Inspection Template Schema Validation', () => {
  describe('Create Template Schema', () => {
    it('should validate a complete template with all fields', () => {
      const template = {
        name: 'Pre-Start Vehicle Inspection',
        description: 'Standard pre-start inspection checklist for all vehicles',
        category: 'Vehicle Inspection',
        estimatedDuration: 15,
        estimatedCost: 25.5,
        skillLevel: 'entry',
        checklistItems: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Check tire pressure',
            description: 'Verify all tires are properly inflated',
            isRequired: true,
            order: 0,
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            title: 'Check fluid levels',
            description: 'Check oil, coolant, and brake fluid',
            isRequired: true,
            order: 1,
          },
        ],
        requiredParts: [],
        isActive: true,
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should validate a minimal template with only required fields', () => {
      const template = {
        name: 'Basic Inspection',
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.checklistItems).toEqual([])
        expect(result.data.requiredParts).toEqual([])
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should require name', () => {
      const template = {
        description: 'Template without name',
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const template = {
        name: '',
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 200', () => {
      const template = {
        name: 'a'.repeat(201),
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should allow name at exactly max length', () => {
      const template = {
        name: 'a'.repeat(200),
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should allow optional fields to be null', () => {
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

    it('should enforce category max length of 100', () => {
      const template = {
        name: 'Test',
        category: 'a'.repeat(101),
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should require positive estimated duration when provided', () => {
      const template = {
        name: 'Test',
        estimatedDuration: 0,
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })

    it('should reject negative estimated duration', () => {
      const template = {
        name: 'Test',
        estimatedDuration: -5,
      }

      const result = createTemplateSchema.safeParse(template)
      expect(result.success).toBe(false)
    })
  })

  describe('Update Template Schema', () => {
    it('should allow all fields to be optional', () => {
      const update = {}

      const result = updateTemplateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow partial updates', () => {
      const update = {
        name: 'Updated Name',
        isActive: false,
      }

      const result = updateTemplateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate updated name length', () => {
      const update = {
        name: 'a'.repeat(201),
      }

      const result = updateTemplateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })
  })
})

describe('Template Checklist Item Validation', () => {
  it('should validate a complete checklist item', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Check engine oil level',
      description: 'Verify oil is between min and max marks on dipstick',
      isRequired: true,
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('should require valid UUID for id', () => {
    const item = {
      id: 'not-a-uuid',
      title: 'Check something',
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should require title', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should reject empty title', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: '',
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should enforce title max length of 200', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'a'.repeat(201),
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should default isRequired to false', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Optional check',
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isRequired).toBe(false)
    }
  })

  it('should require order field', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Check something',
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should reject negative order', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Check something',
      order: -1,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('should allow order of 0', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'First item',
      order: 0,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('should allow high order values', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Late item',
      order: 9999,
    }

    const result = templateChecklistItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })
})

describe('Template Item Ordering', () => {
  interface ChecklistItem {
    id: string
    title: string
    order: number
  }

  function sortItemsByOrder(items: ChecklistItem[]): ChecklistItem[] {
    return [...items].sort((a, b) => a.order - b.order)
  }

  function reorderItems(items: ChecklistItem[]): ChecklistItem[] {
    const sorted = sortItemsByOrder(items)
    return sorted.map((item, index) => ({
      ...item,
      order: index,
    }))
  }

  function validateUniqueOrdering(items: ChecklistItem[]): boolean {
    const orders = items.map((i) => i.order)
    return new Set(orders).size === orders.length
  }

  it('should sort items by order', () => {
    const items: ChecklistItem[] = [
      { id: '3', title: 'Third', order: 20 },
      { id: '1', title: 'First', order: 0 },
      { id: '2', title: 'Second', order: 10 },
    ]

    const sorted = sortItemsByOrder(items)
    expect(sorted[0].title).toBe('First')
    expect(sorted[1].title).toBe('Second')
    expect(sorted[2].title).toBe('Third')
  })

  it('should reorder items to sequential order', () => {
    const items: ChecklistItem[] = [
      { id: '1', title: 'Item A', order: 5 },
      { id: '2', title: 'Item B', order: 15 },
      { id: '3', title: 'Item C', order: 10 },
    ]

    const reordered = reorderItems(items)
    expect(reordered[0].order).toBe(0)
    expect(reordered[0].title).toBe('Item A')
    expect(reordered[1].order).toBe(1)
    expect(reordered[1].title).toBe('Item C')
    expect(reordered[2].order).toBe(2)
    expect(reordered[2].title).toBe('Item B')
  })

  it('should validate unique ordering', () => {
    const validItems: ChecklistItem[] = [
      { id: '1', title: 'First', order: 0 },
      { id: '2', title: 'Second', order: 1 },
      { id: '3', title: 'Third', order: 2 },
    ]

    expect(validateUniqueOrdering(validItems)).toBe(true)
  })

  it('should detect duplicate order values', () => {
    const invalidItems: ChecklistItem[] = [
      { id: '1', title: 'First', order: 0 },
      { id: '2', title: 'Also first', order: 0 },
      { id: '3', title: 'Second', order: 1 },
    ]

    expect(validateUniqueOrdering(invalidItems)).toBe(false)
  })

  it('should handle empty array', () => {
    const items: ChecklistItem[] = []
    expect(sortItemsByOrder(items)).toEqual([])
    expect(reorderItems(items)).toEqual([])
    expect(validateUniqueOrdering(items)).toBe(true)
  })

  it('should handle single item', () => {
    const items: ChecklistItem[] = [{ id: '1', title: 'Only', order: 5 }]

    const reordered = reorderItems(items)
    expect(reordered[0].order).toBe(0)
    expect(validateUniqueOrdering(items)).toBe(true)
  })
})

describe('Required vs Optional Items', () => {
  interface TemplateItem {
    id: string
    title: string
    isRequired: boolean
  }

  function getRequiredItems(items: TemplateItem[]): TemplateItem[] {
    return items.filter((item) => item.isRequired)
  }

  function getOptionalItems(items: TemplateItem[]): TemplateItem[] {
    return items.filter((item) => !item.isRequired)
  }

  function validateRequiredItemsExist(items: TemplateItem[]): {
    isValid: boolean
    requiredCount: number
    optionalCount: number
  } {
    const required = getRequiredItems(items)
    const optional = getOptionalItems(items)

    return {
      isValid: required.length > 0 || optional.length > 0,
      requiredCount: required.length,
      optionalCount: optional.length,
    }
  }

  it('should separate required and optional items', () => {
    const items: TemplateItem[] = [
      { id: '1', title: 'Check brakes', isRequired: true },
      { id: '2', title: 'Check lights', isRequired: true },
      { id: '3', title: 'Check wiper fluid', isRequired: false },
      { id: '4', title: 'Check tire tread', isRequired: false },
    ]

    const required = getRequiredItems(items)
    const optional = getOptionalItems(items)

    expect(required).toHaveLength(2)
    expect(optional).toHaveLength(2)
  })

  it('should handle all required items', () => {
    const items: TemplateItem[] = [
      { id: '1', title: 'Check brakes', isRequired: true },
      { id: '2', title: 'Check lights', isRequired: true },
    ]

    const result = validateRequiredItemsExist(items)
    expect(result.requiredCount).toBe(2)
    expect(result.optionalCount).toBe(0)
    expect(result.isValid).toBe(true)
  })

  it('should handle all optional items', () => {
    const items: TemplateItem[] = [
      { id: '1', title: 'Optional check 1', isRequired: false },
      { id: '2', title: 'Optional check 2', isRequired: false },
    ]

    const result = validateRequiredItemsExist(items)
    expect(result.requiredCount).toBe(0)
    expect(result.optionalCount).toBe(2)
    expect(result.isValid).toBe(true)
  })

  it('should handle empty items array', () => {
    const items: TemplateItem[] = []

    const result = validateRequiredItemsExist(items)
    expect(result.isValid).toBe(false)
    expect(result.requiredCount).toBe(0)
    expect(result.optionalCount).toBe(0)
  })
})

describe('Skill Level Validation', () => {
  it('should accept entry skill level', () => {
    const result = skillLevelEnum.safeParse('entry')
    expect(result.success).toBe(true)
  })

  it('should accept intermediate skill level', () => {
    const result = skillLevelEnum.safeParse('intermediate')
    expect(result.success).toBe(true)
  })

  it('should accept advanced skill level', () => {
    const result = skillLevelEnum.safeParse('advanced')
    expect(result.success).toBe(true)
  })

  it('should accept expert skill level', () => {
    const result = skillLevelEnum.safeParse('expert')
    expect(result.success).toBe(true)
  })

  it('should reject invalid skill levels', () => {
    const invalidLevels = ['beginner', 'novice', 'master', 'pro', '']

    for (const level of invalidLevels) {
      const result = skillLevelEnum.safeParse(level)
      expect(result.success).toBe(false)
    }
  })
})

describe('Template Required Parts Validation', () => {
  it('should validate a complete required part', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: 'Oil Filter',
      partNumber: 'OIL-FILTER-123',
      quantity: 1,
      estimatedCost: 15.99,
      notes: 'OEM recommended',
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(true)
  })

  it('should require valid UUID for id', () => {
    const part = {
      id: 'invalid-id',
      partName: 'Oil Filter',
      quantity: 1,
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should require partName', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 1,
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should reject empty partName', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: '',
      quantity: 1,
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should default quantity to 1', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: 'Oil Filter',
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
    }
  })

  it('should require positive quantity', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: 'Oil Filter',
      quantity: 0,
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should reject negative quantity', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: 'Oil Filter',
      quantity: -1,
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should require positive estimated cost when provided', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: 'Oil Filter',
      estimatedCost: 0,
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })

  it('should enforce partNumber max length of 100', () => {
    const part = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      partName: 'Oil Filter',
      partNumber: 'a'.repeat(101),
    }

    const result = templateRequiredPartSchema.safeParse(part)
    expect(result.success).toBe(false)
  })
})

describe('Template Category Validation', () => {
  // Common inspection template categories
  const validCategories = [
    'Pre-Start Inspection',
    'Daily Inspection',
    'Weekly Inspection',
    'Monthly Inspection',
    'Quarterly Inspection',
    'Annual Inspection',
    'Safety Inspection',
    'Compliance Inspection',
    'Preventive Maintenance',
    'Vehicle Check',
    'Equipment Check',
    'Other',
  ]

  const categorySchema = z.string().max(100).optional().nullable()

  it('should accept all common inspection categories', () => {
    for (const category of validCategories) {
      const result = categorySchema.safeParse(category)
      expect(result.success).toBe(true)
    }
  })

  it('should allow custom category within length limit', () => {
    const customCategory = 'Custom Inspection Type'
    const result = categorySchema.safeParse(customCategory)
    expect(result.success).toBe(true)
  })

  it('should reject category exceeding 100 characters', () => {
    const longCategory = 'a'.repeat(101)
    const result = categorySchema.safeParse(longCategory)
    expect(result.success).toBe(false)
  })

  it('should allow null category', () => {
    const result = categorySchema.safeParse(null)
    expect(result.success).toBe(true)
  })
})

describe('Template Active State', () => {
  interface Template {
    id: string
    name: string
    isActive: boolean
    isArchived: boolean
  }

  function getActiveTemplates(templates: Template[]): Template[] {
    return templates.filter((t) => t.isActive && !t.isArchived)
  }

  function getInactiveTemplates(templates: Template[]): Template[] {
    return templates.filter((t) => !t.isActive || t.isArchived)
  }

  function canActivateTemplate(template: Template): boolean {
    return !template.isArchived
  }

  it('should filter active templates', () => {
    const templates: Template[] = [
      { id: '1', name: 'Active Template', isActive: true, isArchived: false },
      { id: '2', name: 'Inactive Template', isActive: false, isArchived: false },
      { id: '3', name: 'Archived Template', isActive: true, isArchived: true },
    ]

    const active = getActiveTemplates(templates)
    expect(active).toHaveLength(1)
    expect(active[0].name).toBe('Active Template')
  })

  it('should filter inactive templates', () => {
    const templates: Template[] = [
      { id: '1', name: 'Active Template', isActive: true, isArchived: false },
      { id: '2', name: 'Inactive Template', isActive: false, isArchived: false },
      { id: '3', name: 'Archived Template', isActive: true, isArchived: true },
    ]

    const inactive = getInactiveTemplates(templates)
    expect(inactive).toHaveLength(2)
  })

  it('should not allow activating archived template', () => {
    const archivedTemplate: Template = {
      id: '1',
      name: 'Archived',
      isActive: false,
      isArchived: true,
    }

    expect(canActivateTemplate(archivedTemplate)).toBe(false)
  })

  it('should allow activating non-archived inactive template', () => {
    const inactiveTemplate: Template = {
      id: '1',
      name: 'Inactive',
      isActive: false,
      isArchived: false,
    }

    expect(canActivateTemplate(inactiveTemplate)).toBe(true)
  })
})

describe('Template Versioning', () => {
  interface TemplateVersion {
    id: string
    name: string
    version: number
    checklistItems: { id: string; title: string }[]
  }

  function incrementVersion(template: TemplateVersion): TemplateVersion {
    return {
      ...template,
      version: template.version + 1,
    }
  }

  function hasSignificantChanges(
    oldTemplate: TemplateVersion,
    newTemplate: TemplateVersion,
  ): boolean {
    // Significant change if checklist items changed
    const oldItemIds = new Set(oldTemplate.checklistItems.map((i) => i.id))
    const newItemIds = new Set(newTemplate.checklistItems.map((i) => i.id))

    if (oldItemIds.size !== newItemIds.size) return true

    for (const id of oldItemIds) {
      if (!newItemIds.has(id)) return true
    }

    // Also check if item titles changed
    const oldItemTitles = new Map(oldTemplate.checklistItems.map((i) => [i.id, i.title]))
    for (const item of newTemplate.checklistItems) {
      if (oldItemTitles.get(item.id) !== item.title) return true
    }

    return false
  }

  it('should increment version number', () => {
    const template: TemplateVersion = {
      id: '1',
      name: 'Test Template',
      version: 1,
      checklistItems: [],
    }

    const updated = incrementVersion(template)
    expect(updated.version).toBe(2)
  })

  it('should detect significant change when items added', () => {
    const oldTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [{ id: '1', title: 'Check A' }],
    }

    const newTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [
        { id: '1', title: 'Check A' },
        { id: '2', title: 'Check B' },
      ],
    }

    expect(hasSignificantChanges(oldTemplate, newTemplate)).toBe(true)
  })

  it('should detect significant change when items removed', () => {
    const oldTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [
        { id: '1', title: 'Check A' },
        { id: '2', title: 'Check B' },
      ],
    }

    const newTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [{ id: '1', title: 'Check A' }],
    }

    expect(hasSignificantChanges(oldTemplate, newTemplate)).toBe(true)
  })

  it('should detect significant change when item title changed', () => {
    const oldTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [{ id: '1', title: 'Check A' }],
    }

    const newTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [{ id: '1', title: 'Check A (Updated)' }],
    }

    expect(hasSignificantChanges(oldTemplate, newTemplate)).toBe(true)
  })

  it('should not detect change when items are same', () => {
    const oldTemplate: TemplateVersion = {
      id: '1',
      name: 'Test',
      version: 1,
      checklistItems: [
        { id: '1', title: 'Check A' },
        { id: '2', title: 'Check B' },
      ],
    }

    const newTemplate: TemplateVersion = {
      id: '1',
      name: 'Test Updated', // Name change doesn't count
      version: 1,
      checklistItems: [
        { id: '2', title: 'Check B' }, // Order doesn't matter
        { id: '1', title: 'Check A' },
      ],
    }

    expect(hasSignificantChanges(oldTemplate, newTemplate)).toBe(false)
  })
})

describe('Template Estimated Duration', () => {
  const durationSchema = z.number().int().positive().optional().nullable()

  it('should accept valid duration in minutes', () => {
    const validDurations = [5, 10, 15, 30, 60, 120, 240]

    for (const duration of validDurations) {
      const result = durationSchema.safeParse(duration)
      expect(result.success).toBe(true)
    }
  })

  it('should reject zero duration', () => {
    const result = durationSchema.safeParse(0)
    expect(result.success).toBe(false)
  })

  it('should reject negative duration', () => {
    const result = durationSchema.safeParse(-15)
    expect(result.success).toBe(false)
  })

  it('should reject decimal duration', () => {
    const result = durationSchema.safeParse(15.5)
    expect(result.success).toBe(false)
  })

  it('should allow null duration', () => {
    const result = durationSchema.safeParse(null)
    expect(result.success).toBe(true)
  })
})
