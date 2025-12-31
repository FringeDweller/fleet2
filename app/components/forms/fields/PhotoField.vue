<script setup lang="ts">
/**
 * Photo upload field component for custom forms
 * Supports camera capture and file selection
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'photo'
    label: string
    helpText?: string
    required: boolean
    maxFiles?: number
    maxFileSize?: number
    allowedFileTypes?: string[]
  }
  modelValue: Array<{ id: string; url: string; name?: string }> | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Array<{ id: string; url: string; name?: string }>]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const toast = useToast()

const photos = computed(() => props.modelValue ?? [])
const maxFiles = computed(() => props.field.maxFiles ?? 5)
const canAddMore = computed(() => photos.value.length < maxFiles.value)

const acceptTypes = computed(() => {
  if (props.field.allowedFileTypes?.length) {
    return props.field.allowedFileTypes.join(',')
  }
  return 'image/*'
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const files = Array.from(input.files)
  const maxSize = props.field.maxFileSize ?? 10 * 1024 * 1024 // 10MB default

  // Validate file sizes
  for (const file of files) {
    if (file.size > maxSize) {
      toast.add({
        title: 'File too large',
        description: `${file.name} exceeds the maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
        color: 'error',
      })
      return
    }
  }

  // Check if adding these files would exceed the limit
  if (photos.value.length + files.length > maxFiles.value) {
    toast.add({
      title: 'Too many files',
      description: `Maximum ${maxFiles.value} photos allowed`,
      color: 'error',
    })
    return
  }

  isUploading.value = true

  try {
    // Create preview URLs for now (in production, upload to server)
    const newPhotos = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      name: file.name,
    }))

    emit('update:modelValue', [...photos.value, ...newPhotos])
  } catch (err) {
    toast.add({
      title: 'Upload failed',
      description: 'Failed to upload photos',
      color: 'error',
    })
  } finally {
    isUploading.value = false
    // Reset input
    input.value = ''
  }
}

function removePhoto(id: string) {
  const photo = photos.value.find((p) => p.id === id)
  if (photo?.url.startsWith('blob:')) {
    URL.revokeObjectURL(photo.url)
  }
  emit(
    'update:modelValue',
    photos.value.filter((p) => p.id !== id),
  )
}
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <div class="space-y-3">
      <!-- Photo grid -->
      <div v-if="photos.length > 0" class="grid grid-cols-3 gap-2">
        <div
          v-for="photo in photos"
          :key="photo.id"
          class="relative aspect-square rounded-lg overflow-hidden border border-default"
        >
          <img
            :src="photo.url"
            :alt="photo.name || 'Photo'"
            class="w-full h-full object-cover"
          />
          <button
            v-if="!disabled"
            type="button"
            class="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            @click="removePhoto(photo.id)"
          >
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Upload button -->
      <div
        v-if="canAddMore && !disabled"
        class="border-2 border-dashed border-default rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
        @click="triggerFileInput"
      >
        <input
          ref="fileInput"
          type="file"
          :accept="acceptTypes"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />
        <div class="space-y-2">
          <UIcon
            :name="isUploading ? 'i-lucide-loader-2' : 'i-lucide-camera'"
            :class="['w-8 h-8 mx-auto text-muted', isUploading && 'animate-spin']"
          />
          <p class="text-sm text-muted">
            {{ isUploading ? 'Uploading...' : 'Click to add photos' }}
          </p>
          <p class="text-xs text-muted">
            {{ photos.length }} / {{ maxFiles }} photos
          </p>
        </div>
      </div>

      <!-- Max reached message -->
      <p v-else-if="!canAddMore && !disabled" class="text-xs text-muted text-center">
        Maximum number of photos reached
      </p>
    </div>
  </UFormField>
</template>
