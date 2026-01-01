/**
 * Document Upload API Endpoint
 * Accepts multipart file upload, stores file, and creates document record
 * Supports linking to entity (entityType, entityId)
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

// Configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'data/uploads'
const DOCUMENTS_DIR = join(UPLOADS_DIR, 'documents')
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Allowed MIME types for documents
const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  // Microsoft Office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // OpenDocument formats
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // Text
  'text/plain',
  'text/csv',
  // Rich text
  'application/rtf',
] as const

// Entity types that can have linked documents
const ENTITY_TYPES = ['asset', 'work_order', 'part', 'inspection', 'operator', 'defect'] as const

// Document categories matching the schema enum
const DOCUMENT_CATEGORIES = [
  'registration',
  'insurance',
  'inspection',
  'certification',
  'manual',
  'warranty',
  'invoice',
  'contract',
  'report',
  'other',
] as const

// Metadata schema for form fields
const metadataSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(DOCUMENT_CATEGORIES).default('other'),
  tags: z
    .string()
    .transform((val) => {
      if (!val) return undefined
      try {
        return JSON.parse(val) as string[]
      } catch {
        return val.split(',').map((t: string) => t.trim())
      }
    })
    .optional(),
  expiryDate: z.string().datetime().optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
  // Entity linking
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.string().uuid().optional(),
})

/**
 * Validate that the entity exists and belongs to the organization
 */
