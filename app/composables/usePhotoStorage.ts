/**
 * Photo Storage Composable
 * Local photo cache using IndexedDB for offline-first support
 * Stores photos with metadata and manages upload queue
 */
import { createStore, del, get, keys, set, update } from 'idb-keyval'
import type { CameraPhoto } from './useCamera'

// Photo context types
export type PhotoContextType = 'work-order' | 'inspection' | 'asset' | 'fuel-entry' | 'custom-form'

// Upload status for queued photos
export type PhotoUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

/**
 * Stored photo with metadata
 */
export interface StoredPhoto {
  /** Unique identifier */
  id: string
  /** Base64 encoded image data */
  base64: string
  /** MIME type of the photo */
  mimeType: string
  /** When the photo was taken */
  takenAt: string
  /** When the photo was stored */
  storedAt: string
  /** Context type (work-order, inspection, etc.) */
  contextType: PhotoContextType
  /** ID of the related entity */
  contextId: string
  /** Photo type/category within context */
  photoType?: string
  /** Optional caption */
  caption?: string
  /** Upload status */
  uploadStatus: PhotoUploadStatus
  /** Number of upload attempts */
  uploadAttempts: number
  /** Last upload error */
  lastError?: string
  /** Last upload attempt timestamp */
  lastAttemptAt?: string
  /** Remote URL after successful upload */
  remoteUrl?: string
  /** Thumbnail URL after successful upload */
  thumbnailUrl?: string
  /** Remote photo ID after successful upload */
  remoteId?: string
  /** File size in bytes */
  fileSize: number
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
}

/**
 * Photo upload result
 */
export interface PhotoUploadResult {
  id: string
  url: string
  thumbnailUrl?: string
  mimeType: string
  fileSize: number
}

// Constants
const STORE_NAME = 'fleet-photos'
const PHOTO_KEY_PREFIX = 'photo_'
const MAX_UPLOAD_ATTEMPTS = 5

// Create custom IndexedDB store for photos
let photoStore: ReturnType<typeof createStore> | null = null

function getStore() {
  if (!photoStore && import.meta.client) {
    photoStore = createStore('fleet2-photos', STORE_NAME)
  }
  return photoStore
}

