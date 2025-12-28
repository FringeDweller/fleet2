import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Technician Workload Tests
 * Tests for technician workload tracking and assignment logic
 */

// Technician schema
const technicianSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  phone: z.string().nullable(),
})

// Workload schema
const workloadSchema = z.object({
  open: z.number().int().nonnegative(),
  in_progress: z.number().int().nonnegative(),
  pending_parts: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

// Technician with workload schema
const technicianWithWorkloadSchema = technicianSchema.extend({
  workload: workloadSchema,
})

describe('Technician Schema Validation', () => {
  it('should validate a valid technician', () => {
    const technician = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
      phone: '+1-555-123-4567',
    }

    const result = technicianSchema.safeParse(technician)
    expect(result.success).toBe(true)
  })

  it('should validate technician with null optional fields', () => {
    const technician = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      avatarUrl: null,
      phone: null,
    }

    const result = technicianSchema.safeParse(technician)
    expect(result.success).toBe(true)
  })

  it('should reject technician with invalid email', () => {
    const technician = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      firstName: 'Test',
      lastName: 'User',
      email: 'invalid-email',
      avatarUrl: null,
      phone: null,
    }

    const result = technicianSchema.safeParse(technician)
    expect(result.success).toBe(false)
  })

  it('should reject technician with invalid avatar URL', () => {
    const technician = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      avatarUrl: 'not-a-url',
      phone: null,
    }

    const result = technicianSchema.safeParse(technician)
    expect(result.success).toBe(false)
  })
})

describe('Workload Schema Validation', () => {
  it('should validate a valid workload', () => {
    const workload = {
      open: 3,
      in_progress: 2,
      pending_parts: 1,
      overdue: 0,
      total: 6,
    }

    const result = workloadSchema.safeParse(workload)
    expect(result.success).toBe(true)
  })

  it('should validate zero workload', () => {
    const workload = {
      open: 0,
      in_progress: 0,
      pending_parts: 0,
      overdue: 0,
      total: 0,
    }

    const result = workloadSchema.safeParse(workload)
    expect(result.success).toBe(true)
  })

  it('should validate high workload', () => {
    const workload = {
      open: 10,
      in_progress: 5,
      pending_parts: 3,
      overdue: 2,
      total: 18,
    }

    const result = workloadSchema.safeParse(workload)
    expect(result.success).toBe(true)
  })

  it('should reject negative workload values', () => {
    const workload = {
      open: -1,
      in_progress: 2,
      pending_parts: 1,
      overdue: 0,
      total: 2,
    }

    const result = workloadSchema.safeParse(workload)
    expect(result.success).toBe(false)
  })

  it('should reject non-integer workload values', () => {
    const workload = {
      open: 1.5,
      in_progress: 2,
      pending_parts: 1,
      overdue: 0,
      total: 4,
    }

    const result = workloadSchema.safeParse(workload)
    expect(result.success).toBe(false)
  })
})

