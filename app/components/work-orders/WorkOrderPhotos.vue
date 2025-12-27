<script setup lang="ts">
import { format, parseISO } from 'date-fns'

interface Photo {
  id: string
  photoUrl: string
  thumbnailUrl: string | null
  photoType: 'before' | 'during' | 'after' | 'issue' | 'other'
  caption: string | null
  createdAt: string
  uploadedBy?: { id: string; firstName: string; lastName: string }
}

const props = defineProps<{
  workOrderId: string
  photos: Photo[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const uploadModalOpen = ref(false)
const previewPhoto = ref<Photo | null>(null)
const previewModalOpen = ref(false)
const loading = ref<Record<string, boolean>>({})

const newPhoto = ref({
  photoUrl: '',
  photoType: 'during' as 'before' | 'during' | 'after' | 'issue' | 'other',
  caption: '',
})

const photoTypes = [
  { label: 'Before', value: 'before' },
  { label: 'During', value: 'during' },
  { label: 'After', value: 'after' },
  { label: 'Issue', value: 'issue' },
  { label: 'Other', value: 'other' },
]

const typeColors: Record<string, 'warning' | 'info' | 'success' | 'error' | 'neutral'> = {
  before: 'warning',
  during: 'info',
  after: 'success',
  issue: 'error',
  other: 'neutral',
}

function resetForm() {
  newPhoto.value = {
    photoUrl: '',
    photoType: 'during',
    caption: '',
  }
}

function openPreview(photo: Photo) {
  previewPhoto.value = photo
  previewModalOpen.value = true
}

function closePreview() {
  previewModalOpen.value = false
  previewPhoto.value = null
}

async function addPhoto() {
  if (!newPhoto.value.photoUrl.trim()) return
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/photos`, {
      method: 'POST',
      body: {
        photoUrl: newPhoto.value.photoUrl.trim(),
        photoType: newPhoto.value.photoType,
        caption: newPhoto.value.caption.trim() || null,
      },
    })
    toast.add({
      title: 'Photo added',
      description: 'Photo has been added to the work order.',
    })
    resetForm()
    uploadModalOpen.value = false
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to add photo.',
      color: 'error',
    })
  }
}

async function deletePhoto(photo: Photo) {
  loading.value[photo.id] = true
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/photos/${photo.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Photo removed',
      description: 'Photo has been removed from the work order.',
    })
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to remove photo.',
      color: 'error',
    })
  } finally {
    loading.value[photo.id] = false
  }
}

const groupedPhotos = computed(() => {
  const groups: Record<string, Photo[]> = {
    before: [],
    during: [],
    after: [],
    issue: [],
    other: [],
  }
  for (const photo of props.photos) {
    const photoType = photo.photoType || 'other'
    if (groups[photoType]) {
      groups[photoType].push(photo)
    }
  }
  return groups
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-medium">
          Photos ({{ photos.length }})
        </h3>
        <UButton
          v-if="!readonly"
          icon="i-lucide-upload"
          size="xs"
          variant="soft"
          label="Add Photo"
          @click="uploadModalOpen = true"
        />
      </div>
    </template>

    <div v-if="photos.length === 0" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-image" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No photos uploaded</p>
      <UButton
        v-if="!readonly"
        label="Add first photo"
        variant="link"
        class="mt-2"
        @click="uploadModalOpen = true"
      />
    </div>

    <div v-else class="space-y-6">
      <div v-for="(typePhotos, type) in groupedPhotos" :key="type">
        <template v-if="typePhotos.length">
          <h4 class="text-sm font-medium text-muted mb-3 capitalize">
            {{ type }} Photos ({{ typePhotos.length }})
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              v-for="photo in typePhotos"
              :key="photo.id"
              class="relative group cursor-pointer"
              @click="openPreview(photo)"
            >
              <img
                :src="photo.thumbnailUrl || photo.photoUrl"
                :alt="photo.caption || 'Work order photo'"
                class="w-full h-32 object-cover rounded-lg"
              >
              <div class="absolute top-2 left-2">
                <UBadge
                  :color="typeColors[photo.photoType] || 'neutral'"
                  variant="solid"
                  class="capitalize text-xs"
                >
                  {{ photo.photoType }}
                </UBadge>
              </div>
              <div
                v-if="!readonly"
                class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  :loading="loading[photo.id]"
                  @click.stop="deletePhoto(photo)"
                />
              </div>
              <p v-if="photo.caption" class="text-xs text-muted mt-1 truncate">
                {{ photo.caption }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Add Photo Modal -->
    <UModal v-model:open="uploadModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                Add Photo
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="uploadModalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="addPhoto">
            <UFormField label="Photo URL" required>
              <UInput
                v-model="newPhoto.photoUrl"
                placeholder="https://example.com/photo.jpg"
                autofocus
              />
            </UFormField>

            <UFormField label="Photo Type">
              <URadioGroup
                v-model="newPhoto.photoType"
                :items="photoTypes"
                orientation="horizontal"
              />
            </UFormField>

            <UFormField label="Caption">
              <UInput v-model="newPhoto.caption" placeholder="Optional caption" />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="uploadModalOpen = false" />
              <UButton type="submit" label="Add Photo" :disabled="!newPhoto.photoUrl.trim()" />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>

    <!-- Preview Modal -->
    <UModal v-model:open="previewModalOpen">
      <template #content>
        <UCard v-if="previewPhoto">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UBadge
                  :color="typeColors[previewPhoto.photoType] || 'neutral'"
                  variant="subtle"
                  class="capitalize"
                >
                  {{ previewPhoto.photoType }}
                </UBadge>
              </div>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="closePreview"
              />
            </div>
          </template>

          <img
            :src="previewPhoto.photoUrl"
            :alt="previewPhoto.caption || 'Work order photo'"
            class="w-full rounded-lg"
          >

          <template v-if="previewPhoto.caption || previewPhoto.uploadedBy" #footer>
            <div class="space-y-1">
              <p v-if="previewPhoto.caption">
                {{ previewPhoto.caption }}
              </p>
              <p v-if="previewPhoto.uploadedBy" class="text-sm text-muted">
                Uploaded by {{ previewPhoto.uploadedBy.firstName }}
                {{ previewPhoto.uploadedBy.lastName }} on
                {{ format(parseISO(previewPhoto.createdAt), 'PPpp') }}
              </p>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UCard>
</template>
