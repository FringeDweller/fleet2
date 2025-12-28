import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Document schema based on server/api/assets/[id]/documents/index.post.ts
const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  filePath: z.string().min(1).max(500),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  description: z.string().max(1000).optional().nullable(),
  documentType: z
    .enum([
      'registration',
      'insurance',
      'inspection',
      'certification',
      'manual',
      'warranty',
      'other',
    ])
    .default('other'),
  expiryDate: z.string().datetime().optional().nullable(),
})

const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  documentType: z
    .enum([
      'registration',
      'insurance',
      'inspection',
      'certification',
      'manual',
      'warranty',
      'other',
    ])
    .optional(),
  expiryDate: z.string().datetime().optional().nullable(),
})

describe('Asset Document Schema Validation', () => {
  describe('Create Document', () => {
    it('should validate a complete document', () => {
      const validDocument = {
        name: 'Vehicle Registration 2024',
        filePath: '/uploads/documents/reg-2024.pdf',
        fileType: 'application/pdf',
        fileSize: 1024000,
        description: 'Annual registration certificate for fleet vehicle',
        documentType: 'registration',
        expiryDate: '2024-12-31T23:59:59.000Z',
      }

      const result = createDocumentSchema.safeParse(validDocument)
      expect(result.success).toBe(true)
    })

    it('should require name field', () => {
      const invalidDocument = {
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const invalidDocument = {
        name: '',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should enforce name max length of 255', () => {
      const invalidDocument = {
        name: 'A'.repeat(256),
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should require filePath field', () => {
      const invalidDocument = {
        name: 'Test Document',
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should reject empty filePath', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '',
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should enforce filePath max length of 500', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: `/uploads/${'A'.repeat(500)}`,
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should require fileType field', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should reject empty fileType', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: '',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should enforce fileType max length of 100', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'A'.repeat(101),
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should require fileSize field', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should require positive fileSize', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 0,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should reject negative fileSize', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: -1000,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should require integer fileSize', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000.5,
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should default documentType to other', () => {
      const document = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
      }

      const result = createDocumentSchema.safeParse(document)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.documentType).toBe('other')
      }
    })

    it('should accept all valid documentType values', () => {
      const validTypes = [
        'registration',
        'insurance',
        'inspection',
        'certification',
        'manual',
        'warranty',
        'other',
      ]

      for (const docType of validTypes) {
        const document = {
          name: 'Test Document',
          filePath: '/uploads/test.pdf',
          fileType: 'application/pdf',
          fileSize: 1000,
          documentType: docType,
        }

        const result = createDocumentSchema.safeParse(document)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid documentType', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        documentType: 'contract',
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should validate valid expiryDate', () => {
      const document = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        expiryDate: '2025-06-15T00:00:00.000Z',
      }

      const result = createDocumentSchema.safeParse(document)
      expect(result.success).toBe(true)
    })

    it('should reject invalid expiryDate format', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        expiryDate: '2025-06-15', // Missing time component
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should allow null expiryDate', () => {
      const document = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        expiryDate: null,
      }

      const result = createDocumentSchema.safeParse(document)
      expect(result.success).toBe(true)
    })

    it('should enforce description max length of 1000', () => {
      const invalidDocument = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        description: 'A'.repeat(1001),
      }

      const result = createDocumentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
    })

    it('should allow null description', () => {
      const document = {
        name: 'Test Document',
        filePath: '/uploads/test.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        description: null,
      }

      const result = createDocumentSchema.safeParse(document)
      expect(result.success).toBe(true)
    })
  })

  describe('Update Document', () => {
    it('should validate partial update with just name', () => {
      const update = {
        name: 'Updated Document Name',
      }

      const result = updateDocumentSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate update with documentType change', () => {
      const update = {
        documentType: 'insurance',
      }

      const result = updateDocumentSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate update with new expiryDate', () => {
      const update = {
        expiryDate: '2026-01-01T00:00:00.000Z',
      }

      const result = updateDocumentSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow clearing expiryDate with null', () => {
      const update = {
        expiryDate: null,
      }

      const result = updateDocumentSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow empty update (no changes)', () => {
      const update = {}

      const result = updateDocumentSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })
})

