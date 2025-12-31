<script setup lang="ts">
/**
 * PhotoGallery Component
 * Displays photos in a responsive grid with lightbox, upload status, and deletion
 * Works with both online and offline photos
 */
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PhotoContextType, StoredPhoto } from '~/composables/usePhotoStorage'

interface OnlinePhoto {
  id: string
  url: string
  thumbnailUrl?: string | null
  photoType?: string
  caption?: string | null
  createdAt?: string
  uploadedBy?: { id: string; firstName: string; lastName: string }
}

type GalleryPhoto = StoredPhoto | OnlinePhoto

const props = withDefaults(
  defineProps<{
    /** Context type for photo operations */
    contextType: PhotoContextType
    /** Context ID for photo operations */
    contextId: string
    /** Online photos from server */
    photos?: OnlinePhoto[]
    /** Whether to include locally stored photos */
    includeLocal?: boolean
    /** Whether gallery is read-only */
    readonly?: boolean
    /** Number of columns on different screens */
    columns?: { sm?: number; md?: number; lg?: number }
    /** Empty state message */
    emptyMessage?: string
    /** Allow taking new photos */
    allowCapture?: boolean
    /** Photo type for new captures */
    defaultPhotoType?: string
  }>(),
  {
    photos: () => [],
    includeLocal: true,
    readonly: false,
    columns: () => ({ sm: 2, md: 3, lg: 4 }),
    emptyMessage: 'No photos yet',
    allowCapture: true,
    defaultPhotoType: 'other',
  },
)

const emit = defineEmits<{
  refresh: []
  photoAdded: [photo: StoredPhoto]
  photoDeleted: [id: string]
}>()

// Composables
const { takePhoto, selectFromGallery, isCameraAvailable, isLoading: cameraLoading } = useCamera()
const {
  storePhoto,
  getPhotosByContext,
  deletePhoto: deleteLocalPhoto,
  getPhotoDataUrl,
  uploadPhoto,
  pendingCount,
} = usePhotoStorage()
const toast = useToast()
const isOnline = useOnline()

// State
const localPhotos = ref<StoredPhoto[]>([])
const isLoadingLocal = ref(false)
const previewPhoto = ref<GalleryPhoto | null>(null)
const previewOpen = ref(false)
const deleteConfirmOpen = ref(false)
const photoToDelete = ref<GalleryPhoto | null>(null)
const isDeleting = ref(false)
const captionInput = ref('')

// Dropdown menu items for capture
const captureMenuItems = computed<DropdownMenuItem[]>(() => {
  const items: DropdownMenuItem[] = []

  if (isCameraAvailable.value) {
    items.push({
      label: 'Take Photo',
      icon: 'i-lucide-camera',
      onSelect: handleTakePhoto,
    })
  }

  items.push({
    label: 'Choose from Gallery',
    icon: 'i-lucide-image',
    onSelect: handleSelectFromGallery,
  })

  return items
})

// Computed: all photos combined
const allPhotos = computed(() => {
  const photos: Array<GalleryPhoto & { isLocal: boolean }> = []

  // Add online photos
  for (const photo of props.photos) {
    photos.push({ ...photo, isLocal: false })
  }

  // Add local photos if enabled
  if (props.includeLocal) {
    for (const photo of localPhotos.value) {
      // Skip if already uploaded and in online photos
      if (photo.uploadStatus === 'uploaded' && photo.remoteId) {
        const exists = props.photos.some((p) => p.id === photo.remoteId)
        if (exists) continue
      }
      photos.push({ ...photo, isLocal: true })
    }
  }

  return photos
})

// Grid class based on columns
const gridClass = computed(() => {
  const { sm = 2, md = 3, lg = 4 } = props.columns
  return `grid-cols-${sm} md:grid-cols-${md} lg:grid-cols-${lg}`
})