describe('Technician Workload Calculations', () => {
  interface WorkloadCounts {
    open: number
    in_progress: number
    pending_parts: number
    overdue: number
  }

  function calculateTotalWorkload(counts: WorkloadCounts): number {
    return counts.open + counts.in_progress + counts.pending_parts
  }

  function calculateWorkloadScore(counts: WorkloadCounts): number {
    // Weight different statuses differently for workload balancing
    // in_progress has higher weight as technician is actively working
    return (
      counts.open * 1 + counts.in_progress * 2 + counts.pending_parts * 0.5 + counts.overdue * 1.5
    )
  }

  function isOverloaded(counts: WorkloadCounts, maxActiveWorkOrders: number = 10): boolean {
    return calculateTotalWorkload(counts) >= maxActiveWorkOrders
  }

  function getWorkloadLevel(counts: WorkloadCounts): 'light' | 'moderate' | 'heavy' | 'overloaded' {
    const total = calculateTotalWorkload(counts)
    if (total <= 3) return 'light'
    if (total <= 6) return 'moderate'
    if (total <= 9) return 'heavy'
    return 'overloaded'
  }

  describe('Total Workload', () => {
    it('should calculate total active work orders', () => {
      const counts = { open: 3, in_progress: 2, pending_parts: 1, overdue: 0 }
      expect(calculateTotalWorkload(counts)).toBe(6)
    })

    it('should return 0 for empty workload', () => {
      const counts = { open: 0, in_progress: 0, pending_parts: 0, overdue: 0 }
      expect(calculateTotalWorkload(counts)).toBe(0)
    })

    it('should not count overdue separately (they are included in other categories)', () => {
      // Overdue is a flag on work orders that are also open/in_progress
      const counts = { open: 3, in_progress: 2, pending_parts: 1, overdue: 2 }
      expect(calculateTotalWorkload(counts)).toBe(6)
    })
  })

  describe('Workload Score', () => {
    it('should calculate weighted score for workload balancing', () => {
      const counts = { open: 2, in_progress: 3, pending_parts: 2, overdue: 1 }
      // 2*1 + 3*2 + 2*0.5 + 1*1.5 = 2 + 6 + 1 + 1.5 = 10.5
      expect(calculateWorkloadScore(counts)).toBeCloseTo(10.5, 2)
    })

    it('should weight in_progress higher than open', () => {
      const openOnly = { open: 5, in_progress: 0, pending_parts: 0, overdue: 0 }
      const inProgressOnly = { open: 0, in_progress: 5, pending_parts: 0, overdue: 0 }

      expect(calculateWorkloadScore(inProgressOnly)).toBeGreaterThan(
        calculateWorkloadScore(openOnly),
      )
    })

    it('should weight pending_parts lower (technician is waiting)', () => {
      const pendingParts = { open: 0, in_progress: 0, pending_parts: 4, overdue: 0 }
      const open = { open: 4, in_progress: 0, pending_parts: 0, overdue: 0 }

      expect(calculateWorkloadScore(pendingParts)).toBeLessThan(calculateWorkloadScore(open))
    })

    it('should add penalty for overdue work orders', () => {
      const noOverdue = { open: 2, in_progress: 2, pending_parts: 0, overdue: 0 }
      const withOverdue = { open: 2, in_progress: 2, pending_parts: 0, overdue: 2 }

      expect(calculateWorkloadScore(withOverdue)).toBeGreaterThan(calculateWorkloadScore(noOverdue))
    })
  })

  describe('Overload Detection', () => {
    it('should detect overloaded technician', () => {
      const counts = { open: 5, in_progress: 4, pending_parts: 2, overdue: 1 }
      expect(isOverloaded(counts, 10)).toBe(true)
    })

    it('should not flag as overloaded when under limit', () => {
      const counts = { open: 3, in_progress: 2, pending_parts: 1, overdue: 0 }
      expect(isOverloaded(counts, 10)).toBe(false)
    })

    it('should flag as overloaded at exactly the limit', () => {
      const counts = { open: 4, in_progress: 4, pending_parts: 2, overdue: 0 }
      expect(isOverloaded(counts, 10)).toBe(true)
    })

    it('should respect custom max work orders limit', () => {
      const counts = { open: 3, in_progress: 2, pending_parts: 1, overdue: 0 }
      expect(isOverloaded(counts, 5)).toBe(true)
      expect(isOverloaded(counts, 10)).toBe(false)
    })
  })

  describe('Workload Levels', () => {
    it('should return light for 0-3 work orders', () => {
      expect(getWorkloadLevel({ open: 1, in_progress: 1, pending_parts: 1, overdue: 0 })).toBe(
        'light',
      )
      expect(getWorkloadLevel({ open: 0, in_progress: 0, pending_parts: 0, overdue: 0 })).toBe(
        'light',
      )
    })

    it('should return moderate for 4-6 work orders', () => {
      expect(getWorkloadLevel({ open: 2, in_progress: 2, pending_parts: 2, overdue: 0 })).toBe(
        'moderate',
      )
      expect(getWorkloadLevel({ open: 2, in_progress: 1, pending_parts: 1, overdue: 0 })).toBe(
        'moderate',
      )
    })

    it('should return heavy for 7-9 work orders', () => {
      expect(getWorkloadLevel({ open: 3, in_progress: 3, pending_parts: 3, overdue: 0 })).toBe(
        'heavy',
      )
      expect(getWorkloadLevel({ open: 4, in_progress: 2, pending_parts: 1, overdue: 0 })).toBe(
        'heavy',
      )
    })

    it('should return overloaded for 10+ work orders', () => {
      expect(getWorkloadLevel({ open: 5, in_progress: 3, pending_parts: 2, overdue: 0 })).toBe(
        'overloaded',
      )
      expect(getWorkloadLevel({ open: 10, in_progress: 5, pending_parts: 0, overdue: 0 })).toBe(
        'overloaded',
      )
    })
  })
})

