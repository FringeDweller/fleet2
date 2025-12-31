<script setup lang="ts">
/**
 * ConflictModal Component (fleet2-0gxp)
 * Modal for displaying sync conflicts to users.
 * Shows local vs server versions side by side.
 * Allows users to choose: keep local, keep server, or merge.
 * Uses Nuxt UI UModal component and integrates with conflict-resolver.ts utility.
 */

import {
  type ConflictDetectionResult,
  ConflictType,
  detectConflict,
  type FieldConflict,
  resolveConflict,
} from '~/utils/conflict-resolver'

interface SyncConflict {
  id: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  localData: Record<string, unknown>
  serverData: Record<string, unknown> | null
  conflictResolution: 'client_wins' | 'server_wins' | 'manual' | 'merge' | null
  createdAt: string
}

interface Props {
  /** Whether the modal is open */
  open: boolean
  /** List of conflicts to display */
  conflicts: SyncConflict[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Emitted when a conflict is resolved with the resolution choice */
  resolved: [
    conflictId: string,
    resolution: 'local' | 'server' | 'merge',
    resolvedData: Record<string, unknown>,
  ]
  /** Emitted when all conflicts are resolved */
  allResolved: []
}>()

// Currently selected conflict index
const currentIndex = ref(0)

// Resolution mode for the current conflict
type ResolutionMode = 'choose' | 'merge'
const resolutionMode = ref<ResolutionMode>('choose')

// Track field selections when in merge mode
const fieldSelections = ref<Record<string, 'local' | 'server'>>({})

// Computed: current conflict being displayed
const currentConflict = computed(() => props.conflicts[currentIndex.value] ?? null)

// Computed: detect conflicts between local and server data
const conflictDetection = computed<ConflictDetectionResult<Record<string, unknown>> | null>(() => {
  if (!currentConflict.value) return null
  if (!currentConflict.value.serverData) return null

  return detectConflict(currentConflict.value.localData, currentConflict.value.serverData)
})

// Computed: field-level conflicts
const fieldConflicts = computed<FieldConflict[]>(() => {
  return conflictDetection.value?.conflicts ?? []
})

// Computed: fields that only changed locally
const localOnlyFields = computed<string[]>(() => {
  return conflictDetection.value?.localOnlyChanges ?? []
})

// Computed: fields that only changed on server
const serverOnlyFields = computed<string[]>(() => {
  return conflictDetection.value?.serverOnlyChanges ?? []
})

// Computed: all fields to display (conflicts + changes)
const allFields = computed<string[]>(() => {
  if (!currentConflict.value) return []

  const local = currentConflict.value.localData
  const server = currentConflict.value.serverData ?? {}
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)])

  // Filter out internal fields
  const excludeFields = ['id', 'createdAt', 'updatedAt', 'organisationId', 'userId']
  return Array.from(allKeys).filter((key) => !excludeFields.includes(key))
})

// Computed: whether current conflict has real conflicts
const hasConflicts = computed(() => {
  return conflictDetection.value?.hasConflict ?? false
})

// Computed: entity type display name
const entityTypeLabel = computed(() => {
  if (!currentConflict.value) return ''

  const labels: Record<string, string> = {
    asset: 'Asset',
    workOrder: 'Work Order',
    part: 'Part',
    inspection: 'Inspection',
    defect: 'Defect',
  }

  return labels[currentConflict.value.entityType] ?? currentConflict.value.entityType
})

// Computed: operation display name and color
const operationInfo = computed(() => {
  if (!currentConflict.value) return { label: '', color: 'neutral' as const }

  const info: Record<string, { label: string; color: 'success' | 'warning' | 'error' }> = {
    create: { label: 'Create', color: 'success' },
    update: { label: 'Update', color: 'warning' },
    delete: { label: 'Delete', color: 'error' },
  }

  return (
    info[currentConflict.value.operation] ?? {
      label: currentConflict.value.operation,
      color: 'neutral' as const,
    }
  )
})

// Check if a field has a conflict
function isFieldConflict(fieldName: string): boolean {
  return fieldConflicts.value.some((c) => c.fieldName === fieldName)
}

// Get the conflict for a field
function getFieldConflict(fieldName: string): FieldConflict | undefined {
  return fieldConflicts.value.find((c) => c.fieldName === fieldName)
}