// Load local photos
async function loadLocalPhotos() {
  if (!props.includeLocal) return

  isLoadingLocal.value = true
  try {
    localPhotos.value = await getPhotosByContext(props.contextType, props.contextId)
  } catch (error) {
    console.error('[PhotoGallery] Failed to load local photos:', error)
  } finally {
    isLoadingLocal.value = false
  }
}

// Take a new photo
async function handleTakePhoto() {
  const photo = await takePhoto({
    quality: 85,
    width: 1920,
    height: 1920,
  })

  if (photo) {
    await addPhoto(photo, 'camera')
  }
}

// Select from gallery
async function handleSelectFromGallery() {
  const photo = await selectFromGallery({
    quality: 85,
    width: 1920,
    height: 1920,
  })

  if (photo) {
    await addPhoto(photo, 'gallery')
  }
}

// Add a photo (store locally, then try upload)
async function addPhoto(photo: Awaited<ReturnType<typeof takePhoto>>, _source: string) {
  if (!photo) return

  try {
    const storedPhoto = await storePhoto(photo, {
      contextType: props.contextType,
      contextId: props.contextId,
      photoType: props.defaultPhotoType,
      caption: captionInput.value || undefined,
    })

    localPhotos.value.push(storedPhoto)
    captionInput.value = ''
    emit('photoAdded', storedPhoto)

    toast.add({
      title: 'Photo Added',
      description: isOnline.value
        ? 'Photo saved, uploading...'
        : 'Photo saved offline, will upload when online',
      color: 'success',
      icon: 'i-lucide-camera',
    })

    // Try to upload immediately if online
    if (isOnline.value) {
      const result = await uploadPhoto(storedPhoto)
      if (result) {
        // Update local photo with remote info
        const index = localPhotos.value.findIndex((p) => p.id === storedPhoto.id)
        if (index !== -1) {
          localPhotos.value[index] = {
            ...storedPhoto,
            uploadStatus: 'uploaded',
            remoteUrl: result.url,
            thumbnailUrl: result.thumbnailUrl,
            remoteId: result.id,
          }
        }
        emit('refresh')
      }
    }
  } catch (error) {
    console.error('[PhotoGallery] Failed to add photo:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to save photo',
      color: 'error',
    })
  }
}

// Open photo preview
function openPreview(photo: GalleryPhoto) {
  previewPhoto.value = photo
  previewOpen.value = true
}

// Close preview
function closePreview() {
  previewOpen.value = false
  previewPhoto.value = null
}

// Get display URL for a photo
function getDisplayUrl(photo: GalleryPhoto): string {
  if ('base64' in photo) {
    // Local stored photo
    if (photo.uploadStatus === 'uploaded' && photo.remoteUrl) {
      return photo.remoteUrl
    }
    return getPhotoDataUrl(photo)
  }
  // Online photo
  return photo.thumbnailUrl || photo.url
}

// Get full URL for preview
function getFullUrl(photo: GalleryPhoto): string {
  if ('base64' in photo) {
    if (photo.uploadStatus === 'uploaded' && photo.remoteUrl) {
      return photo.remoteUrl
    }
    return getPhotoDataUrl(photo)
  }
  return photo.url
}

// Check if photo is local/offline
function isLocalPhoto(photo: GalleryPhoto): photo is StoredPhoto {
  return 'base64' in photo
}

// Get upload status badge color
function getStatusColor(photo: StoredPhoto): 'warning' | 'info' | 'success' | 'error' | 'neutral' {
  switch (photo.uploadStatus) {
    case 'pending':
      return 'warning'
    case 'uploading':
      return 'info'
    case 'uploaded':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'neutral'
  }
}

