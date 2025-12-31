/**
 * Photo Upload API Endpoint
 * Accepts base64 encoded photos, validates, and stores them
 * Supports work-order, inspection, asset, and fuel-entry contexts
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import sharp from 'sharp'
import { z } from 'zod'
import { db, schema } from '../../utils/db'
import { requireAuth } from '../../utils/permissions'

// Configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'data/uploads'
const PHOTOS_DIR = join(UPLOADS_DIR, 'photos')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const THUMBNAIL_SIZE = 300
const MAX_IMAGE_DIMENSION = 2048

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// Context types for photos
const CONTEXT_TYPES = ['work-order', 'inspection', 'asset', 'fuel-entry', 'custom-form'] as const

// Photo types within work orders
const PHOTO_TYPES = ['before', 'during', 'after', 'issue', 'other'] as const

// Input validation schema
const uploadSchema = z.object({
  base64: z.string().min(1, 'Image data is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Invalid file type. Allowed: jpg, png, webp',
  }),
  contextType: z.enum(['work-order', 'inspection', 'asset', 'fuel-entry', 'custom-form']),
  contextId: z.string().uuid('Invalid context ID'),
  photoType: z.enum(['before', 'during', 'after', 'issue', 'other']).optional().default('other'),
  caption: z.string().max(500).optional().nullable(),
})

/**
 * Validate base64 and get buffer
 */
function decodeBase64(base64: string): Buffer {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '')

  try {
    return Buffer.from(cleanBase64, 'base64')
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid base64 encoded image data',
    })
  }
}

/**
 * Get file extension from MIME type
 */
function getExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }
  return extensions[mimeType] || '.jpg'
}

/**
 * Validate that the context entity exists and belongs to the organization
 */
async function validateContext(
  contextType: (typeof CONTEXT_TYPES)[number],
  contextId: string,
  organisationId: string,
): Promise<boolean> {
  switch (contextType) {
    case 'work-order': {
      const workOrder = await db.query.workOrders.findFirst({
        where: (workOrders, { and, eq }) =>
          and(eq(workOrders.id, contextId), eq(workOrders.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!workOrder
    }

    case 'asset': {
      const asset = await db.query.assets.findFirst({
        where: (assets, { and, eq }) =>
          and(eq(assets.id, contextId), eq(assets.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!asset
    }

    case 'inspection': {
      const inspection = await db.query.inspections.findFirst({
        where: (inspections, { and, eq }) =>
          and(eq(inspections.id, contextId), eq(inspections.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!inspection
    }

    case 'fuel-entry': {
      const fuelTransaction = await db.query.fuelTransactions.findFirst({
        where: (fuelTransactions, { and, eq }) =>
          and(
            eq(fuelTransactions.id, contextId),
            eq(fuelTransactions.organisationId, organisationId),
          ),
        columns: { id: true },
      })
      return !!fuelTransaction
    }

    case 'custom-form': {
      const submission = await db.query.customFormSubmissions.findFirst({
        where: (submissions, { and, eq }) =>
          and(eq(submissions.id, contextId), eq(submissions.organisationId, organisationId)),
        columns: { id: true },
      })
      return !!submission
    }

    default:
      return false
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Parse and validate body
  const body = await readBody(event)
  const result = uploadSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten(),
    })
  }

  const { base64, mimeType, contextType, contextId, photoType, caption } = result.data

  // Decode base64 to buffer
  const imageBuffer = decodeBase64(base64)

  // Validate file size
  if (imageBuffer.length > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    })
  }

  // Validate context exists
  const contextValid = await validateContext(contextType, contextId, user.organisationId)
  if (!contextValid) {
    throw createError({
      statusCode: 404,
      statusMessage: `${contextType} not found`,
    })
  }

  try {
    // Process image with sharp
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()

    // Validate it's actually an image
    if (!metadata.width || !metadata.height) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid image data',
      })
    }

    // Generate file paths
    const fileId = randomUUID()
    const extension = getExtension(mimeType)
    const now = new Date()
    const dateFolder = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}`

    const filename = `${fileId}${extension}`
    const thumbnailFilename = `${fileId}_thumb${extension}`
    const relativePath = join(contextType, dateFolder, filename)
    const thumbnailRelativePath = join(contextType, dateFolder, thumbnailFilename)
    const absoluteDir = join(PHOTOS_DIR, contextType, dateFolder)
    const absolutePath = join(PHOTOS_DIR, relativePath)
    const thumbnailAbsolutePath = join(PHOTOS_DIR, thumbnailRelativePath)

    // Ensure directory exists
    await mkdir(absoluteDir, { recursive: true })

    // Resize if needed and optimize
    let processedImage = image
    const needsResize =
      (metadata.width || 0) > MAX_IMAGE_DIMENSION || (metadata.height || 0) > MAX_IMAGE_DIMENSION

    if (needsResize) {
      processedImage = processedImage.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // Convert to target format with optimization
    let outputBuffer: Buffer
    if (mimeType === 'image/jpeg') {
      outputBuffer = await processedImage.jpeg({ quality: 85, progressive: true }).toBuffer()
    } else if (mimeType === 'image/png') {
      outputBuffer = await processedImage.png({ compressionLevel: 8 }).toBuffer()
    } else {
      outputBuffer = await processedImage.webp({ quality: 85 }).toBuffer()
    }

    // Write main image
    await writeFile(absolutePath, outputBuffer)

    // Generate thumbnail
    const thumbnailBuffer = await sharp(outputBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .toBuffer()

    await writeFile(thumbnailAbsolutePath, thumbnailBuffer)

    // Calculate checksum
    const checksum = createHash('sha256').update(outputBuffer).digest('hex')

    // Construct URLs
    const baseUrl = process.env.UPLOADS_BASE_URL || '/uploads'
    const photoUrl = `${baseUrl}/photos/${relativePath}`
    const thumbnailUrl = `${baseUrl}/photos/${thumbnailRelativePath}`

    // Get final dimensions
    const finalMetadata = await sharp(outputBuffer).metadata()

    // Insert into work_order_photos if context is work-order
    let photoRecord = null
    if (contextType === 'work-order') {
      const [record] = await db
        .insert(schema.workOrderPhotos)
        .values({
          workOrderId: contextId,
          photoUrl,
          thumbnailUrl,
          photoType: photoType || 'other',
          caption: caption || null,
          uploadedById: user.id,
        })
        .returning()
      photoRecord = record
    }

    // Log the upload
    await db.insert(schema.auditLog).values({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'photo.uploaded',
      entityType: contextType,
      entityId: contextId,
      newValues: {
        photoId: photoRecord?.id || fileId,
        filename,
        mimeType,
        fileSize: outputBuffer.length,
        width: finalMetadata.width,
        height: finalMetadata.height,
        photoType,
      },
      ipAddress: getRequestIP(event),
      userAgent: getHeader(event, 'user-agent'),
    })

    return {
      id: photoRecord?.id || fileId,
      url: photoUrl,
      thumbnailUrl,
      mimeType,
      fileSize: outputBuffer.length,
      width: finalMetadata.width,
      height: finalMetadata.height,
      checksum,
      contextType,
      contextId,
      photoType,
      caption,
      createdAt: now.toISOString(),
    }
  } catch (error: unknown) {
    // Handle sharp-specific errors
    const err = error as { message?: string; statusCode?: number }
    if (err.statusCode) {
      throw error
    }

    console.error('[photos/upload] Processing error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process image',
      data: { message: err.message },
    })
  }
})
