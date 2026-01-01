<script setup lang="ts">
/**
 * Field Selector Component for Report Builder
 *
 * Displays available fields based on entity type,
 * allows selecting/deselecting fields, and supports
 * reordering selected fields via drag-and-drop.
 */
import type { FieldDefinition, FieldType } from '~/composables/useReportBuilder'

interface Props {
  /** All available fields for the current entity type */
  availableFields: FieldDefinition[]
  /** Currently selected field keys (ordered) */
  selectedFields: string[]
  /** Disable interaction */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'add-field': [fieldKey: string]
  'remove-field': [fieldKey: string]
  'reorder-fields': [fromIndex: number, toIndex: number]
}>()

// Local state for drag-and-drop
const draggedIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

// Computed: unselected fields (available but not yet selected)
const unselectedFields = computed(() => {
  return props.availableFields.filter((field) => !props.selectedFields.includes(field.key))
})

// Computed: selected field definitions with their index
const selectedFieldDefinitions = computed(() => {
  return props.selectedFields
    .map((key, index) => {
      const field = props.availableFields.find((f) => f.key === key)
      return field ? { ...field, index } : null
    })
    .filter((f): f is FieldDefinition & { index: number } => f !== null)
})

// Get icon for field type
function getFieldTypeIcon(type: FieldType): string {
  switch (type) {
    case 'string':
      return 'i-lucide-text'
    case 'number':
      return 'i-lucide-hash'
    case 'boolean':
      return 'i-lucide-toggle-left'
    case 'date':
      return 'i-lucide-calendar'
    case 'uuid':
      return 'i-lucide-key'
    default:
      return 'i-lucide-circle'
  }
}

// Get color for field type badge
function getFieldTypeColor(type: FieldType): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (type) {
    case 'string':
      return 'info'
    case 'number':
      return 'success'
    case 'boolean':
      return 'warning'
    case 'date':
      return 'neutral'
    case 'uuid':
      return 'neutral'
    default:
      return 'neutral'
  }
}

// Handle field click to toggle selection
function handleFieldClick(field: FieldDefinition) {
  if (props.disabled) return

  if (props.selectedFields.includes(field.key)) {
    emit('remove-field', field.key)
  } else {
    emit('add-field', field.key)
  }
}

// Handle select all unselected fields
function selectAll() {
  if (props.disabled) return

  for (const field of unselectedFields.value) {
    emit('add-field', field.key)
  }
}

// Handle clear all selected fields
function clearAll() {
  if (props.disabled) return

  for (const key of props.selectedFields) {
    emit('remove-field', key)
  }
}

// Drag and drop handlers
function handleDragStart(index: number) {
  if (props.disabled) return
  draggedIndex.value = index
}

function handleDragOver(event: DragEvent, index: number) {
  if (props.disabled) return
  event.preventDefault()
  dropTargetIndex.value = index
}

function handleDragLeave() {
  dropTargetIndex.value = null
}

function handleDrop(targetIndex: number) {
  if (props.disabled) return

  if (draggedIndex.value !== null && draggedIndex.value !== targetIndex) {
    emit('reorder-fields', draggedIndex.value, targetIndex)
  }

  draggedIndex.value = null
  dropTargetIndex.value = null
}

function handleDragEnd() {
  draggedIndex.value = null
  dropTargetIndex.value = null
}
</script>