// Get upload status label
function getStatusLabel(photo: StoredPhoto): string {
  switch (photo.uploadStatus) {
    case 'pending':
      return 'Pending'
    case 'uploading':
      return 'Uploading'
    case 'uploaded':
      return 'Uploaded'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

// Confirm delete
function confirmDelete(photo: GalleryPhoto) {
  photoToDelete.value = photo
  deleteConfirmOpen.value = true
}

// Delete photo
async function handleDelete() {
  if (!photoToDelete.value) return

  isDeleting.value = true
  try {
    if (isLocalPhoto(photoToDelete.value)) {
      await deleteLocalPhoto(photoToDelete.value.id)
      localPhotos.value = localPhotos.value.filter((p) => p.id !== photoToDelete.value!.id)
    } else {
      // Delete from server
      await $fetch(`/api/work-orders/${props.contextId}/photos/${photoToDelete.value.id}`, {
        method: 'DELETE',
      })
    }

    emit('photoDeleted', photoToDelete.value.id)
    toast.add({
      title: 'Photo Deleted',
      description: 'Photo has been removed',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    photoToDelete.value = null
    emit('refresh')
  } catch (error) {
    console.error('[PhotoGallery] Failed to delete photo:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to delete photo',
      color: 'error',
    })
  } finally {
    isDeleting.value = false
  }
}

// Format date for display
function formatDate(dateString?: string): string {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// Initialize
onMounted(() => {
  loadLocalPhotos()
})

// Watch for context changes
watch(
  () => [props.contextType, props.contextId],
  () => {
    loadLocalPhotos()
  },
)
</script>

<template>
  <div class="space-y-4">
    <!-- Header with capture button -->
    <div v-if="!readonly && allowCapture" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted">
          {{ allPhotos.length }} photo{{ allPhotos.length !== 1 ? 's' : '' }}
        </span>
        <UBadge v-if="pendingCount > 0" color="warning" variant="subtle" size="xs">
          {{ pendingCount }} pending upload
        </UBadge>
      </div>

      <UDropdownMenu :items="captureMenuItems" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-camera"
          label="Add Photo"
          size="sm"
          :loading="cameraLoading"
        />
      </UDropdownMenu>
    </div>

    <!-- Photo grid -->
    <div v-if="allPhotos.length > 0" :class="['grid gap-3', gridClass]">
      <div
        v-for="photo in allPhotos"
        :key="photo.id"
        class="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border border-default hover:border-primary transition-colors"
        @click="openPreview(photo)"
      >
        <!-- Photo image -->
        <img
          :src="getDisplayUrl(photo)"
          :alt="isLocalPhoto(photo) ? photo.caption || 'Photo' : (photo as OnlinePhoto).caption || 'Photo'"
          class="w-full h-full object-cover"
          loading="lazy"
        />

        <!-- Upload status overlay for local photos -->
        <div
          v-if="isLocalPhoto(photo) && photo.uploadStatus !== 'uploaded'"
          class="absolute inset-0 bg-black/40 flex items-center justify-center"
        >
          <UBadge :color="getStatusColor(photo)" variant="solid" size="sm">
            <UIcon
              v-if="photo.uploadStatus === 'uploading'"
              name="i-lucide-loader-2"
              class="w-3 h-3 mr-1 animate-spin"
            />
            <UIcon
              v-else-if="photo.uploadStatus === 'pending'"
              name="i-lucide-cloud-off"
              class="w-3 h-3 mr-1"
            />
            <UIcon
              v-else-if="photo.uploadStatus === 'failed'"
              name="i-lucide-alert-circle"
              class="w-3 h-3 mr-1"
            />
            {{ getStatusLabel(photo) }}
          </UBadge>
        </div>

        <!-- Photo type badge -->
        <div
          v-if="isLocalPhoto(photo) ? photo.photoType : (photo as OnlinePhoto).photoType"
          class="absolute top-2 left-2"
        >
          <UBadge color="neutral" variant="solid" size="xs" class="capitalize opacity-90">
            {{ isLocalPhoto(photo) ? photo.photoType : (photo as OnlinePhoto).photoType }}
          </UBadge>
        </div>

        <!-- Delete button (on hover) -->
        <div
          v-if="!readonly"
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="solid"
            @click.stop="confirmDelete(photo)"
          />
        </div>

        <!-- Caption preview -->
        <div
          v-if="isLocalPhoto(photo) ? photo.caption : (photo as OnlinePhoto).caption"
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2"
        >
          <p class="text-white text-xs truncate">
            {{ isLocalPhoto(photo) ? photo.caption : (photo as OnlinePhoto).caption }}
          </p>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoadingLocal"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <UIcon name="i-lucide-image" class="w-12 h-12 text-muted mb-4 opacity-50" />
      <p class="text-muted mb-4">{{ emptyMessage }}</p>
      <UDropdownMenu v-if="!readonly && allowCapture" :items="captureMenuItems">
        <UButton
          icon="i-lucide-camera"
          label="Add First Photo"
          variant="soft"
        />
      </UDropdownMenu>
    </div>

    <!-- Loading state -->
    <div v-else class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Preview Modal -->
    <UModal v-model:open="previewOpen" size="xl">
      <template #content>
        <UCard v-if="previewPhoto" class="max-h-[90vh] overflow-hidden">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UBadge
                  v-if="isLocalPhoto(previewPhoto) ? previewPhoto.photoType : (previewPhoto as OnlinePhoto).photoType"
                  color="neutral"
                  variant="subtle"
                  class="capitalize"
                >
                  {{ isLocalPhoto(previewPhoto) ? previewPhoto.photoType : (previewPhoto as OnlinePhoto).photoType }}
                </UBadge>
                <UBadge
                  v-if="isLocalPhoto(previewPhoto) && previewPhoto.uploadStatus !== 'uploaded'"
                  :color="getStatusColor(previewPhoto)"
                  variant="subtle"
                >
                  {{ getStatusLabel(previewPhoto) }}
                </UBadge>
              </div>
              <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="closePreview" />
            </div>
          </template>

          <!-- Full-size image -->
          <div class="flex items-center justify-center bg-black/5 rounded-lg overflow-hidden max-h-[60vh]">
            <img
              :src="getFullUrl(previewPhoto)"
              :alt="isLocalPhoto(previewPhoto) ? previewPhoto.caption || 'Photo' : (previewPhoto as OnlinePhoto).caption || 'Photo'"
              class="max-w-full max-h-[60vh] object-contain"
            />
          </div>

          <template #footer>
            <div class="space-y-2">
              <p
                v-if="isLocalPhoto(previewPhoto) ? previewPhoto.caption : (previewPhoto as OnlinePhoto).caption"
                class="text-sm"
              >
                {{ isLocalPhoto(previewPhoto) ? previewPhoto.caption : (previewPhoto as OnlinePhoto).caption }}
              </p>
              <div class="flex items-center justify-between text-xs text-muted">
                <span>
                  {{
                    formatDate(
                      isLocalPhoto(previewPhoto) ? previewPhoto.takenAt : (previewPhoto as OnlinePhoto).createdAt,
                    )
                  }}
                </span>
                <span
                  v-if="!isLocalPhoto(previewPhoto) && (previewPhoto as OnlinePhoto).uploadedBy"
                >
                  by {{ (previewPhoto as OnlinePhoto).uploadedBy?.firstName }}
                  {{ (previewPhoto as OnlinePhoto).uploadedBy?.lastName }}
                </span>
              </div>

              <!-- Actions -->
              <div v-if="!readonly" class="flex justify-end gap-2 mt-4">
                <UButton
                  icon="i-lucide-trash-2"
                  label="Delete"
                  color="error"
                  variant="soft"
                  @click="confirmDelete(previewPhoto); closePreview()"
                />
              </div>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="deleteConfirmOpen" size="sm">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 text-error">
              <UIcon name="i-lucide-alert-triangle" class="w-5 h-5" />
              <span class="font-medium">Delete Photo</span>
            </div>
          </template>

          <p class="text-muted">
            Are you sure you want to delete this photo? This action cannot be undone.
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                variant="ghost"
                @click="deleteConfirmOpen = false; photoToDelete = null"
              />
              <UButton
                label="Delete"
                color="error"
                :loading="isDeleting"
                @click="handleDelete"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
