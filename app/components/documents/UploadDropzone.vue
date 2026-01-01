<script setup lang="ts">
/**
 * File upload dropzone component
 * Supports drag-and-drop, click to select, upload progress, and multiple file types
 */

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  progress?: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  errorMessage?: string
}

const props = withDefaults(
  defineProps<{
    /** List of uploaded files */
    modelValue?: UploadedFile[]
    /** Maximum number of files allowed */
    maxFiles?: number
    /** Maximum file size in bytes (default: 50MB) */
    maxFileSize?: number
    /** Accepted file types (MIME types or extensions) */
    accept?: string
    /** Whether uploads are disabled */
    disabled?: boolean
    /** Custom upload handler - if provided, files will be uploaded via this function */
    uploadHandler?: (file: File) => Promise<{ url: string; id?: string }>
    /** Label text for the dropzone */
    label?: string
    /** Help text displayed below the label */
    helpText?: string
  }>(),
  {
    modelValue: () => [],
    maxFiles: 10,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    accept: '*/*',
    disabled: false,
    label: 'Upload files',
    helpText: 'Drag and drop files here or click to browse',
  },
)

const emit = defineEmits<{
  'update:modelValue': [files: UploadedFile[]]
  'upload-start': [file: File]
  'upload-progress': [file: File, progress: number]
  'upload-complete': [file: UploadedFile]
  'upload-error': [file: File, error: Error]
}>()

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const dragCounter = ref(0)

const files = computed(() => props.modelValue ?? [])
const canAddMore = computed(() => files.value.length < props.maxFiles)
const remainingSlots = computed(() => props.maxFiles - files.value.length)

// File type icons mapping
function getFileIcon(type: string, name: string): string {
  // Check MIME type first
  if (type.startsWith('image/')) return 'i-lucide-image'
  if (type.startsWith('video/')) return 'i-lucide-video'
  if (type.startsWith('audio/')) return 'i-lucide-music'
  if (type === 'application/pdf') return 'i-lucide-file-text'

  // Fall back to extension
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
    case 'ppt':
    case 'pptx':
      return 'i-lucide-presentation'
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'i-lucide-file-archive'
    case 'txt':
    case 'md':
      return 'i-lucide-file-text'
    case 'csv':
      return 'i-lucide-file-spreadsheet'
    case 'json':
    case 'xml':
      return 'i-lucide-file-code'
    default:
      return 'i-lucide-file'
  }
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

// Get status color for badge
function getStatusColor(status: UploadedFile['status']): 'neutral' | 'info' | 'success' | 'error' {
  switch (status) {
    case 'pending':
      return 'neutral'
    case 'uploading':
      return 'info'
    case 'complete':
      return 'success'
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

// Validate files before adding
function validateFiles(fileList: File[]): File[] {
  const validFiles: File[] = []

  for (const file of fileList) {
    // Check file size
    if (file.size > props.maxFileSize) {
      toast.add({
        title: 'File too large',
        description: `"${file.name}" exceeds the maximum size of ${formatFileSize(props.maxFileSize)}`,
        color: 'error',
      })
      continue
    }

    // Check if we can add more files
    if (validFiles.length + files.value.length >= props.maxFiles) {
      toast.add({
        title: 'Too many files',
        description: `Maximum ${props.maxFiles} files allowed`,
        color: 'error',
      })
      break
    }

    validFiles.push(file)
  }

  return validFiles
}

// Process and upload files
async function processFiles(fileList: File[]) {
  const validFiles = validateFiles(fileList)
  if (validFiles.length === 0) return

  for (const file of validFiles) {
    const uploadedFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: '',
      progress: 0,
      status: 'pending',
    }

    // Add to list immediately
    emit('update:modelValue', [...files.value, uploadedFile])
    emit('upload-start', file)

    // If custom upload handler provided, use it
    if (props.uploadHandler) {
      try {
        uploadedFile.status = 'uploading'
        updateFile(uploadedFile)

        // Simulate progress for custom handler
        const progressInterval = setInterval(() => {
          if (uploadedFile.progress !== undefined && uploadedFile.progress < 90) {
            uploadedFile.progress += 10
            updateFile(uploadedFile)
            emit('upload-progress', file, uploadedFile.progress)
          }
        }, 200)

        const result = await props.uploadHandler(file)

        clearInterval(progressInterval)

        uploadedFile.url = result.url
        uploadedFile.id = result.id ?? uploadedFile.id
        uploadedFile.progress = 100
        uploadedFile.status = 'complete'
        updateFile(uploadedFile)
        emit('upload-complete', uploadedFile)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed')
        uploadedFile.status = 'error'
        uploadedFile.errorMessage = error.message
        uploadedFile.progress = 0
        updateFile(uploadedFile)
        emit('upload-error', file, error)

        toast.add({
          title: 'Upload failed',
          description: `Failed to upload "${file.name}": ${error.message}`,
          color: 'error',
        })
      }
    } else {
      // Create local blob URL for preview
      uploadedFile.url = URL.createObjectURL(file)
      uploadedFile.progress = 100
      uploadedFile.status = 'complete'
      updateFile(uploadedFile)
      emit('upload-complete', uploadedFile)
    }
  }
}

// Update a single file in the list
function updateFile(updatedFile: UploadedFile) {
  const newFiles = files.value.map((f) => (f.id === updatedFile.id ? updatedFile : f))
  emit('update:modelValue', newFiles)
}

// Remove a file from the list
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

// Retry failed upload
async function retryUpload(uploadedFile: UploadedFile) {
  if (!props.uploadHandler) {
    toast.add({
      title: 'Cannot retry',
      description: 'No upload handler configured',
      color: 'error',
    })
    return
  }

  // We need the original file to retry, which we don't have
  // So we'll just reset the status and let the user try again
  uploadedFile.status = 'pending'
  uploadedFile.progress = 0
  uploadedFile.errorMessage = undefined
  updateFile(uploadedFile)

  toast.add({
    title: 'Please select the file again',
    description: 'Remove this file and upload it again to retry',
    color: 'info',
  })
}

// Handle click on dropzone
function handleClick() {
  if (!props.disabled && canAddMore.value) {
    fileInput.value?.click()
  }
}

// Handle file input change
function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    processFiles(Array.from(input.files))
    input.value = '' // Reset input
  }
}

