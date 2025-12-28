<script setup lang="ts">
// Types defined locally to avoid server import issues
interface InspectionChecklistItem {
  id: string
  label: string
  description?: string | null
  category?: string | null
  itemType: string
  required: boolean
  order: number
  options?: unknown
}

interface InspectionItemPhoto {
  id: string
  url: string
  caption?: string
  takenAt: string
}

definePageMeta({
  middleware: 'auth',
  layout: 'minimal',
})

interface InspectionItemResponse {
  id: string
  inspectionId: string
  checklistItemId: string
  checklistItemLabel: string
  checklistItemType: string
  result: 'pass' | 'fail' | 'na' | 'pending'
  numericValue: string | null
  textValue: string | null
  photos: InspectionItemPhoto[]
  signature: string | null
  notes: string | null
  respondedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Inspection {
  id: string
  status: 'in_progress' | 'completed' | 'cancelled'
  startedAt: string
  completedAt: string | null
  notes: string | null
  overallResult: string | null
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
    category: {
      id: string
      name: string
    } | null
  }
  template: {
    id: string
    name: string
    description: string | null
    checklistItems: InspectionChecklistItem[]
  }
  operator: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  items: InspectionItemResponse[]
}

type ItemResult = 'pass' | 'fail' | 'na' | 'pending'

interface LocalItemState {
  result: ItemResult
  notes: string
  photos: InspectionItemPhoto[]
  isDirty: boolean
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const inspectionId = route.params.id as string

// Fetch inspection data
const {
  data: inspection,
  status: fetchStatus,
  error: fetchError,
  refresh,
} = await useFetch<Inspection>(`/api/inspections/${inspectionId}`, {
  lazy: true,
})

// Local state for item responses
const itemStates = ref<Map<string, LocalItemState>>(new Map())
const isSubmitting = ref(false)
const showPhotoModal = ref(false)
const activeItemId = ref<string | null>(null)
const photoCaption = ref('')
const showCompletionModal = ref(false)
const completionNotes = ref('')

// Initialize item states when inspection loads
watch(
  () => inspection.value,
  (insp) => {
    if (insp?.items) {
      const states = new Map<string, LocalItemState>()
      for (const item of insp.items) {
        states.set(item.checklistItemId, {
          result: item.result,
          notes: item.notes || '',
          photos: item.photos || [],
          isDirty: false,
        })
      }
      itemStates.value = states
    }
  },
  { immediate: true },
)

// Get ordered checklist items from template
const orderedItems = computed(() => {
  if (!inspection.value?.template?.checklistItems) return []
  return [...inspection.value.template.checklistItems].sort((a, b) => a.order - b.order)
})

// Get response item for a checklist item
function getResponseItem(checklistItemId: string): InspectionItemResponse | undefined {
  return inspection.value?.items.find((item) => item.checklistItemId === checklistItemId)
}

// Get local state for an item
function getItemState(checklistItemId: string): LocalItemState {
  return (
    itemStates.value.get(checklistItemId) || {
      result: 'pending' as ItemResult,
      notes: '',
      photos: [],
      isDirty: false,
    }
  )
}

// Calculate progress
const progress = computed(() => {
  if (!orderedItems.value.length) return { completed: 0, total: 0, percentage: 0 }
  const completed = orderedItems.value.filter((item) => {
    const state = getItemState(item.id)
    return state.result !== 'pending'
  }).length
  const total = orderedItems.value.length
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  }
})

// Check if all required validations are met for completion
const validationErrors = computed(() => {
  const errors: string[] = []
  for (const item of orderedItems.value) {
    const state = getItemState(item.id)
    if (state.result === 'pending') {
      errors.push(`"${item.label}" is not answered`)
    } else if (state.result === 'fail') {
      if (state.photos.length === 0) {
        errors.push(`"${item.label}" failed - photo required`)
      }
      if (!state.notes.trim()) {
        errors.push(`"${item.label}" failed - comment required`)
      }
    }
  }
  return errors
})

const canComplete = computed(() => validationErrors.value.length === 0)

