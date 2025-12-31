<script setup lang="ts">
/**
 * File upload field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'file'
    label: string
    helpText?: string
    required: boolean
    maxFiles?: number
    maxFileSize?: number
    allowedFileTypes?: string[]
  }
  modelValue: Array<{ id: string; url: string; name: string; size: number }> | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Array<{ id: string; url: string; name: string; size: number }>]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const toast = useToast()

const files = computed(() => props.modelValue ?? [])
const maxFiles = computed(() => props.field.maxFiles ?? 5)
const canAddMore = computed(() => files.value.length < maxFiles.value)

const acceptTypes = computed(() => {
  if (props.field.allowedFileTypes?.length) {
    return props.field.allowedFileTypes.join(',')
  }
  return '*/*'
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'i-lucide-file-text'
    case 'doc':
    case 'docx':
      return 'i-lucide-file-type'
    case 'xls':
    case 'xlsx':
      return 'i-lucide-file-spreadsheet'
    case 'zip':
    case 'rar':
      return 'i-lucide-file-archive'
    default:
      return 'i-lucide-file'
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const selectedFiles = Array.from(input.files)
  const maxSize = props.field.maxFileSize ?? 50 * 1024 * 1024 // 50MB default

  // Validate file sizes
  for (const file of selectedFiles) {
    if (file.size > maxSize) {
      toast.add({
        title: 'File too large',
        description: `${file.name} exceeds the maximum size of ${formatFileSize(maxSize)}`,
        color: 'error',
      })
      return
    }
  }

  // Check if adding these files would exceed the limit
  if (files.value.length + selectedFiles.length > maxFiles.value) {
    toast.add({
      title: 'Too many files',
      description: `Maximum ${maxFiles.value} files allowed`,
      color: 'error',
    })
    return
  }

  isUploading.value = true

  try {
    // Create preview URLs for now (in production, upload to server)
    const newFiles = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }))

    emit('update:modelValue', [...files.value, ...newFiles])
  } catch (err) {
    toast.add({
      title: 'Upload failed',
      description: 'Failed to upload files',
      color: 'error',
    })
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

function removeFile(id: string) {
  const file = files.value.find((f) => f.id === id)
  if (file?.url.startsWith('blob:')) {
    URL.revokeObjectURL(file.url)
  }
  emit(
    'update:modelValue',
    files.value.filter((f) => f.id !== id),
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
      <!-- File list -->
      <div v-if="files.length > 0" class="space-y-2">
        <div
          v-for="file in files"
          :key="file.id"
          class="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
        >
          <UIcon :name="getFileIcon(file.name)" class="w-5 h-5 text-muted" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ file.name }}</p>
            <p class="text-xs text-muted">{{ formatFileSize(file.size) }}</p>
          </div>
          <button
            v-if="!disabled"
            type="button"
            class="p-1 text-muted hover:text-error transition-colors"
            @click="removeFile(file.id)"
          >
            <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
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
            :name="isUploading ? 'i-lucide-loader-2' : 'i-lucide-upload'"
            :class="['w-8 h-8 mx-auto text-muted', isUploading && 'animate-spin']"
          />
          <p class="text-sm text-muted">
            {{ isUploading ? 'Uploading...' : 'Click to add files' }}
          </p>
          <p class="text-xs text-muted">
            {{ files.length }} / {{ maxFiles }} files
          </p>
        </div>
      </div>
    </div>
  </UFormField>
</template>