describe('Technician Assignment Logic', () => {
  interface Technician {
    id: string
    name: string
    workload: {
      open: number
      in_progress: number
      pending_parts: number
      overdue: number
      total: number
    }
  }

  function findLeastLoadedTechnician(technicians: Technician[]): Technician | null {
    if (technicians.length === 0) return null

    return technicians.reduce((least, tech) => {
      return tech.workload.total < least.workload.total ? tech : least
    })
  }

  function findAvailableTechnicians(
    technicians: Technician[],
    maxWorkload: number = 10,
  ): Technician[] {
    return technicians.filter((tech) => tech.workload.total < maxWorkload)
  }

  function sortTechniciansByWorkload(technicians: Technician[]): Technician[] {
    return [...technicians].sort((a, b) => a.workload.total - b.workload.total)
  }

  const sampleTechnicians: Technician[] = [
    {
      id: 'tech-1',
      name: 'Alice',
      workload: { open: 2, in_progress: 1, pending_parts: 0, overdue: 0, total: 3 },
    },
    {
      id: 'tech-2',
      name: 'Bob',
      workload: { open: 3, in_progress: 2, pending_parts: 1, overdue: 1, total: 6 },
    },
    {
      id: 'tech-3',
      name: 'Charlie',
      workload: { open: 1, in_progress: 0, pending_parts: 0, overdue: 0, total: 1 },
    },
    {
      id: 'tech-4',
      name: 'Diana',
      workload: { open: 5, in_progress: 4, pending_parts: 2, overdue: 2, total: 11 },
    },
  ]

  describe('Finding Least Loaded Technician', () => {
    it('should find technician with lowest workload', () => {
      const result = findLeastLoadedTechnician(sampleTechnicians)
      expect(result?.id).toBe('tech-3')
      expect(result?.name).toBe('Charlie')
    })

    it('should return null for empty list', () => {
      expect(findLeastLoadedTechnician([])).toBeNull()
    })

    it('should return first technician if all have same workload', () => {
      const equalLoad: Technician[] = [
        {
          id: '1',
          name: 'A',
          workload: { open: 1, in_progress: 1, pending_parts: 0, overdue: 0, total: 2 },
        },
        {
          id: '2',
          name: 'B',
          workload: { open: 1, in_progress: 1, pending_parts: 0, overdue: 0, total: 2 },
        },
      ]
      const result = findLeastLoadedTechnician(equalLoad)
      expect(result?.id).toBe('1')
    })
  })

  describe('Finding Available Technicians', () => {
    it('should filter out overloaded technicians', () => {
      const available = findAvailableTechnicians(sampleTechnicians, 10)
      expect(available).toHaveLength(3)
      expect(available.every((t) => t.workload.total < 10)).toBe(true)
    })

    it('should return all technicians if none overloaded', () => {
      const lightLoad: Technician[] = [
        {
          id: '1',
          name: 'A',
          workload: { open: 1, in_progress: 0, pending_parts: 0, overdue: 0, total: 1 },
        },
        {
          id: '2',
          name: 'B',
          workload: { open: 2, in_progress: 1, pending_parts: 0, overdue: 0, total: 3 },
        },
      ]
      expect(findAvailableTechnicians(lightLoad)).toHaveLength(2)
    })

    it('should return empty array if all overloaded', () => {
      const heavyLoad: Technician[] = [
        {
          id: '1',
          name: 'A',
          workload: { open: 5, in_progress: 5, pending_parts: 2, overdue: 0, total: 12 },
        },
        {
          id: '2',
          name: 'B',
          workload: { open: 6, in_progress: 4, pending_parts: 1, overdue: 0, total: 11 },
        },
      ]
      expect(findAvailableTechnicians(heavyLoad, 10)).toHaveLength(0)
    })

    it('should respect custom max workload', () => {
      const available = findAvailableTechnicians(sampleTechnicians, 5)
      expect(available).toHaveLength(2) // Only tech-1 (3) and tech-3 (1)
    })
  })

  describe('Sorting Technicians by Workload', () => {
    it('should sort technicians by workload ascending', () => {
      const sorted = sortTechniciansByWorkload(sampleTechnicians)
      expect(sorted[0].name).toBe('Charlie') // 1
      expect(sorted[1].name).toBe('Alice') // 3
      expect(sorted[2].name).toBe('Bob') // 6
      expect(sorted[3].name).toBe('Diana') // 11
    })

    it('should not modify original array', () => {
      const original = [...sampleTechnicians]
      sortTechniciansByWorkload(sampleTechnicians)
      expect(sampleTechnicians).toEqual(original)
    })
  })
})