// Set result for an item
function setItemResult(checklistItemId: string, result: ItemResult) {
  const current = getItemState(checklistItemId)
  itemStates.value.set(checklistItemId, {
    ...current,
    result,
    isDirty: true,
  })
}

// Update notes for an item
function updateItemNotes(checklistItemId: string, notes: string) {
  const current = getItemState(checklistItemId)
  itemStates.value.set(checklistItemId, {
    ...current,
    notes,
    isDirty: true,
  })
}

// Open photo modal for an item
function openPhotoModal(checklistItemId: string) {
  activeItemId.value = checklistItemId
  photoCaption.value = ''
  showPhotoModal.value = true
}

// Simulate photo upload (in real app, this would upload to storage)
async function addPhoto(checklistItemId: string, photoUrl: string) {
  const current = getItemState(checklistItemId)
  const newPhoto: InspectionItemPhoto = {
    id: crypto.randomUUID(),
    url: photoUrl,
    caption: photoCaption.value || undefined,
    takenAt: new Date().toISOString(),
  }
  itemStates.value.set(checklistItemId, {
    ...current,
    photos: [...current.photos, newPhoto],
    isDirty: true,
  })
  showPhotoModal.value = false
  activeItemId.value = null
  photoCaption.value = ''
}

// Remove photo from an item
function removePhoto(checklistItemId: string, photoId: string) {
  const current = getItemState(checklistItemId)
  itemStates.value.set(checklistItemId, {
    ...current,
    photos: current.photos.filter((p) => p.id !== photoId),
    isDirty: true,
  })
}

// Save current progress (auto-save)
async function saveProgress() {
  if (!inspection.value) return

  const dirtyItems = orderedItems.value.filter((item) => {
    const state = getItemState(item.id)
    return state.isDirty
  })

  if (dirtyItems.length === 0) return

  try {
    const items = dirtyItems.map((item) => {
      const state = getItemState(item.id)
      return {
        checklistItemId: item.id,
        result: state.result === 'pending' ? 'pending' : state.result,
        notes: state.notes || undefined,
        photos: state.photos.length > 0 ? state.photos : undefined,
      }
    })

    await $fetch(`/api/inspections/${inspectionId}/items`, {
      method: 'POST',
      body: {
        items: items.filter((i) => i.result !== 'pending'),
        complete: false,
      },
    })

    // Mark items as not dirty after save
    for (const item of dirtyItems) {
      const state = getItemState(item.id)
      itemStates.value.set(item.id, {
        ...state,
        isDirty: false,
      })
    }
  } catch (error) {
    console.error('Failed to save progress:', error)
  }
}

// Complete inspection
async function completeInspection() {
  if (!canComplete.value || !inspection.value) return

  isSubmitting.value = true

  try {
    const items = orderedItems.value.map((item) => {
      const state = getItemState(item.id)
      return {
        checklistItemId: item.id,
        result: state.result,
        notes: state.notes || undefined,
        photos: state.photos.length > 0 ? state.photos : undefined,
      }
    })

    await $fetch(`/api/inspections/${inspectionId}/items`, {
      method: 'POST',
      body: {
        items: items.filter((i) => i.result !== 'pending'),
        complete: true,
        notes: completionNotes.value || undefined,
      },
    })

    toast.add({
      title: 'Inspection Complete',
      description: 'The pre-start inspection has been submitted successfully.',
      color: 'success',
    })

    showCompletionModal.value = false

    // Navigate back or to session page
    router.push('/operator/session')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete inspection'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

// Auto-save on changes (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  itemStates,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveProgress()
    }, 2000)
  },
  { deep: true },
)

// Handle back navigation
function handleBack() {
  if (progress.value.completed > 0) {
    saveProgress()
  }
  router.back()
}

// Get result color
function getResultColor(result: ItemResult): 'success' | 'error' | 'warning' | 'neutral' {
  switch (result) {
    case 'pass':
      return 'success'
    case 'fail':
      return 'error'
    case 'na':
      return 'warning'
    default:
      return 'neutral'
  }
}