// Drag and drop handlers
function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragCounter.value++
  if (event.dataTransfer?.items.length) {
    isDragOver.value = true
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragOver.value = false
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false
  dragCounter.value = 0

  if (props.disabled || !canAddMore.value) return

  const droppedFiles = event.dataTransfer?.files
  if (droppedFiles?.length) {
    processFiles(Array.from(droppedFiles))
  }
}

// Cleanup blob URLs on unmount
onUnmounted(() => {
  for (const file of files.value) {
    if (file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url)
    }
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Dropzone area -->
    <div
      :class="[
        'relative border-2 border-dashed rounded-lg transition-all duration-200',
        isDragOver && !disabled
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-default hover:border-primary/50',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        !canAddMore && 'opacity-50',
      ]"
      role="button"
      tabindex="0"
      :aria-disabled="disabled || !canAddMore"
      :aria-label="label"
      @click="handleClick"
      @keydown.enter="handleClick"
      @keydown.space.prevent="handleClick"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        :disabled="disabled || !canAddMore"
        multiple
        class="hidden"
        :aria-hidden="true"
        @change="handleFileChange"
      />

      <div class="p-8 text-center">
        <!-- Upload icon -->
        <div
          :class="[
            'mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors',
            isDragOver ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted',
          ]"
        >
          <UIcon
            :name="isDragOver ? 'i-lucide-download' : 'i-lucide-upload-cloud'"
            class="w-6 h-6"
          />
        </div>

        <!-- Label and help text -->
        <p class="text-sm font-medium text-default mb-1">
          {{ label }}
        </p>
        <p class="text-xs text-muted mb-2">
          {{ helpText }}
        </p>

        <!-- File constraints info -->
        <p class="text-xs text-muted">
          <span v-if="accept !== '*/*'">Accepted: {{ accept }}</span>
          <span v-if="accept !== '*/*'" class="mx-1">|</span>
          <span>Max size: {{ formatFileSize(maxFileSize) }}</span>
          <span class="mx-1">|</span>
          <span>{{ remainingSlots }} of {{ maxFiles }} slots remaining</span>
        </p>
      </div>

      <!-- Drag overlay -->
      <div
        v-if="isDragOver && !disabled"
        class="absolute inset-0 bg-primary/5 rounded-lg flex items-center justify-center pointer-events-none"
      >
        <p class="text-primary font-medium">Drop files here</p>
      </div>
    </div>

    <!-- Uploaded files list -->
    <div v-if="files.length > 0" class="space-y-2">
      <p class="text-sm font-medium text-muted">
        Uploaded files ({{ files.length }}/{{ maxFiles }})
      </p>

      <TransitionGroup name="file-list" tag="div" class="space-y-2">
        <div
          v-for="file in files"
          :key="file.id"
          :class="[
            'flex items-center gap-3 p-3 rounded-lg border transition-colors',
            file.status === 'error'
              ? 'bg-error/5 border-error/20'
              : 'bg-muted/30 border-default',
          ]"
        >
          <!-- File icon -->
          <div
            :class="[
              'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
              file.status === 'error' ? 'bg-error/10 text-error' : 'bg-muted/50 text-muted',
            ]"
          >
            <UIcon :name="getFileIcon(file.type, file.name)" class="w-5 h-5" />
          </div>

          <!-- File info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <p class="text-sm font-medium truncate">{{ file.name }}</p>
              <UBadge
                v-if="file.status !== 'complete'"
                :color="getStatusColor(file.status)"
                variant="subtle"
                class="capitalize text-xs"
              >
                {{ file.status }}
              </UBadge>
            </div>

            <div class="flex items-center gap-2 text-xs text-muted">
              <span>{{ formatFileSize(file.size) }}</span>
              <span v-if="file.errorMessage" class="text-error">
                {{ file.errorMessage }}
              </span>
            </div>

            <!-- Progress bar -->
            <div
              v-if="file.status === 'uploading' && file.progress !== undefined"
              class="mt-2"
            >
              <div class="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary transition-all duration-300 rounded-full"
                  :style="{ width: `${file.progress}%` }"
                />
              </div>
              <p class="text-xs text-muted mt-1">{{ file.progress }}%</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex-shrink-0 flex items-center gap-1">
            <!-- Retry button for failed uploads -->
            <UButton
              v-if="file.status === 'error' && uploadHandler"
              icon="i-lucide-refresh-cw"
              size="xs"
              variant="ghost"
              color="neutral"
              title="Retry upload"
              @click.stop="retryUpload(file)"
            />

            <!-- Preview/download button for completed uploads -->
            <UButton
              v-if="file.status === 'complete' && file.url"
              :as="'a'"
              :href="file.url"
              target="_blank"
              icon="i-lucide-external-link"
              size="xs"
              variant="ghost"
              color="neutral"
              title="Open file"
              @click.stop
            />

            <!-- Remove button -->
            <UButton
              v-if="!disabled"
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="error"
              title="Remove file"
              @click.stop="removeFile(file.id)"
            />
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
/* File list transition animations */
.file-list-enter-active,
.file-list-leave-active {
  transition: all 0.3s ease;
}

.file-list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.file-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.file-list-move {
  transition: transform 0.3s ease;
}
</style>