describe('Workload Distribution Analysis', () => {
  interface TechnicianWorkload {
    id: string
    total: number
  }

  function calculateAverageWorkload(technicians: TechnicianWorkload[]): number {
    if (technicians.length === 0) return 0
    const sum = technicians.reduce((total, tech) => total + tech.total, 0)
    return sum / technicians.length
  }

  function calculateWorkloadStandardDeviation(technicians: TechnicianWorkload[]): number {
    if (technicians.length === 0) return 0
    const avg = calculateAverageWorkload(technicians)
    const squaredDiffs = technicians.map((tech) => (tech.total - avg) ** 2)
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / technicians.length
    return Math.sqrt(avgSquaredDiff)
  }

  function isWorkloadBalanced(technicians: TechnicianWorkload[], threshold: number = 2): boolean {
    return calculateWorkloadStandardDeviation(technicians) <= threshold
  }

  describe('Average Workload', () => {
    it('should calculate average workload correctly', () => {
      const technicians = [
        { id: '1', total: 4 },
        { id: '2', total: 6 },
        { id: '3', total: 2 },
      ]
      expect(calculateAverageWorkload(technicians)).toBe(4)
    })

    it('should return 0 for empty list', () => {
      expect(calculateAverageWorkload([])).toBe(0)
    })

    it('should handle single technician', () => {
      expect(calculateAverageWorkload([{ id: '1', total: 5 }])).toBe(5)
    })
  })

  describe('Workload Standard Deviation', () => {
    it('should calculate standard deviation for varied workloads', () => {
      const technicians = [
        { id: '1', total: 2 },
        { id: '2', total: 4 },
        { id: '3', total: 6 },
        { id: '4', total: 8 },
      ]
      // Mean = 5, variance = ((2-5)^2 + (4-5)^2 + (6-5)^2 + (8-5)^2) / 4 = (9+1+1+9)/4 = 5
      // SD = sqrt(5) ~ 2.236
      expect(calculateWorkloadStandardDeviation(technicians)).toBeCloseTo(2.236, 2)
    })

    it('should return 0 for identical workloads', () => {
      const technicians = [
        { id: '1', total: 5 },
        { id: '2', total: 5 },
        { id: '3', total: 5 },
      ]
      expect(calculateWorkloadStandardDeviation(technicians)).toBe(0)
    })

    it('should return 0 for empty list', () => {
      expect(calculateWorkloadStandardDeviation([])).toBe(0)
    })
  })

  describe('Workload Balance Check', () => {
    it('should detect balanced workload', () => {
      const balanced = [
        { id: '1', total: 4 },
        { id: '2', total: 5 },
        { id: '3', total: 5 },
        { id: '4', total: 6 },
      ]
      expect(isWorkloadBalanced(balanced)).toBe(true)
    })

    it('should detect unbalanced workload', () => {
      const unbalanced = [
        { id: '1', total: 1 },
        { id: '2', total: 2 },
        { id: '3', total: 10 },
        { id: '4', total: 15 },
      ]
      expect(isWorkloadBalanced(unbalanced)).toBe(false)
    })

    it('should respect custom threshold', () => {
      const technicians = [
        { id: '1', total: 2 },
        { id: '2', total: 8 },
      ]
      // SD = 3
      expect(isWorkloadBalanced(technicians, 2)).toBe(false)
      expect(isWorkloadBalanced(technicians, 4)).toBe(true)
    })
  })
})