// Get field value for display
function getFieldValue(data: Record<string, unknown> | null, fieldName: string): string {
  if (!data) return '(not available)'

  const value = data[fieldName]
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// Get field label (human-readable)
function getFieldLabel(fieldName: string): string {
  // Convert camelCase to Title Case with spaces
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

// Check if field is selected as local in merge mode
function isFieldLocal(fieldName: string): boolean {
  return fieldSelections.value[fieldName] === 'local'
}

// Check if field is selected as server in merge mode
function isFieldServer(fieldName: string): boolean {
  return fieldSelections.value[fieldName] === 'server'
}

// Toggle field selection in merge mode
function toggleFieldSelection(fieldName: string) {
  if (fieldSelections.value[fieldName] === 'local') {
    fieldSelections.value[fieldName] = 'server'
  } else {
    fieldSelections.value[fieldName] = 'local'
  }
}

// Initialize field selections when entering merge mode
function initFieldSelections() {
  fieldSelections.value = {}

  // For conflicting fields, default to server
  for (const conflict of fieldConflicts.value) {
    fieldSelections.value[conflict.fieldName] = 'server'
  }
}

// Handle "Keep Local" action
function handleKeepLocal() {
  if (!currentConflict.value) return

  const resolved = resolveConflict(
    currentConflict.value.localData,
    currentConflict.value.serverData ?? {},
    ConflictType.LOCAL_WINS,
  )

  emit('resolved', currentConflict.value.id, 'local', resolved.resolved)
  moveToNextConflict()
}

// Handle "Keep Server" action
function handleKeepServer() {
  if (!currentConflict.value) return

  const resolved = resolveConflict(
    currentConflict.value.localData,
    currentConflict.value.serverData ?? {},
    ConflictType.SERVER_WINS,
  )

  emit('resolved', currentConflict.value.id, 'server', resolved.resolved)
  moveToNextConflict()
}

// Handle entering merge mode
function handleMerge() {
  resolutionMode.value = 'merge'
  initFieldSelections()
}

// Handle confirming merge
function handleConfirmMerge() {
  if (!currentConflict.value) return

  // Build merged data based on field selections
  const mergedData: Record<string, unknown> = {}
  const local = currentConflict.value.localData
  const server = currentConflict.value.serverData ?? {}

  for (const field of allFields.value) {
    if (fieldSelections.value[field] === 'local') {
      mergedData[field] = local[field]
    } else {
      mergedData[field] = server[field]
    }
  }

  // Include id and other required fields from local
  mergedData.id = local.id

  emit('resolved', currentConflict.value.id, 'merge', mergedData)
  resolutionMode.value = 'choose'
  moveToNextConflict()
}

// Handle canceling merge
function handleCancelMerge() {
  resolutionMode.value = 'choose'
  fieldSelections.value = {}
}

// Move to the next conflict or close if done
function moveToNextConflict() {
  if (currentIndex.value < props.conflicts.length - 1) {
    currentIndex.value++
    resolutionMode.value = 'choose'
    fieldSelections.value = {}
  } else {
    emit('allResolved')
    handleClose()
  }
}

// Navigate to previous conflict
function handlePrevious() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    resolutionMode.value = 'choose'
    fieldSelections.value = {}
  }
}

// Navigate to next conflict (skip)
function handleSkip() {
  if (currentIndex.value < props.conflicts.length - 1) {
    currentIndex.value++
    resolutionMode.value = 'choose'
    fieldSelections.value = {}
  }
}

// Handle modal close
function handleClose() {
  emit('update:open', false)
  currentIndex.value = 0
  resolutionMode.value = 'choose'
  fieldSelections.value = {}
}

