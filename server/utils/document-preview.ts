/**
 * Generate a preview URL for a document based on its MIME type
 * Returns null if the document type doesn't support preview
 */
export function getPreviewUrl(mimeType: string, filePath: string): string | null {
  // Check if the file type supports preview
  const previewableMimeTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // PDFs
    'application/pdf',
  ]

  if (!previewableMimeTypes.includes(mimeType)) {
    return null
  }

  // Generate preview URL - assumes file is served from /api/files/
  // The actual implementation would depend on your file storage strategy
  const encodedPath = encodeURIComponent(filePath)
  return `/api/files/preview?path=${encodedPath}`
}

/**
 * Check if a MIME type supports inline preview
 */
export function supportsPreview(mimeType: string): boolean {
  const previewableMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
  ]

  return previewableMimeTypes.includes(mimeType)
}

/**
 * Get the preview type for a MIME type
 */
export function getPreviewType(mimeType: string): 'image' | 'pdf' | 'none' {
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType === 'application/pdf') {
    return 'pdf'
  }
  return 'none'
}

/**
 * Generate a thumbnail URL for a document
 * This would be used for generating smaller preview images
 */
export function getThumbnailUrl(mimeType: string, filePath: string, size = 200): string | null {
  // Only images and PDFs can have thumbnails
  if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
    return null
  }

  const encodedPath = encodeURIComponent(filePath)
  return `/api/files/thumbnail?path=${encodedPath}&size=${size}`
}