// File input ref for camera
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerCamera() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !activeItemId.value) return

  // In a real app, upload to storage and get URL
  // For now, create a local object URL
  const url = URL.createObjectURL(file)
  await addPhoto(activeItemId.value, url)

  // Reset input
  target.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <header class="sticky top-0 z-10 bg-elevated border-b border-default">
      <div class="flex items-center justify-between p-4">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Go back"
            @click="handleBack"
          />
          <div>
            <h1 class="font-medium">Pre-Start Inspection</h1>
            <div v-if="inspection" class="text-sm text-muted">
              {{ inspection.asset.assetNumber }}
              <span v-if="inspection.asset.make || inspection.asset.model">
                - {{ [inspection.asset.make, inspection.asset.model].filter(Boolean).join(' ') }}
              </span>
            </div>
          </div>
        </div>
        <UBadge v-if="inspection" :color="inspection.status === 'completed' ? 'success' : 'info'" variant="subtle">
          {{ inspection.status === 'completed' ? 'Completed' : 'In Progress' }}
        </UBadge>
      </div>

      <!-- Progress bar -->
      <div class="px-4 pb-3">
        <div class="flex items-center justify-between text-sm mb-1">
          <span class="text-muted">Progress</span>
          <span class="font-medium">{{ progress.completed }} of {{ progress.total }} items</span>
        </div>
        <div class="h-2 bg-muted/30 rounded-full overflow-hidden" role="progressbar" :aria-valuenow="progress.percentage" aria-valuemin="0" aria-valuemax="100">
          <div
            class="h-full bg-primary transition-all duration-300"
            :style="{ width: `${progress.percentage}%` }"
          />
        </div>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="fetchStatus === 'pending'" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Error state -->
    <div v-else-if="fetchError" class="text-center py-12 px-4">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-error mx-auto mb-4" />
      <h3 class="text-lg font-medium mb-2">Inspection not found</h3>
      <p class="text-muted mb-4">The inspection you're looking for doesn't exist or you don't have access.</p>
      <UButton label="Go Back" @click="router.back()" />
    </div>

    <!-- Completed state -->
    <div v-else-if="inspection?.status === 'completed'" class="text-center py-12 px-4">
      <UIcon name="i-lucide-check-circle" class="w-16 h-16 text-success mx-auto mb-4" />
      <h2 class="text-xl font-bold mb-2">Inspection Complete</h2>
      <p class="text-muted mb-2">
        This inspection was completed on
        {{ new Date(inspection.completedAt!).toLocaleDateString('en-AU', { dateStyle: 'medium' }) }}
      </p>
      <UBadge
        :color="inspection.overallResult === 'pass' ? 'success' : inspection.overallResult === 'fail' ? 'error' : 'warning'"
        size="lg"
        class="mb-6"
      >
        {{ inspection.overallResult?.toUpperCase() || 'N/A' }}
      </UBadge>
      <div class="flex justify-center gap-3">
        <UButton label="View Details" variant="outline" :to="`/assets/${inspection.asset.id}`" />
        <UButton label="Done" color="primary" @click="router.push('/operator/session')" />
      </div>
    </div>

    <!-- Checklist Content -->
    <main v-else-if="inspection" class="p-4 pb-32 space-y-4">
      <!-- Template info -->
      <div v-if="inspection.template.description" class="p-4 bg-muted/30 rounded-lg">
        <p class="text-sm">{{ inspection.template.description }}</p>
      </div>

      <!-- Checklist Items -->
      <div class="space-y-3">
        <div
          v-for="(item, index) in orderedItems"
          :key="item.id"
          class="bg-elevated rounded-lg border border-default overflow-hidden"
        >
          <!-- Item Header -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-start gap-3">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                  :class="{
                    'bg-success/20 text-success': getItemState(item.id).result === 'pass',
                    'bg-error/20 text-error': getItemState(item.id).result === 'fail',
                    'bg-warning/20 text-warning': getItemState(item.id).result === 'na',
                    'bg-muted/50 text-muted': getItemState(item.id).result === 'pending',
                  }"
                >
                  <span v-if="getItemState(item.id).result === 'pending'">{{ index + 1 }}</span>
                  <UIcon v-else-if="getItemState(item.id).result === 'pass'" name="i-lucide-check" class="w-4 h-4" />
                  <UIcon v-else-if="getItemState(item.id).result === 'fail'" name="i-lucide-x" class="w-4 h-4" />
                  <UIcon v-else name="i-lucide-minus" class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="font-medium">{{ item.label }}</h3>
                  <p v-if="item.description" class="text-sm text-muted mt-1">{{ item.description }}</p>
                  <p v-if="item.category" class="text-xs text-muted mt-1">
                    <UBadge variant="subtle" size="xs">{{ item.category }}</UBadge>
                  </p>
                </div>
              </div>
              <UBadge v-if="item.required" color="error" variant="subtle" size="xs">Required</UBadge>
            </div>

            <!-- Result Buttons -->
            <div class="flex gap-2" role="radiogroup" :aria-label="`Result for ${item.label}`">
              <UButton
                label="Pass"
                icon="i-lucide-check"
                :color="getItemState(item.id).result === 'pass' ? 'success' : 'neutral'"
                :variant="getItemState(item.id).result === 'pass' ? 'solid' : 'outline'"
                size="sm"
                class="flex-1"
                :aria-pressed="getItemState(item.id).result === 'pass'"
                @click="setItemResult(item.id, 'pass')"
              />
              <UButton
                label="Fail"
                icon="i-lucide-x"
                :color="getItemState(item.id).result === 'fail' ? 'error' : 'neutral'"
                :variant="getItemState(item.id).result === 'fail' ? 'solid' : 'outline'"
                size="sm"
                class="flex-1"
                :aria-pressed="getItemState(item.id).result === 'fail'"
                @click="setItemResult(item.id, 'fail')"
              />
              <UButton
                label="N/A"
                icon="i-lucide-minus"
                :color="getItemState(item.id).result === 'na' ? 'warning' : 'neutral'"
                :variant="getItemState(item.id).result === 'na' ? 'solid' : 'outline'"
                size="sm"
                class="flex-1"
                :aria-pressed="getItemState(item.id).result === 'na'"
                @click="setItemResult(item.id, 'na')"
              />
            </div>
          </div>

          <!-- Failed Item Requirements -->
          <div
            v-if="getItemState(item.id).result === 'fail'"
            class="border-t border-default p-4 bg-error/5 space-y-4"
          >
            <p class="text-sm text-error font-medium flex items-center gap-2">
              <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
              Photo and comment required for failed items
            </p>

            <!-- Photo Section -->
            <div>
              <label class="block text-sm font-medium mb-2">
                Photos <span class="text-error">*</span>
              </label>
              <div class="flex flex-wrap gap-2 mb-2">
                <!-- Existing photos -->
                <div
                  v-for="photo in getItemState(item.id).photos"
                  :key="photo.id"
                  class="relative w-20 h-20 rounded-lg overflow-hidden bg-muted group"
                >
                  <img :src="photo.url" :alt="photo.caption || 'Inspection photo'" class="w-full h-full object-cover" />
                  <button
                    type="button"
                    class="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                    @click="removePhoto(item.id, photo.id)"
                  >
                    <UIcon name="i-lucide-x" class="w-3 h-3 text-white" />
                  </button>
                </div>

                <!-- Add photo button -->
                <button
                  type="button"
                  class="w-20 h-20 rounded-lg border-2 border-dashed border-muted hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors"
                  @click="openPhotoModal(item.id)"
                >
                  <UIcon name="i-lucide-camera" class="w-5 h-5 text-muted" />
                  <span class="text-xs text-muted">Add</span>
                </button>
              </div>
              <p v-if="getItemState(item.id).photos.length === 0" class="text-xs text-error">
                At least one photo is required
              </p>
            </div>

            <!-- Comment Section -->
            <UFormField label="Comment" required>
              <UTextarea
                :model-value="getItemState(item.id).notes"
                placeholder="Describe the issue found..."
                :rows="3"
                @update:model-value="updateItemNotes(item.id, $event as string)"
              />
              <template #hint>
                <span v-if="!getItemState(item.id).notes.trim()" class="text-error">Comment is required</span>
              </template>
            </UFormField>
          </div>

          <!-- Optional notes for pass/na -->
          <div
            v-else-if="getItemState(item.id).result !== 'pending'"
            class="border-t border-default p-4"
          >
            <UFormField label="Notes (optional)">
              <UTextarea
                :model-value="getItemState(item.id).notes"
                placeholder="Add any notes..."
                :rows="2"
                @update:model-value="updateItemNotes(item.id, $event as string)"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </main>

    <!-- Fixed bottom action bar -->
    <footer
      v-if="inspection && inspection.status !== 'completed'"
      class="fixed bottom-0 left-0 right-0 p-4 bg-elevated border-t border-default safe-area-inset-bottom"
    >
      <div class="space-y-2">
        <!-- Validation warnings -->
        <div v-if="validationErrors.length > 0 && progress.completed > 0" class="text-xs text-warning">
          <p class="font-medium mb-1">Cannot complete yet:</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li v-for="error in validationErrors.slice(0, 3)" :key="error">{{ error }}</li>
            <li v-if="validationErrors.length > 3">...and {{ validationErrors.length - 3 }} more</li>
          </ul>
        </div>

        <UButton
          label="Complete Inspection"
          icon="i-lucide-check-circle"
          color="success"
          size="lg"
          block
          :disabled="!canComplete"
          :loading="isSubmitting"
          @click="showCompletionModal = true"
        />
      </div>
    </footer>

    <!-- Photo Modal -->
    <UModal v-model:open="showPhotoModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Add Photo</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                aria-label="Close"
                @click="showPhotoModal = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <UFormField label="Caption (optional)">
              <UInput
                v-model="photoCaption"
                placeholder="Describe what the photo shows..."
              />
            </UFormField>

            <div class="flex gap-3">
              <UButton
                label="Take Photo"
                icon="i-lucide-camera"
                color="primary"
                class="flex-1"
                @click="triggerCamera"
              />
            </div>

            <!-- Hidden file input for camera -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              capture="environment"
              class="hidden"
              @change="handleFileSelect"
            />
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Completion Modal -->
    <UModal v-model:open="showCompletionModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Complete Inspection</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                aria-label="Close"
                @click="showCompletionModal = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <!-- Summary -->
            <div class="p-4 bg-muted/30 rounded-lg">
              <div class="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p class="text-2xl font-bold text-success">
                    {{ orderedItems.filter(i => getItemState(i.id).result === 'pass').length }}
                  </p>
                  <p class="text-xs text-muted">Passed</p>
                </div>
                <div>
                  <p class="text-2xl font-bold text-error">
                    {{ orderedItems.filter(i => getItemState(i.id).result === 'fail').length }}
                  </p>
                  <p class="text-xs text-muted">Failed</p>
                </div>
                <div>
                  <p class="text-2xl font-bold text-warning">
                    {{ orderedItems.filter(i => getItemState(i.id).result === 'na').length }}
                  </p>
                  <p class="text-xs text-muted">N/A</p>
                </div>
              </div>
            </div>

            <!-- Warning if there are failures -->
            <UAlert
              v-if="orderedItems.some(i => getItemState(i.id).result === 'fail')"
              color="warning"
              icon="i-lucide-alert-triangle"
              title="Failed Items"
              description="This inspection has failed items. The asset may require attention before operation."
            />

            <UFormField label="Additional Notes (optional)">
              <UTextarea
                v-model="completionNotes"
                placeholder="Any final notes about this inspection..."
                :rows="3"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                variant="ghost"
                @click="showCompletionModal = false"
              />
              <UButton
                label="Submit Inspection"
                color="success"
                icon="i-lucide-check-circle"
                :loading="isSubmitting"
                @click="completeInspection"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.safe-area-inset-bottom {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
</style>