// Reset when conflicts change
watch(
  () => props.conflicts,
  () => {
    currentIndex.value = 0
    resolutionMode.value = 'choose'
    fieldSelections.value = {}
  },
)
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-4xl' }"
    @update:open="handleClose"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-git-merge" class="size-5 text-warning" />
          <span class="font-semibold">Sync Conflict Resolution</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-muted">
          <span>{{ currentIndex + 1 }} of {{ conflicts.length }}</span>
          <UBadge :color="operationInfo.color" variant="subtle" size="xs">
            {{ operationInfo.label }}
          </UBadge>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="currentConflict" class="space-y-4">
        <!-- Conflict Overview -->
        <div class="flex items-center gap-3 p-3 bg-warning-50 dark:bg-warning-950/30 rounded-lg border border-warning-200 dark:border-warning-800">
          <UIcon name="i-lucide-alert-triangle" class="size-5 text-warning shrink-0" />
          <div class="flex-1">
            <p class="font-medium text-warning-800 dark:text-warning-200">
              Conflict detected for {{ entityTypeLabel }}
            </p>
            <p class="text-sm text-warning-700 dark:text-warning-300">
              <template v-if="currentConflict.serverData">
                The {{ entityTypeLabel.toLowerCase() }} has been modified on both your device and the server.
                Choose how to resolve this conflict.
              </template>
              <template v-else>
                This {{ entityTypeLabel.toLowerCase() }} exists locally but not on the server.
              </template>
            </p>
          </div>
        </div>

        <!-- Entity Info -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-muted">Entity ID:</span>
          <code class="px-2 py-0.5 bg-muted rounded text-xs">{{ currentConflict.entityId }}</code>
          <span class="text-muted ml-2">Created:</span>
          <span>{{ new Date(currentConflict.createdAt).toLocaleString() }}</span>
        </div>

        <!-- Comparison View -->
        <div v-if="currentConflict.serverData" class="border border-default rounded-lg overflow-hidden">
          <!-- Header Row -->
          <div class="grid grid-cols-3 bg-elevated border-b border-default">
            <div class="px-4 py-2 font-medium text-sm">Field</div>
            <div class="px-4 py-2 font-medium text-sm border-l border-default">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-smartphone" class="size-4 text-info" />
                Local (Your Device)
              </div>
            </div>
            <div class="px-4 py-2 font-medium text-sm border-l border-default">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-cloud" class="size-4 text-primary" />
                Server
              </div>
            </div>
          </div>

          <!-- Field Rows -->
          <div class="divide-y divide-default max-h-80 overflow-y-auto">
            <div
              v-for="fieldName in allFields"
              :key="fieldName"
              :class="[
                'grid grid-cols-3 text-sm',
                isFieldConflict(fieldName) ? 'bg-warning-50 dark:bg-warning-950/20' : '',
                resolutionMode === 'merge' && isFieldConflict(fieldName) ? 'cursor-pointer hover:bg-warning-100 dark:hover:bg-warning-950/40' : '',
              ]"
              @click="resolutionMode === 'merge' && isFieldConflict(fieldName) ? toggleFieldSelection(fieldName) : undefined"
            >
              <!-- Field Name -->
              <div class="px-4 py-2 flex items-center gap-2">
                <span :class="isFieldConflict(fieldName) ? 'font-medium text-warning-700 dark:text-warning-300' : ''">
                  {{ getFieldLabel(fieldName) }}
                </span>
                <UIcon
                  v-if="isFieldConflict(fieldName)"
                  name="i-lucide-alert-circle"
                  class="size-3.5 text-warning"
                />
              </div>

              <!-- Local Value -->
              <div
                :class="[
                  'px-4 py-2 border-l border-default font-mono text-xs break-all',
                  resolutionMode === 'merge' && isFieldConflict(fieldName)
                    ? isFieldLocal(fieldName)
                      ? 'bg-info-100 dark:bg-info-900/30 ring-2 ring-info-500 ring-inset'
                      : 'opacity-50'
                    : '',
                ]"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    v-if="resolutionMode === 'merge' && isFieldConflict(fieldName) && isFieldLocal(fieldName)"
                    name="i-lucide-check-circle"
                    class="size-4 text-info shrink-0"
                  />
                  <span>{{ getFieldValue(currentConflict.localData, fieldName) }}</span>
                </div>
              </div>

              <!-- Server Value -->
              <div
                :class="[
                  'px-4 py-2 border-l border-default font-mono text-xs break-all',
                  resolutionMode === 'merge' && isFieldConflict(fieldName)
                    ? isFieldServer(fieldName)
                      ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500 ring-inset'
                      : 'opacity-50'
                    : '',
                ]"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    v-if="resolutionMode === 'merge' && isFieldConflict(fieldName) && isFieldServer(fieldName)"
                    name="i-lucide-check-circle"
                    class="size-4 text-primary shrink-0"
                  />
                  <span>{{ getFieldValue(currentConflict.serverData, fieldName) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Server Data View -->
        <div v-else class="border border-default rounded-lg p-4">
          <p class="text-muted mb-3">Local changes to apply:</p>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="fieldName in allFields"
              :key="fieldName"
              class="flex items-start gap-2 text-sm"
            >
              <span class="font-medium min-w-32">{{ getFieldLabel(fieldName) }}:</span>
              <span class="font-mono text-xs break-all">
                {{ getFieldValue(currentConflict.localData, fieldName) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Merge Mode Instructions -->
        <div
          v-if="resolutionMode === 'merge' && hasConflicts"
          class="p-3 bg-info-50 dark:bg-info-950/30 rounded-lg border border-info-200 dark:border-info-800"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-info" class="size-4 text-info shrink-0" />
            <p class="text-sm text-info-800 dark:text-info-200">
              Click on conflicting fields to toggle between local and server values.
            </p>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-12">
        <UIcon name="i-lucide-check-circle" class="size-12 text-success mb-4" />
        <p class="text-lg font-medium">No Conflicts</p>
        <p class="text-muted">All changes are synchronized.</p>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full gap-4">
        <!-- Navigation -->
        <div class="flex items-center gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-chevron-left"
            :disabled="currentIndex === 0"
            @click="handlePrevious"
          >
            Previous
          </UButton>
          <UButton
            v-if="currentIndex < conflicts.length - 1"
            variant="ghost"
            color="neutral"
            trailing-icon="i-lucide-chevron-right"
            @click="handleSkip"
          >
            Skip
          </UButton>
        </div>

        <!-- Actions -->
        <div v-if="currentConflict" class="flex items-center gap-2">
          <template v-if="resolutionMode === 'choose'">
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-smartphone"
              @click="handleKeepLocal"
            >
              Keep Local
            </UButton>
            <UButton
              v-if="currentConflict.serverData"
              variant="outline"
              color="neutral"
              icon="i-lucide-cloud"
              @click="handleKeepServer"
            >
              Keep Server
            </UButton>
            <UButton
              v-if="currentConflict.serverData && hasConflicts"
              color="primary"
              icon="i-lucide-git-merge"
              @click="handleMerge"
            >
              Merge Changes
            </UButton>
          </template>

          <template v-else>
            <UButton
              variant="ghost"
              color="neutral"
              @click="handleCancelMerge"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-check"
              @click="handleConfirmMerge"
            >
              Confirm Merge
            </UButton>
          </template>
        </div>

        <UButton
          v-else
          color="primary"
          @click="handleClose"
        >
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>