describe('Document File Type Validation', () => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ]

  function isAllowedMimeType(mimeType: string): boolean {
    return allowedMimeTypes.includes(mimeType)
  }

  it('should allow PDF files', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true)
  })

  it('should allow JPEG images', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true)
  })

  it('should allow PNG images', () => {
    expect(isAllowedMimeType('image/png')).toBe(true)
  })

  it('should allow Word documents', () => {
    expect(isAllowedMimeType('application/msword')).toBe(true)
    expect(
      isAllowedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe(true)
  })

  it('should allow Excel spreadsheets', () => {
    expect(isAllowedMimeType('application/vnd.ms-excel')).toBe(true)
    expect(
      isAllowedMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true)
  })

  it('should allow plain text files', () => {
    expect(isAllowedMimeType('text/plain')).toBe(true)
    expect(isAllowedMimeType('text/csv')).toBe(true)
  })

  it('should reject executable files', () => {
    expect(isAllowedMimeType('application/x-executable')).toBe(false)
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false)
  })

  it('should reject script files', () => {
    expect(isAllowedMimeType('application/javascript')).toBe(false)
    expect(isAllowedMimeType('text/javascript')).toBe(false)
  })

  it('should reject HTML files', () => {
    expect(isAllowedMimeType('text/html')).toBe(false)
  })
})

describe('Document File Size Validation', () => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB in bytes

  function isValidFileSize(size: number): boolean {
    return size > 0 && size <= MAX_FILE_SIZE
  }

  it('should accept files within size limit', () => {
    expect(isValidFileSize(1000)).toBe(true)
    expect(isValidFileSize(1024 * 1024)).toBe(true) // 1MB
    expect(isValidFileSize(10 * 1024 * 1024)).toBe(true) // 10MB
    expect(isValidFileSize(50 * 1024 * 1024)).toBe(true) // 50MB (exactly at limit)
  })

  it('should reject files exceeding size limit', () => {
    expect(isValidFileSize(50 * 1024 * 1024 + 1)).toBe(false) // Just over 50MB
    expect(isValidFileSize(100 * 1024 * 1024)).toBe(false) // 100MB
  })

  it('should reject zero size files', () => {
    expect(isValidFileSize(0)).toBe(false)
  })

  it('should reject negative size', () => {
    expect(isValidFileSize(-1000)).toBe(false)
  })
})

describe('Document URL/Path Validation', () => {
  const documentUrlSchema = z.union([
    z
      .string()
      .url(), // Full URL
    z
      .string()
      .regex(/^\/uploads\/[a-zA-Z0-9_\-/]+\.[a-zA-Z0-9]+$/), // Local path
  ])

  it('should validate full HTTPS URLs', () => {
    const result = documentUrlSchema.safeParse('https://storage.example.com/documents/file.pdf')
    expect(result.success).toBe(true)
  })

  it('should validate full HTTP URLs', () => {
    const result = documentUrlSchema.safeParse('http://storage.example.com/documents/file.pdf')
    expect(result.success).toBe(true)
  })

  it('should validate local upload paths', () => {
    const result = documentUrlSchema.safeParse('/uploads/documents/file.pdf')
    expect(result.success).toBe(true)
  })

  it('should validate nested local paths', () => {
    const result = documentUrlSchema.safeParse('/uploads/org-123/assets/abc/registration.pdf')
    expect(result.success).toBe(true)
  })

  it('should reject paths with traversal attempts', () => {
    // Paths with .. are not valid
    const result = documentUrlSchema.safeParse('/uploads/../etc/passwd')
    expect(result.success).toBe(false)
  })
})

describe('Document Expiry Date Validation', () => {
  function isExpired(expiryDate: string | null): boolean {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  function isExpiringSoon(expiryDate: string | null, daysThreshold = 30): boolean {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + daysThreshold)
    return expiry <= threshold && expiry >= new Date()
  }

  it('should not be expired for null expiry date', () => {
    expect(isExpired(null)).toBe(false)
  })

  it('should detect expired documents', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    expect(isExpired(pastDate.toISOString())).toBe(true)
  })

  it('should not be expired for future dates', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    expect(isExpired(futureDate.toISOString())).toBe(false)
  })

  it('should detect documents expiring within threshold', () => {
    const nearFuture = new Date()
    nearFuture.setDate(nearFuture.getDate() + 15)
    expect(isExpiringSoon(nearFuture.toISOString(), 30)).toBe(true)
  })

  it('should not flag documents expiring after threshold', () => {
    const distantFuture = new Date()
    distantFuture.setDate(distantFuture.getDate() + 60)
    expect(isExpiringSoon(distantFuture.toISOString(), 30)).toBe(false)
  })

  it('should not be expiring soon for null expiry date', () => {
    expect(isExpiringSoon(null)).toBe(false)
  })
})