describe('Overdue Work Order Tracking', () => {
  interface WorkOrder {
    id: string
    assignedToId: string
    dueDate: Date
    status: 'open' | 'in_progress' | 'pending_parts'
  }

  function countOverdueByTechnician(
    workOrders: WorkOrder[],
    currentDate: Date = new Date(),
  ): Map<string, number> {
    const counts = new Map<string, number>()

    for (const wo of workOrders) {
      if (wo.dueDate < currentDate) {
        const current = counts.get(wo.assignedToId) || 0
        counts.set(wo.assignedToId, current + 1)
      }
    }

    return counts
  }

  function getMostOverdueTechnician(
    workOrders: WorkOrder[],
    currentDate: Date = new Date(),
  ): { technicianId: string; count: number } | null {
    const counts = countOverdueByTechnician(workOrders, currentDate)
    if (counts.size === 0) return null

    let maxId = ''
    let maxCount = 0

    for (const [id, count] of counts) {
      if (count > maxCount) {
        maxId = id
        maxCount = count
      }
    }

    return { technicianId: maxId, count: maxCount }
  }

  const now = new Date('2024-12-15T12:00:00Z')
  const sampleWorkOrders: WorkOrder[] = [
    { id: 'wo-1', assignedToId: 'tech-1', dueDate: new Date('2024-12-10'), status: 'open' },
    { id: 'wo-2', assignedToId: 'tech-1', dueDate: new Date('2024-12-12'), status: 'in_progress' },
    { id: 'wo-3', assignedToId: 'tech-2', dueDate: new Date('2024-12-08'), status: 'open' },
    { id: 'wo-4', assignedToId: 'tech-1', dueDate: new Date('2024-12-20'), status: 'open' }, // Not overdue
    { id: 'wo-5', assignedToId: 'tech-3', dueDate: new Date('2024-12-18'), status: 'in_progress' }, // Not overdue
  ]

  it('should count overdue work orders by technician', () => {
    const counts = countOverdueByTechnician(sampleWorkOrders, now)
    expect(counts.get('tech-1')).toBe(2)
    expect(counts.get('tech-2')).toBe(1)
    expect(counts.get('tech-3')).toBeUndefined()
  })

  it('should find technician with most overdue work orders', () => {
    const result = getMostOverdueTechnician(sampleWorkOrders, now)
    expect(result?.technicianId).toBe('tech-1')
    expect(result?.count).toBe(2)
  })

  it('should return null when no overdue work orders', () => {
    const futureDate = new Date('2024-12-01T12:00:00Z')
    const result = getMostOverdueTechnician(sampleWorkOrders, futureDate)
    expect(result).toBeNull()
  })
})
