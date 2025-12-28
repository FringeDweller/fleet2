import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Storage Locations Schema Validation Tests
 * Tests for storage location management including hierarchy structure.
 */

// Location type enum schema
const locationTypeSchema = z.enum([
  'warehouse',
  'bin',
  'shelf',
  'truck',
  'building',
  'room',
  'other',
])

// Create location schema
const createLocationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  type: locationTypeSchema.default('warehouse'),
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().max(50).optional().nullable(),
})

// Update location schema
const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  type: locationTypeSchema.optional(),
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
})

// Location node interface for hierarchy
interface LocationNode {
  id: string
  name: string
  type: string
  parentId: string | null
  code: string | null
  children: LocationNode[]
}

describe('Storage Locations Schema Validation', () => {
  describe('Location Type Enum', () => {
    it('should accept valid location types', () => {
      const validTypes = ['warehouse', 'bin', 'shelf', 'truck', 'building', 'room', 'other']
      for (const type of validTypes) {
        const result = locationTypeSchema.safeParse(type)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid location types', () => {
      const invalidTypes = ['office', 'garage', 'container', 'rack']
      for (const type of invalidTypes) {
        const result = locationTypeSchema.safeParse(type)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('Create Location', () => {
    it('should validate a minimal valid location', () => {
      const validLocation = {
        name: 'Main Warehouse',
      }

      const result = createLocationSchema.safeParse(validLocation)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('warehouse')
      }
    })

    it('should validate a complete location', () => {
      const validLocation = {
        name: 'Shelf A-01',
        description: 'First shelf in aisle A',
        type: 'shelf',
        parentId: '123e4567-e89b-12d3-a456-426614174000',
        code: 'A-01',
      }

      const result = createLocationSchema.safeParse(validLocation)
      expect(result.success).toBe(true)
    })

    it('should require name', () => {
      const invalidLocation = {
        type: 'warehouse',
      }

      const result = createLocationSchema.safeParse(invalidLocation)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const invalidLocation = {
        name: '',
      }

      const result = createLocationSchema.safeParse(invalidLocation)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 200', () => {
      const invalidLocation = {
        name: 'a'.repeat(201),
      }

      const result = createLocationSchema.safeParse(invalidLocation)
      expect(result.success).toBe(false)
    })

    it('should require valid UUID for parentId', () => {
      const invalidLocation = {
        name: 'Sub Location',
        parentId: 'not-a-valid-uuid',
      }

      const result = createLocationSchema.safeParse(invalidLocation)
      expect(result.success).toBe(false)
    })

    it('should enforce code max length of 50', () => {
      const invalidLocation = {
        name: 'Test Location',
        code: 'a'.repeat(51),
      }

      const result = createLocationSchema.safeParse(invalidLocation)
      expect(result.success).toBe(false)
    })

    it('should allow null for optional fields', () => {
      const validLocation = {
        name: 'Root Location',
        description: null,
        parentId: null,
        code: null,
      }

      const result = createLocationSchema.safeParse(validLocation)
      expect(result.success).toBe(true)
    })

    it('should default type to warehouse', () => {
      const validLocation = {
        name: 'New Location',
      }

      const result = createLocationSchema.safeParse(validLocation)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('warehouse')
      }
    })
  })

  describe('Update Location', () => {
    it('should allow partial updates', () => {
      const validUpdate = {
        name: 'Updated Location Name',
      }

      const result = updateLocationSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow updating type', () => {
      const validUpdate = {
        type: 'bin',
      }

      const result = updateLocationSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow updating code', () => {
      const validUpdate = {
        code: 'NEW-CODE',
      }

      const result = updateLocationSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow moving to different parent', () => {
      const validUpdate = {
        parentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = updateLocationSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow moving to root (parentId null)', () => {
      const validUpdate = {
        parentId: null,
      }

      const result = updateLocationSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow deactivating location', () => {
      const validUpdate = {
        isActive: false,
      }

      const result = updateLocationSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow empty update (no-op)', () => {
      const emptyUpdate = {}

      const result = updateLocationSchema.safeParse(emptyUpdate)
      expect(result.success).toBe(true)
    })
  })
})

describe('Location Hierarchy', () => {
  describe('Tree Building', () => {
    function buildLocationTree(
      locations: {
        id: string
        name: string
        type: string
        parentId: string | null
        code: string | null
      }[],
    ): LocationNode[] {
      const nodeMap = new Map<string, LocationNode>()

      // Create all nodes first
      for (const loc of locations) {
        nodeMap.set(loc.id, {
          id: loc.id,
          name: loc.name,
          type: loc.type,
          parentId: loc.parentId,
          code: loc.code,
          children: [],
        })
      }

      // Build tree structure
      const roots: LocationNode[] = []
      for (const loc of locations) {
        const node = nodeMap.get(loc.id)!
        if (loc.parentId === null) {
          roots.push(node)
        } else {
          const parent = nodeMap.get(loc.parentId)
          if (parent) {
            parent.children.push(node)
          }
        }
      }

      return roots
    }

    it('should build tree with root locations', () => {
      const locations = [
        { id: '1', name: 'Warehouse A', type: 'warehouse', parentId: null, code: 'WH-A' },
        { id: '2', name: 'Warehouse B', type: 'warehouse', parentId: null, code: 'WH-B' },
      ]

      const tree = buildLocationTree(locations)
      expect(tree).toHaveLength(2)
      expect(tree[0].name).toBe('Warehouse A')
      expect(tree[1].name).toBe('Warehouse B')
    })

    it('should build tree with nested locations', () => {
      const locations = [
        { id: '1', name: 'Warehouse A', type: 'warehouse', parentId: null, code: 'WH-A' },
        { id: '2', name: 'Aisle 1', type: 'room', parentId: '1', code: 'A1' },
        { id: '3', name: 'Shelf 1', type: 'shelf', parentId: '2', code: 'S1' },
        { id: '4', name: 'Bin 1', type: 'bin', parentId: '3', code: 'B1' },
      ]

      const tree = buildLocationTree(locations)
      expect(tree).toHaveLength(1)
      expect(tree[0].name).toBe('Warehouse A')
      expect(tree[0].children[0].name).toBe('Aisle 1')
      expect(tree[0].children[0].children[0].name).toBe('Shelf 1')
      expect(tree[0].children[0].children[0].children[0].name).toBe('Bin 1')
    })

    it('should handle truck locations', () => {
      const locations = [
        { id: '1', name: 'Truck Fleet', type: 'other', parentId: null, code: 'TF' },
        { id: '2', name: 'Truck 001', type: 'truck', parentId: '1', code: 'T-001' },
        { id: '3', name: 'Truck 002', type: 'truck', parentId: '1', code: 'T-002' },
      ]

      const tree = buildLocationTree(locations)
      expect(tree).toHaveLength(1)
      expect(tree[0].children).toHaveLength(2)
      expect(tree[0].children[0].type).toBe('truck')
      expect(tree[0].children[1].type).toBe('truck')
    })

    it('should handle empty locations', () => {
      const tree = buildLocationTree([])
      expect(tree).toHaveLength(0)
    })
  })

  describe('Location Path', () => {
    function getLocationPath(
      locationId: string,
      locations: { id: string; name: string; parentId: string | null }[],
    ): string[] {
      const locationMap = new Map(locations.map((l) => [l.id, l]))
      const path: string[] = []

      let currentId: string | null = locationId
      while (currentId !== null) {
        const location = locationMap.get(currentId)
        if (!location) break
        path.unshift(location.name)
        currentId = location.parentId
      }

      return path
    }

    function getLocationPathString(
      locationId: string,
      locations: { id: string; name: string; parentId: string | null }[],
      separator = ' > ',
    ): string {
      return getLocationPath(locationId, locations).join(separator)
    }

    it('should return path for root location', () => {
      const locations = [{ id: '1', name: 'Warehouse A', parentId: null }]

      const path = getLocationPath('1', locations)
      expect(path).toEqual(['Warehouse A'])
    })

    it('should return full path for nested location', () => {
      const locations = [
        { id: '1', name: 'Warehouse A', parentId: null },
        { id: '2', name: 'Aisle 1', parentId: '1' },
        { id: '3', name: 'Shelf A-01', parentId: '2' },
      ]

      const path = getLocationPath('3', locations)
      expect(path).toEqual(['Warehouse A', 'Aisle 1', 'Shelf A-01'])
    })

    it('should return formatted path string', () => {
      const locations = [
        { id: '1', name: 'Warehouse', parentId: null },
        { id: '2', name: 'Aisle 1', parentId: '1' },
        { id: '3', name: 'Bin 5', parentId: '2' },
      ]

      const pathString = getLocationPathString('3', locations)
      expect(pathString).toBe('Warehouse > Aisle 1 > Bin 5')
    })

    it('should return empty path for non-existent location', () => {
      const locations = [{ id: '1', name: 'Warehouse', parentId: null }]

      const path = getLocationPath('non-existent', locations)
      expect(path).toEqual([])
    })
  })

  describe('Cycle Prevention', () => {
    function wouldCreateCycle(
      locationId: string,
      newParentId: string,
      locations: { id: string; parentId: string | null }[],
    ): boolean {
      // Cannot be parent of itself
      if (locationId === newParentId) {
        return true
      }

      // Check if newParentId is a descendant of locationId
      const locationMap = new Map(locations.map((l) => [l.id, l.parentId]))

      let currentId: string | null = newParentId
      while (currentId !== null) {
        if (currentId === locationId) {
          return true
        }
        currentId = locationMap.get(currentId) ?? null
      }

      return false
    }

    it('should detect self-reference cycle', () => {
      const locations = [{ id: '1', parentId: null }]

      expect(wouldCreateCycle('1', '1', locations)).toBe(true)
    })

    it('should detect simple parent-child cycle', () => {
      const locations = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]

      // Trying to make '1' a child of '2' would create a cycle
      expect(wouldCreateCycle('1', '2', locations)).toBe(true)
    })

    it('should detect deep cycle', () => {
      const locations = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: '2' },
        { id: '4', parentId: '3' },
      ]

      // Trying to make '1' a child of '4' would create a cycle
      expect(wouldCreateCycle('1', '4', locations)).toBe(true)
    })

    it('should allow valid parent change', () => {
      const locations = [
        { id: '1', parentId: null },
        { id: '2', parentId: null },
        { id: '3', parentId: '1' },
      ]

      // Moving '3' from under '1' to under '2' is valid
      expect(wouldCreateCycle('3', '2', locations)).toBe(false)
    })
  })
})

describe('Location Business Rules', () => {
  describe('Code Uniqueness', () => {
    function isCodeUnique(
      code: string,
      organisationId: string,
      existingLocations: { code: string | null; organisationId: string }[],
      _excludeId?: string,
    ): boolean {
      return !existingLocations.some(
        (loc) =>
          loc.code !== null &&
          loc.code.toUpperCase() === code.toUpperCase() &&
          loc.organisationId === organisationId,
      )
    }

    it('should detect duplicate code within organisation', () => {
      const existing = [{ code: 'WH-A', organisationId: 'org-1' }]

      expect(isCodeUnique('WH-A', 'org-1', existing)).toBe(false)
      expect(isCodeUnique('wh-a', 'org-1', existing)).toBe(false) // Case insensitive
    })

    it('should allow same code in different organisations', () => {
      const existing = [{ code: 'WH-A', organisationId: 'org-1' }]

      expect(isCodeUnique('WH-A', 'org-2', existing)).toBe(true)
    })

    it('should allow unique code', () => {
      const existing = [{ code: 'WH-A', organisationId: 'org-1' }]

      expect(isCodeUnique('WH-B', 'org-1', existing)).toBe(true)
    })

    it('should allow null codes', () => {
      const existing = [{ code: null, organisationId: 'org-1' }]

      expect(isCodeUnique('WH-A', 'org-1', existing)).toBe(true)
    })
  })

  describe('Location Deactivation', () => {
    function canDeactivateLocation(
      locationId: string,
      locations: { id: string; parentId: string | null; isActive: boolean }[],
      partsAtLocation: number,
    ): { canDeactivate: boolean; reason?: string } {
      // Check if location has active children
      const hasActiveChildren = locations.some((l) => l.parentId === locationId && l.isActive)

      if (hasActiveChildren) {
        return {
          canDeactivate: false,
          reason: 'Location has active sub-locations',
        }
      }

      // Check if location has parts stored
      if (partsAtLocation > 0) {
        return {
          canDeactivate: false,
          reason: `Location has ${partsAtLocation} parts stored`,
        }
      }

      return { canDeactivate: true }
    }

    it('should allow deactivating empty leaf location', () => {
      const locations = [
        { id: '1', parentId: null, isActive: true },
        { id: '2', parentId: '1', isActive: true },
      ]

      const result = canDeactivateLocation('2', locations, 0)
      expect(result.canDeactivate).toBe(true)
    })

    it('should prevent deactivating location with active children', () => {
      const locations = [
        { id: '1', parentId: null, isActive: true },
        { id: '2', parentId: '1', isActive: true },
      ]

      const result = canDeactivateLocation('1', locations, 0)
      expect(result.canDeactivate).toBe(false)
      expect(result.reason).toBe('Location has active sub-locations')
    })

    it('should allow deactivating location with inactive children', () => {
      const locations = [
        { id: '1', parentId: null, isActive: true },
        { id: '2', parentId: '1', isActive: false },
      ]

      const result = canDeactivateLocation('1', locations, 0)
      expect(result.canDeactivate).toBe(true)
    })

    it('should prevent deactivating location with parts', () => {
      const locations = [{ id: '1', parentId: null, isActive: true }]

      const result = canDeactivateLocation('1', locations, 10)
      expect(result.canDeactivate).toBe(false)
      expect(result.reason).toBe('Location has 10 parts stored')
    })
  })

  describe('Location Type Hierarchy', () => {
    function isValidLocationTypeHierarchy(childType: string, parentType: string | null): boolean {
      // Define valid parent-child type relationships
      const validParents: Record<string, string[]> = {
        warehouse: ['building', null as any], // Warehouse can be under building or root
        building: [null as any], // Building is always root
        room: ['building', 'warehouse'],
        shelf: ['warehouse', 'room', 'building'],
        bin: ['shelf', 'warehouse', 'room'],
        truck: ['other', null as any], // Trucks under fleet grouping or root
        other: [null as any, 'other'], // Other can be anywhere
      }

      if (parentType === null) {
        return true // Any type can be a root
      }

      const allowedParents = validParents[childType] || []
      return allowedParents.includes(parentType)
    }

    it('should allow warehouse under building', () => {
      expect(isValidLocationTypeHierarchy('warehouse', 'building')).toBe(true)
    })

    it('should allow warehouse at root', () => {
      expect(isValidLocationTypeHierarchy('warehouse', null)).toBe(true)
    })

    it('should allow shelf under warehouse', () => {
      expect(isValidLocationTypeHierarchy('shelf', 'warehouse')).toBe(true)
    })

    it('should allow bin under shelf', () => {
      expect(isValidLocationTypeHierarchy('bin', 'shelf')).toBe(true)
    })

    it('should allow truck at root', () => {
      expect(isValidLocationTypeHierarchy('truck', null)).toBe(true)
    })

    it('should allow any type at root', () => {
      const types = ['warehouse', 'bin', 'shelf', 'truck', 'building', 'room', 'other']
      for (const type of types) {
        expect(isValidLocationTypeHierarchy(type, null)).toBe(true)
      }
    })
  })

  describe('Part Location Queries', () => {
    function getPartsInLocationAndChildren(
      locationId: string,
      locations: { id: string; parentId: string | null }[],
      partQuantities: { locationId: string; partId: string; quantity: number }[],
    ): { partId: string; locationId: string; quantity: number }[] {
      // Get all descendant location IDs
      const descendantIds: Set<string> = new Set([locationId])

      let changed = true
      while (changed) {
        changed = false
        for (const loc of locations) {
          if (
            loc.parentId !== null &&
            descendantIds.has(loc.parentId) &&
            !descendantIds.has(loc.id)
          ) {
            descendantIds.add(loc.id)
            changed = true
          }
        }
      }

      // Filter part quantities to include only those in descendant locations
      return partQuantities.filter((pq) => descendantIds.has(pq.locationId))
    }

    it('should get parts in single location', () => {
      const locations = [{ id: '1', parentId: null }]
      const partQuantities = [
        { locationId: '1', partId: 'p1', quantity: 10 },
        { locationId: '1', partId: 'p2', quantity: 5 },
      ]

      const result = getPartsInLocationAndChildren('1', locations, partQuantities)
      expect(result).toHaveLength(2)
    })

    it('should get parts in location and children', () => {
      const locations = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: '1' },
      ]
      const partQuantities = [
        { locationId: '1', partId: 'p1', quantity: 10 },
        { locationId: '2', partId: 'p2', quantity: 5 },
        { locationId: '3', partId: 'p3', quantity: 3 },
      ]

      const result = getPartsInLocationAndChildren('1', locations, partQuantities)
      expect(result).toHaveLength(3)
    })

    it('should not include parts from sibling locations', () => {
      const locations = [
        { id: '1', parentId: null },
        { id: '2', parentId: null },
      ]
      const partQuantities = [
        { locationId: '1', partId: 'p1', quantity: 10 },
        { locationId: '2', partId: 'p2', quantity: 5 },
      ]

      const result = getPartsInLocationAndChildren('1', locations, partQuantities)
      expect(result).toHaveLength(1)
      expect(result[0].partId).toBe('p1')
    })
  })
})