describe('Document Metadata Validation', () => {
  const documentMetadataSchema = z.object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    name: z.string(),
    filePath: z.string(),
    fileType: z.string(),
    fileSize: z.number().int().positive(),
    description: z.string().nullable(),
    documentType: z.enum([
      'registration',
      'insurance',
      'inspection',
      'certification',
      'manual',
      'warranty',
      'other',
    ]),
    expiryDate: z.string().datetime().nullable(),
    uploadedById: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })

  it('should validate complete document metadata', () => {
    const metadata = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      assetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Insurance Certificate',
      filePath: '/uploads/documents/insurance.pdf',
      fileType: 'application/pdf',
      fileSize: 512000,
      description: 'Annual insurance certificate',
      documentType: 'insurance',
      expiryDate: '2025-12-31T23:59:59.000Z',
      uploadedById: '123e4567-e89b-12d3-a456-426614174002',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    }

    const result = documentMetadataSchema.safeParse(metadata)
    expect(result.success).toBe(true)
  })

  it('should validate metadata with null nullable fields', () => {
    const metadata = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      assetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Manual',
      filePath: '/uploads/documents/manual.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      description: null,
      documentType: 'manual',
      expiryDate: null,
      uploadedById: '123e4567-e89b-12d3-a456-426614174002',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    }

    const result = documentMetadataSchema.safeParse(metadata)
    expect(result.success).toBe(true)
  })

  it('should require valid UUID for id', () => {
    const metadata = {
      id: 'not-a-uuid',
      assetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test',
      filePath: '/test.pdf',
      fileType: 'application/pdf',
      fileSize: 1000,
      description: null,
      documentType: 'other',
      expiryDate: null,
      uploadedById: '123e4567-e89b-12d3-a456-426614174002',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    }

    const result = documentMetadataSchema.safeParse(metadata)
    expect(result.success).toBe(false)
  })

  it('should require valid UUID for assetId', () => {
    const metadata = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      assetId: 'invalid',
      name: 'Test',
      filePath: '/test.pdf',
      fileType: 'application/pdf',
      fileSize: 1000,
      description: null,
      documentType: 'other',
      expiryDate: null,
      uploadedById: '123e4567-e89b-12d3-a456-426614174002',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    }

    const result = documentMetadataSchema.safeParse(metadata)
    expect(result.success).toBe(false)
  })

  it('should require valid UUID for uploadedById', () => {
    const metadata = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      assetId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test',
      filePath: '/test.pdf',
      fileType: 'application/pdf',
      fileSize: 1000,
      description: null,
      documentType: 'other',
      expiryDate: null,
      uploadedById: 'bad-uuid',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    }

    const result = documentMetadataSchema.safeParse(metadata)
    expect(result.success).toBe(false)
  })
})

describe('Document List Filter Validation', () => {
  const documentFilterSchema = z.object({
    documentType: z
      .enum([
        'registration',
        'insurance',
        'inspection',
        'certification',
        'manual',
        'warranty',
        'other',
      ])
      .optional(),
    expiredOnly: z.boolean().optional().default(false),
    expiringSoon: z.boolean().optional().default(false),
    expiringSoonDays: z.number().int().positive().max(365).optional().default(30),
    search: z.string().optional(),
    sortBy: z
      .enum(['name', 'documentType', 'expiryDate', 'fileSize', 'createdAt'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
  })

  it('should validate empty filters with defaults', () => {
    const result = documentFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.expiredOnly).toBe(false)
      expect(result.data.expiringSoon).toBe(false)
      expect(result.data.expiringSoonDays).toBe(30)
      expect(result.data.sortBy).toBe('createdAt')
      expect(result.data.sortOrder).toBe('desc')
      expect(result.data.limit).toBe(50)
      expect(result.data.offset).toBe(0)
    }
  })

  it('should validate documentType filter', () => {
    const filters = { documentType: 'insurance' }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should validate expiring soon filter', () => {
    const filters = { expiringSoon: true, expiringSoonDays: 60 }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should enforce max expiringSoonDays of 365', () => {
    const filters = { expiringSoonDays: 400 }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should validate search filter', () => {
    const filters = { search: 'registration' }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should validate sort options', () => {
    const filters = { sortBy: 'expiryDate', sortOrder: 'asc' }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should reject invalid sortBy field', () => {
    const filters = { sortBy: 'invalidField' }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('should validate pagination', () => {
    const filters = { limit: 25, offset: 50 }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('should enforce max limit of 100', () => {
    const filters = { limit: 150 }
    const result = documentFilterSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })
})