export function usePhotoStorage() {
  const isOnline = useOnline()
  const toast = useToast()

  // Reactive state
  const photoCount = ref(0)
  const pendingCount = ref(0)
  const isInitialized = ref(false)
  const isSyncing = ref(false)

  /**
   * Initialize and count photos
   */
  async function initialize(): Promise<void> {
    if (!import.meta.client || isInitialized.value) return

    try {
      const store = getStore()
      if (store) {
        const allKeys = await keys(store)
        const photoKeys = allKeys.filter((k) => String(k).startsWith(PHOTO_KEY_PREFIX))
        photoCount.value = photoKeys.length

        // Count pending uploads
        let pending = 0
        for (const key of photoKeys) {
          const photo = await get<StoredPhoto>(key, store)
          if (photo && photo.uploadStatus === 'pending') {
            pending++
          }
        }
        pendingCount.value = pending
        isInitialized.value = true
      }
    } catch (error) {
      console.error('[usePhotoStorage] Failed to initialize:', error)
    }
  }

  /**
   * Store a photo in IndexedDB
   */
  async function storePhoto(
    photo: CameraPhoto,
    context: {
      contextType: PhotoContextType
      contextId: string
      photoType?: string
      caption?: string
    },
  ): Promise<StoredPhoto> {
    const store = getStore()
    if (!store) {
      throw new Error('IndexedDB not available')
    }

    // Get base64 data
    let base64 = photo.base64
    if (!base64 && photo.dataUrl) {
      base64 = photo.dataUrl.split(',')[1]
    }
    if (!base64) {
      throw new Error('No image data available')
    }

    // Calculate file size from base64
    const fileSize = Math.ceil((base64.length * 3) / 4)

    const storedPhoto: StoredPhoto = {
      id: crypto.randomUUID(),
      base64,
      mimeType: photo.mimeType,
      takenAt: photo.takenAt,
      storedAt: new Date().toISOString(),
      contextType: context.contextType,
      contextId: context.contextId,
      photoType: context.photoType,
      caption: context.caption,
      uploadStatus: 'pending',
      uploadAttempts: 0,
      fileSize,
      width: photo.width,
      height: photo.height,
    }

    const key = `${PHOTO_KEY_PREFIX}${storedPhoto.id}`
    await set(key, storedPhoto, store)

    photoCount.value++
    pendingCount.value++

    return storedPhoto
  }

  /**
   * Get a photo by ID
   */
  async function getPhoto(id: string): Promise<StoredPhoto | null> {
    const store = getStore()
    if (!store) return null

    const key = `${PHOTO_KEY_PREFIX}${id}`
    return (await get<StoredPhoto>(key, store)) || null
  }

  /**
   * Get all photos for a specific context
   */
  async function getPhotosByContext(
    contextType: PhotoContextType,
    contextId: string,
  ): Promise<StoredPhoto[]> {
    const store = getStore()
    if (!store) return []

    try {
      const allKeys = await keys(store)
      const photoKeys = allKeys.filter((k) => String(k).startsWith(PHOTO_KEY_PREFIX))

      const photos: StoredPhoto[] = []
      for (const key of photoKeys) {
        const photo = await get<StoredPhoto>(key, store)
        if (photo && photo.contextType === contextType && photo.contextId === contextId) {
          photos.push(photo)
        }
      }

      // Sort by creation time (oldest first)
      return photos.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime())
    } catch (error) {
      console.error('[usePhotoStorage] Failed to get photos by context:', error)
      return []
    }
  }

  /**
   * Get all pending photos (ready for upload)
   */
  async function getPendingPhotos(): Promise<StoredPhoto[]> {
    const store = getStore()
    if (!store) return []

    try {
      const allKeys = await keys(store)
      const photoKeys = allKeys.filter((k) => String(k).startsWith(PHOTO_KEY_PREFIX))

      const photos: StoredPhoto[] = []
      for (const key of photoKeys) {
        const photo = await get<StoredPhoto>(key, store)
        if (photo && photo.uploadStatus === 'pending') {
          photos.push(photo)
        }
      }

      // Sort by stored time (oldest first)
      return photos.sort((a, b) => new Date(a.storedAt).getTime() - new Date(b.storedAt).getTime())
    } catch (error) {
      console.error('[usePhotoStorage] Failed to get pending photos:', error)
      return []
    }
  }

  /**
   * Update a photo's upload status
   */
  async function updatePhotoStatus(
    id: string,
    status: PhotoUploadStatus,
    details?: {
      remoteUrl?: string
      thumbnailUrl?: string
      remoteId?: string
      error?: string
    },
  ): Promise<void> {
    const store = getStore()
    if (!store) return

    const key = `${PHOTO_KEY_PREFIX}${id}`

    await update<StoredPhoto | undefined>(
      key,
      (photo): StoredPhoto | undefined => {
        if (!photo) return undefined

        const updated: StoredPhoto = {
          ...photo,
          uploadStatus: status,
          lastAttemptAt: new Date().toISOString(),
        }

        if (status === 'uploading') {
          updated.uploadAttempts = photo.uploadAttempts + 1
        }

        if (status === 'failed' && details?.error) {
          updated.lastError = details.error
        }

        if (status === 'uploaded') {
          updated.remoteUrl = details?.remoteUrl
          updated.thumbnailUrl = details?.thumbnailUrl
          updated.remoteId = details?.remoteId
          updated.lastError = undefined
        }

        return updated
      },
      store,
    )

    // Update pending count
    if (status !== 'pending') {
      pendingCount.value = Math.max(0, pendingCount.value - 1)
    }
  }

  /**
   * Delete a photo from storage
   */
  async function deletePhoto(id: string): Promise<void> {
    const store = getStore()
    if (!store) return

    const photo = await getPhoto(id)
    const key = `${PHOTO_KEY_PREFIX}${id}`
    await del(key, store)

    photoCount.value = Math.max(0, photoCount.value - 1)
    if (photo?.uploadStatus === 'pending') {
      pendingCount.value = Math.max(0, pendingCount.value - 1)
    }
  }

  /**
   * Delete all uploaded photos for a context (cleanup)
   */
  async function cleanupUploadedPhotos(
    contextType: PhotoContextType,
    contextId: string,
  ): Promise<number> {
    const photos = await getPhotosByContext(contextType, contextId)
    const uploadedPhotos = photos.filter((p) => p.uploadStatus === 'uploaded')

    for (const photo of uploadedPhotos) {
      await deletePhoto(photo.id)
    }

    return uploadedPhotos.length
  }

  /**
   * Upload a single photo to the server
   */
  async function uploadPhoto(photo: StoredPhoto): Promise<PhotoUploadResult | null> {
    if (!isOnline.value) {
      return null
    }

    if (photo.uploadAttempts >= MAX_UPLOAD_ATTEMPTS) {
      await updatePhotoStatus(photo.id, 'failed', {
        error: `Maximum upload attempts (${MAX_UPLOAD_ATTEMPTS}) exceeded`,
      })
      return null
    }

    await updatePhotoStatus(photo.id, 'uploading')

    try {
      const response = await $fetch<PhotoUploadResult>('/api/photos/upload', {
        method: 'POST',
        body: {
          base64: photo.base64,
          mimeType: photo.mimeType,
          contextType: photo.contextType,
          contextId: photo.contextId,
          photoType: photo.photoType,
          caption: photo.caption,
        },
      })

      await updatePhotoStatus(photo.id, 'uploaded', {
        remoteUrl: response.url,
        thumbnailUrl: response.thumbnailUrl,
        remoteId: response.id,
      })

      return response
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; message?: string }
      const errorMessage = err.data?.message || err.message || 'Upload failed'

      console.error('[usePhotoStorage] Upload failed:', error)

      await updatePhotoStatus(photo.id, 'failed', { error: errorMessage })
      return null
    }
  }

  /**
   * Upload all pending photos
   */
  async function uploadPendingPhotos(options?: {
    onProgress?: (completed: number, total: number) => void
    onError?: (photo: StoredPhoto, error: string) => void
  }): Promise<{ success: number; failed: number }> {
    if (!isOnline.value) {
      return { success: 0, failed: 0 }
    }

    if (isSyncing.value) {
      return { success: 0, failed: 0 }
    }

    isSyncing.value = true

    const pending = await getPendingPhotos()
    const total = pending.length
    let success = 0
    let failed = 0

    for (let i = 0; i < pending.length; i++) {
      const photo = pending[i]
      if (!photo) continue

      options?.onProgress?.(i, total)

      const result = await uploadPhoto(photo)
      if (result) {
        success++
      } else {
        failed++
        const updatedPhoto = await getPhoto(photo.id)
        if (updatedPhoto?.lastError) {
          options?.onError?.(updatedPhoto, updatedPhoto.lastError)
        }
      }
    }

    isSyncing.value = false

    // Show toast summary
    if (success > 0 || failed > 0) {
      if (failed === 0) {
        toast.add({
          title: 'Photos Uploaded',
          description: `Successfully uploaded ${success} photo${success !== 1 ? 's' : ''}`,
          color: 'success',
          icon: 'i-lucide-cloud-upload',
        })
      } else {
        toast.add({
          title: 'Photo Upload Partial',
          description: `Uploaded ${success}, failed ${failed}`,
          color: 'warning',
          icon: 'i-lucide-alert-triangle',
        })
      }
    }

    // Update pending count
    await initialize()

    return { success, failed }
  }

  /**
   * Get a data URL for displaying a stored photo
   */
  function getPhotoDataUrl(photo: StoredPhoto): string {
    return `data:${photo.mimeType};base64,${photo.base64}`
  }

  /**
   * Get the display URL (remote if uploaded, local otherwise)
   */
  function getDisplayUrl(photo: StoredPhoto): string {
    if (photo.uploadStatus === 'uploaded' && photo.remoteUrl) {
      return photo.remoteUrl
    }
    return getPhotoDataUrl(photo)
  }

  /**
   * Get storage statistics
   */
  async function getStorageStats(): Promise<{
    totalPhotos: number
    pendingPhotos: number
    uploadedPhotos: number
    failedPhotos: number
    totalSizeBytes: number
  }> {
    const store = getStore()
    if (!store) {
      return {
        totalPhotos: 0,
        pendingPhotos: 0,
        uploadedPhotos: 0,
        failedPhotos: 0,
        totalSizeBytes: 0,
      }
    }

    try {
      const allKeys = await keys(store)
      const photoKeys = allKeys.filter((k) => String(k).startsWith(PHOTO_KEY_PREFIX))

      let pending = 0
      let uploaded = 0
      let failed = 0
      let totalSize = 0

      for (const key of photoKeys) {
        const photo = await get<StoredPhoto>(key, store)
        if (photo) {
          totalSize += photo.fileSize

          switch (photo.uploadStatus) {
            case 'pending':
              pending++
              break
            case 'uploaded':
              uploaded++
              break
            case 'failed':
              failed++
              break
          }
        }
      }

      return {
        totalPhotos: photoKeys.length,
        pendingPhotos: pending,
        uploadedPhotos: uploaded,
        failedPhotos: failed,
        totalSizeBytes: totalSize,
      }
    } catch (error) {
      console.error('[usePhotoStorage] Failed to get storage stats:', error)
      return {
        totalPhotos: 0,
        pendingPhotos: 0,
        uploadedPhotos: 0,
        failedPhotos: 0,
        totalSizeBytes: 0,
      }
    }
  }

  /**
   * Clear all photos (use with caution)
   */
  async function clearAll(): Promise<void> {
    const store = getStore()
    if (!store) return

    const allKeys = await keys(store)
    const photoKeys = allKeys.filter((k) => String(k).startsWith(PHOTO_KEY_PREFIX))

    for (const key of photoKeys) {
      await del(key, store)
    }

    photoCount.value = 0
    pendingCount.value = 0
  }

  /**
   * Retry failed uploads
   */
  async function retryFailedUploads(): Promise<{ success: number; failed: number }> {
    const store = getStore()
    if (!store) return { success: 0, failed: 0 }

    try {
      const allKeys = await keys(store)
      const photoKeys = allKeys.filter((k) => String(k).startsWith(PHOTO_KEY_PREFIX))

      // Reset failed photos to pending
      for (const key of photoKeys) {
        const photo = await get<StoredPhoto>(key, store)
        if (
          photo &&
          photo.uploadStatus === 'failed' &&
          photo.uploadAttempts < MAX_UPLOAD_ATTEMPTS
        ) {
          await update<StoredPhoto | undefined>(
            key,
            (p): StoredPhoto | undefined =>
              p ? { ...p, uploadStatus: 'pending' as PhotoUploadStatus } : undefined,
            store,
          )
          pendingCount.value++
        }
      }

      // Now upload
      return await uploadPendingPhotos()
    } catch (error) {
      console.error('[usePhotoStorage] Failed to retry uploads:', error)
      return { success: 0, failed: 0 }
    }
  }

  // Initialize on client-side
  if (import.meta.client) {
    initialize()

    // Auto-upload when coming online
    const networkStatus = useNetworkStatus()
    const unsubscribe = networkStatus.onStatusChange(({ isOnline: online, wasOnline }) => {
      if (online && !wasOnline && pendingCount.value > 0) {
        // Just came online with pending photos
        setTimeout(() => {
          uploadPendingPhotos().catch((err) => {
            console.error('[usePhotoStorage] Auto-upload failed:', err)
          })
        }, 2000) // Wait 2 seconds for connection to stabilize
      }
    })

    onUnmounted(() => {
      unsubscribe()
    })
  }

  return {
    // State
    photoCount: computed(() => photoCount.value),
    pendingCount: computed(() => pendingCount.value),
    isInitialized: readonly(isInitialized),
    isSyncing: readonly(isSyncing),
    isOnline,

    // Core operations
    storePhoto,
    getPhoto,
    getPhotosByContext,
    getPendingPhotos,
    updatePhotoStatus,
    deletePhoto,
    cleanupUploadedPhotos,

    // Upload operations
    uploadPhoto,
    uploadPendingPhotos,
    retryFailedUploads,

    // Utilities
    getPhotoDataUrl,
    getDisplayUrl,
    getStorageStats,
    clearAll,
    initialize,
  }
}