<template>
  <div class="field-selector space-y-4">
    <!-- Selected Fields Section -->
    <div class="selected-fields">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-medium text-highlighted flex items-center gap-2">
          <UIcon name="i-lucide-check-square" class="size-4" />
          Selected Fields
          <UBadge v-if="selectedFields.length > 0" color="primary" size="xs">
            {{ selectedFields.length }}
          </UBadge>
        </h4>
        <UButton
          v-if="selectedFields.length > 0"
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-x"
          :disabled="disabled"
          @click="clearAll"
        >
          Clear All
        </UButton>
      </div>

      <div
        v-if="selectedFieldDefinitions.length > 0"
        class="border border-default rounded-lg divide-y divide-default bg-elevated/30"
        role="list"
        aria-label="Selected fields, drag to reorder"
      >
        <div
          v-for="field in selectedFieldDefinitions"
          :key="field.key"
          class="flex items-center gap-3 p-3 hover:bg-elevated/50 transition-colors"
          :class="{
            'opacity-50': draggedIndex === field.index,
            'border-t-2 border-primary': dropTargetIndex === field.index && draggedIndex !== field.index,
            'cursor-move': !disabled,
            'cursor-not-allowed opacity-60': disabled,
          }"
          role="listitem"
          :draggable="!disabled"
          @dragstart="handleDragStart(field.index)"
          @dragover="handleDragOver($event, field.index)"
          @dragleave="handleDragLeave"
          @drop="handleDrop(field.index)"
          @dragend="handleDragEnd"
        >
          <!-- Drag handle -->
          <UIcon
            name="i-lucide-grip-vertical"
            class="size-4 text-muted shrink-0"
            aria-hidden="true"
          />

          <!-- Field type icon -->
          <UIcon
            :name="getFieldTypeIcon(field.type)"
            class="size-4 text-muted shrink-0"
            aria-hidden="true"
          />

          <!-- Field info -->
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-highlighted truncate block">
              {{ field.label }}
            </span>
            <span v-if="field.description" class="text-xs text-muted truncate block">
              {{ field.description }}
            </span>
          </div>

          <!-- Field type badge -->
          <UBadge :color="getFieldTypeColor(field.type)" variant="subtle" size="xs">
            {{ field.type }}
          </UBadge>

          <!-- Remove button -->
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="disabled"
            aria-label="Remove field"
            @click.stop="emit('remove-field', field.key)"
          />
        </div>
      </div>

      <div
        v-else
        class="border border-dashed border-default rounded-lg p-6 text-center text-muted"
      >
        <UIcon name="i-lucide-columns-3" class="size-8 mx-auto mb-2 opacity-50" />
        <p class="text-sm">No fields selected</p>
        <p class="text-xs mt-1">Select fields from the available list below</p>
      </div>
    </div>

    <!-- Available Fields Section -->
    <div class="available-fields">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-medium text-highlighted flex items-center gap-2">
          <UIcon name="i-lucide-list" class="size-4" />
          Available Fields
          <UBadge v-if="unselectedFields.length > 0" color="neutral" size="xs">
            {{ unselectedFields.length }}
          </UBadge>
        </h4>
        <UButton
          v-if="unselectedFields.length > 0"
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-check-check"
          :disabled="disabled"
          @click="selectAll"
        >
          Select All
        </UButton>
      </div>

      <div
        v-if="unselectedFields.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 gap-2"
        role="list"
        aria-label="Available fields"
      >
        <button
          v-for="field in unselectedFields"
          :key="field.key"
          type="button"
          class="flex items-center gap-3 p-3 border border-default rounded-lg hover:bg-elevated/50 hover:border-primary transition-colors text-left"
          :class="{
            'cursor-pointer': !disabled,
            'cursor-not-allowed opacity-60': disabled,
          }"
          :disabled="disabled"
          role="listitem"
          :aria-label="`Add ${field.label} field`"
          @click="handleFieldClick(field)"
        >
          <!-- Field type icon -->
          <UIcon
            :name="getFieldTypeIcon(field.type)"
            class="size-4 text-muted shrink-0"
            aria-hidden="true"
          />

          <!-- Field info -->
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-highlighted truncate block">
              {{ field.label }}
            </span>
            <span v-if="field.description" class="text-xs text-muted truncate block">
              {{ field.description }}
            </span>
          </div>

          <!-- Field type badge -->
          <UBadge :color="getFieldTypeColor(field.type)" variant="subtle" size="xs">
            {{ field.type }}
          </UBadge>

          <!-- Add icon -->
          <UIcon
            name="i-lucide-plus"
            class="size-4 text-primary shrink-0"
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        v-else
        class="border border-dashed border-default rounded-lg p-4 text-center text-muted"
      >
        <p class="text-sm">All fields are selected</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Drag and drop visual feedback */
.field-selector [draggable='true']:active {
  cursor: grabbing;
}
</style>