async function validateEntity(
  entityType: (typeof ENTITY_TYPES)[number],
  entityId: string,
  organisationId: string,
): Promise<boolean> {
  switch (entityType) {
    case 'asset': {
      const asset = await db.query.assets.findFirst({
        where: (assets, { and, eq: eqOp }) =>
          and(eqOp(assets.id, entityId), eqOp(assets.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!asset
    }

    case 'work_order': {
      const workOrder = await db.query.workOrders.findFirst({
        where: (workOrders, { and, eq: eqOp }) =>
          and(eqOp(workOrders.id, entityId), eqOp(workOrders.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!workOrder
    }

    case 'part': {
      const part = await db.query.parts.findFirst({
        where: (parts, { and, eq: eqOp }) =>
          and(eqOp(parts.id, entityId), eqOp(parts.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!part
    }

    case 'inspection': {
      const inspection = await db.query.inspections.findFirst({
        where: (inspections, { and, eq: eqOp }) =>
          and(eqOp(inspections.id, entityId), eqOp(inspections.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!inspection
    }

    case 'operator': {
      const operator = await db.query.users.findFirst({
        where: (users, { and, eq: eqOp }) =>
          and(eqOp(users.id, entityId), eqOp(users.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!operator
    }

    case 'defect': {
      const defect = await db.query.defects.findFirst({
        where: (defects, { and, eq: eqOp }) =>
          and(eqOp(defects.id, entityId), eqOp(defects.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!defect
    }

    default:
      return false
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Parse multipart form data
  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    })
  }

  // Find the file in the form data
  const fileField = formData.find((field) => field.name === 'file')

  if (!fileField || !fileField.data || !fileField.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file provided in form data',
    })
  }

  // Extract metadata from other form fields
  const metadataFields: Record<string, string> = {}
  for (const field of formData) {
    if (field.name !== 'file' && field.name && field.data) {
      metadataFields[field.name] = field.data.toString('utf-8')
    }
  }

  // Validate metadata
  const metadataResult = metadataSchema.safeParse(metadataFields)
  if (!metadataResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid metadata',
      data: metadataResult.error.flatten(),
    })
  }

  const metadata = metadataResult.data
  const fileBuffer = fileField.data
  const originalFilename = fileField.filename
  const mimeType = fileField.type || 'application/octet-stream'

  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    })
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type',
      data: {
        message: `File type '${mimeType}' is not allowed`,
        allowedTypes: ALLOWED_MIME_TYPES,
      },
    })
  }

  // Validate folder if provided
  if (metadata.folderId) {
    const folder = await db.query.documentFolders.findFirst({
      where: (documentFolders, { and, eq: eqOp }) =>
        and(
          eqOp(documentFolders.id, metadata.folderId!),
          eqOp(documentFolders.organisationId, user.organisationId),
        ),
      columns: { id: true },
    })

    if (!folder) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found',
      })
    }
  }

  // Validate entity if linking
  if (metadata.entityType && metadata.entityId) {
    const entityValid = await validateEntity(
      metadata.entityType,
      metadata.entityId,
      user.organisationId,
    )
    if (!entityValid) {
      throw createError({
        statusCode: 404,
        statusMessage: `${metadata.entityType.replace('_', ' ')} not found`,
      })
    }
  } else if (metadata.entityType || metadata.entityId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Both entityType and entityId must be provided for linking',
    })
  }

  // Generate file path
  const fileExtension = extname(originalFilename) || ''
  const now = new Date()
  const dateFolder = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}`
  const uniqueFilename = `${randomUUID()}${fileExtension}`
  const relativePath = join(dateFolder, uniqueFilename)
  const absoluteDir = join(DOCUMENTS_DIR, dateFolder)
  const absolutePath = join(DOCUMENTS_DIR, relativePath)

  try {
    // Ensure directory exists
    await mkdir(absoluteDir, { recursive: true })

    // Write file to disk
    await writeFile(absolutePath, fileBuffer)

    // Calculate checksum
    const checksum = createHash('sha256').update(fileBuffer).digest('hex')

    // Document metadata
    const documentName = metadata.name || originalFilename
    const category = metadata.category || 'other'
    const tags = metadata.tags || null

    // Create document and version in a transaction
    const result = await db.transaction(async (tx) => {
      // Create the document
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          organisationId: user.organisationId,
          folderId: metadata.folderId || null,
          name: documentName,
          originalFilename,
          filePath: relativePath,
          mimeType,
          fileSize: fileBuffer.length,
          description: metadata.description || null,
          category,
          tags,
          expiryDate: metadata.expiryDate ? new Date(metadata.expiryDate) : null,
          uploadedById: user.id,
        })
        .returning()

      if (!doc) {
        throw new Error('Failed to create document')
      }

      // Create the first version
      const [version] = await tx
        .insert(schema.documentVersions)
        .values({
          documentId: doc.id,
          versionNumber: '1.0',
          filePath: relativePath,
          fileSize: fileBuffer.length,
          mimeType,
          changeNotes: 'Initial upload',
          uploadedById: user.id,
        })
        .returning()

      if (!version) {
        throw new Error('Failed to create document version')
      }

      // Update document with current version
      await tx
        .update(schema.documents)
        .set({
          currentVersionId: version.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.documents.id, doc.id))

      // Update search vector using raw SQL
      await tx.execute(sql`
        UPDATE documents
        SET search_vector =
          setweight(to_tsvector('english', coalesce(${documentName}, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(${metadata.description || ''}, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(array_to_string(${tags || []}, ' '), '')), 'C')
        WHERE id = ${doc.id}
      `)

      // Create document link if entity provided
      let documentLink = null
      if (metadata.entityType && metadata.entityId) {
        const [link] = await tx
          .insert(schema.documentLinks)
          .values({
            documentId: doc.id,
            entityType: metadata.entityType,
            entityId: metadata.entityId,
            linkedById: user.id,
          })
          .returning()
        documentLink = link
      }

      return { document: doc, version, documentLink }
    })

    // Log the upload
    await db.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'document.uploaded',
      entityType: 'document',
      entityId: result.document.id,
      newValues: {
        name: result.document.name,
        filename: result.document.originalFilename,
        mimeType: result.document.mimeType,
        fileSize: result.document.fileSize,
        category: result.document.category,
        versionId: result.version.id,
        linkedTo: metadata.entityType
          ? { entityType: metadata.entityType, entityId: metadata.entityId }
          : null,
      },
      ipAddress: getRequestIP(event),
      userAgent: getHeader(event, 'user-agent'),
    })

    // Construct download URL
    const baseUrl = process.env.UPLOADS_BASE_URL || '/uploads'
    const downloadUrl = `${baseUrl}/documents/${relativePath}`

    return {
      document: {
        id: result.document.id,
        name: result.document.name,
        originalFilename: result.document.originalFilename,
        mimeType: result.document.mimeType,
        fileSize: result.document.fileSize,
        description: result.document.description,
        category: result.document.category,
        tags: result.document.tags,
        folderId: result.document.folderId,
        expiryDate: result.document.expiryDate?.toISOString() || null,
        currentVersionId: result.version.id,
        downloadUrl,
        checksum,
        createdAt: result.document.createdAt.toISOString(),
        updatedAt: result.document.updatedAt.toISOString(),
      },
      version: {
        id: result.version.id,
        versionNumber: result.version.versionNumber,
        fileSize: result.version.fileSize,
        mimeType: result.version.mimeType,
        changeNotes: result.version.changeNotes,
        createdAt: result.version.createdAt.toISOString(),
      },
      link: result.documentLink
        ? {
            id: result.documentLink.id,
            entityType: result.documentLink.entityType,
            entityId: result.documentLink.entityId,
            linkedAt: result.documentLink.linkedAt.toISOString(),
          }
        : null,
    }
  } catch (error: unknown) {
    const err = error as { message?: string; statusCode?: number }

    // Re-throw HTTP errors as-is
    if (err.statusCode) {
      throw error
    }

    console.error('[documents/upload] Processing error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process document upload',
      data: { message: err.message },
    })
  }
})
