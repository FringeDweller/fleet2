import { z } from 'zod'
import { db, schema } from '../../../utils/db'
import { requireAuth } from '../../../utils/permissions'

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Default chunk size: 1MB
const DEFAULT_CHUNK_SIZE = 1024 * 1024

// Session expiry: 24 hours
const SESSION_EXPIRY_HOURS = 24

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
]

const startUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  totalSize: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, {
      message: `File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }),
  chunkSize: z.number().int().positive().default(DEFAULT_CHUNK_SIZE),
  // Optional metadata for creating the document after upload
  folderId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(255).optional(), // Display name (defaults to filename)
  description: z.string().max(1000).optional().nullable(),
  category: z
    .enum([
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
    ])
    .default('other'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  expiryDate: z.string().datetime().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = startUploadSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type',
      data: {
        message: `File type '${data.mimeType}' is not allowed`,
        allowedTypes: ALLOWED_MIME_TYPES,
      },
    })
  }

  // Validate folder exists if provided
  if (data.folderId) {
    const folder = await db.query.documentFolders.findFirst({
      where: (documentFolders, { and, eq }) =>
        and(
          eq(documentFolders.id, data.folderId!),
          eq(documentFolders.organisationId, user.organisationId),
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

  // Calculate total number of chunks
  const totalChunks = Math.ceil(data.totalSize / data.chunkSize)

  // Set expiry time
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000)

  // Create upload session
  const [session] = await db
    .insert(schema.uploadSessions)
    .values({
      organisationId: user.organisationId,
      filename: data.filename,
      mimeType: data.mimeType,
      totalSize: data.totalSize,
      chunkSize: data.chunkSize,
      totalChunks,
      uploadedChunks: 0,
      status: 'pending',
      userId: user.id,
      expiresAt,
    })
    .returning()

  if (!session) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create upload session',
    })
  }

  // Log the upload session creation
  await db.insert(schema.auditLog).values({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'upload_session.created',
    entityType: 'upload_session',
    entityId: session.id,
    newValues: {
      filename: data.filename,
      mimeType: data.mimeType,
      totalSize: data.totalSize,
      totalChunks,
    },
    ipAddress: getRequestIP(event),
    userAgent: getHeader(event, 'user-agent'),
  })

  return {
    sessionId: session.id,
    totalChunks,
    chunkSize: data.chunkSize,
    expiresAt: session.expiresAt.toISOString(),
    status: session.status,
  }
})
