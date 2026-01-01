<script setup lang="ts">
import { format, sub } from 'date-fns'

/**
 * SearchBar component for the document browser.
 * Provides search input, filter dropdowns, and keyboard shortcuts.
 */

export interface DocumentSearchFilters {
  query: string
  category: string
  fileType: string
  dateRange: {
    start: Date | null
    end: Date | null
  }
}

interface Props {
  /** Whether the search is currently loading */
  loading?: boolean
  /** Placeholder text for the search input */
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  placeholder: 'Search documents...',
})

const emit = defineEmits<{
  /** Emitted when search query or filters change */
  search: [filters: DocumentSearchFilters]
  /** Emitted when the clear button is clicked */
  clear: []
}>()

// Local filter state
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedFileType = ref('')
const selectedDateRange = ref<{ start: Date | null; end: Date | null }>({
  start: null,
  end: null,
})

// Debounced search query
const debouncedQuery = refDebounced(searchQuery, 300)

// Category options
const categoryOptions = [
  { label: 'All Categories', value: '' },
  { label: 'Registration', value: 'registration' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Certification', value: 'certification' },
  { label: 'Manual', value: 'manual' },
  { label: 'Warranty', value: 'warranty' },
  { label: 'Invoice', value: 'invoice' },
  { label: 'Contract', value: 'contract' },
  { label: 'Report', value: 'report' },
  { label: 'Other', value: 'other' },
]

// File type options
const fileTypeOptions = [
  { label: 'All Types', value: '' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Word', value: 'word' },
  { label: 'Excel', value: 'excel' },
  { label: 'PowerPoint', value: 'powerpoint' },
  { label: 'Images', value: 'image' },
  { label: 'Text', value: 'text' },
  { label: 'Other', value: 'other' },
]

// Date range presets
const dateRangePresets = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

// Date range display text
const dateRangeDisplayText = computed(() => {
  if (selectedDateRange.value.start && selectedDateRange.value.end) {
    return `${format(selectedDateRange.value.start, 'dd MMM yyyy')} - ${format(selectedDateRange.value.end, 'dd MMM yyyy')}`
  }
  if (selectedDateRange.value.start) {
    return format(selectedDateRange.value.start, 'dd MMM yyyy')
  }
  return 'Date Range'
})

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return !!(
    searchQuery.value ||
    selectedCategory.value ||
    selectedFileType.value ||
    selectedDateRange.value.start ||
    selectedDateRange.value.end
  )
})

// Build and emit current filters
const emitSearch = () => {
  const filters: DocumentSearchFilters = {
    query: debouncedQuery.value,
    category: selectedCategory.value,
    fileType: selectedFileType.value,
    dateRange: {
      start: selectedDateRange.value.start,
      end: selectedDateRange.value.end,
    },
  }
  emit('search', filters)
}

// Watch for changes and emit
watch(
  [debouncedQuery, selectedCategory, selectedFileType, selectedDateRange],
  () => {
    emitSearch()
  },
  { deep: true },
)

// Select a date range preset
const selectDateRangePreset = (preset: { days: number }) => {
  const endDate = new Date()
  let startDate: Date

  if (preset.days === 0) {
    // Today
    startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
  } else {
    startDate = sub(endDate, { days: preset.days })
  }

  selectedDateRange.value = {
    start: startDate,
    end: endDate,
  }
}

// Clear date range
const clearDateRange = () => {
  selectedDateRange.value = { start: null, end: null }
}

// Clear all filters
const clearAllFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedFileType.value = ''
  selectedDateRange.value = { start: null, end: null }
  emit('clear')
}

// Handle Enter key - emit search immediately
const handleEnterKey = () => {
  // Force immediate emit on Enter key
  const filters: DocumentSearchFilters = {
    query: searchQuery.value,
    category: selectedCategory.value,
    fileType: selectedFileType.value,
    dateRange: {
      start: selectedDateRange.value.start,
      end: selectedDateRange.value.end,
    },
  }
  emit('search', filters)
}

// Handle Escape key - clear all filters
const handleEscapeKey = () => {
  clearAllFilters()
}

// Keyboard event handlers
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleEscapeKey()
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Main filter row -->
    <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
      <!-- Search input -->
      <div class="relative flex-1 min-w-[200px]">
        <UInput
          v-model="searchQuery"
          :placeholder="placeholder"
          icon="i-lucide-search"
          class="w-full"
          :disabled="loading"
          :ui="{
            trailing: 'pointer-events-auto',
          }"
          aria-label="Search documents"
          @keydown.enter="handleEnterKey"
          @keydown.escape="handleEscapeKey"
        >
          <template v-if="searchQuery" #trailing>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :padded="false"
              aria-label="Clear search"
              @click="searchQuery = ''"
            />
          </template>
        </UInput>
      </div>

      <!-- Category filter -->
      <USelect
        v-model="selectedCategory"
        :items="categoryOptions"
        placeholder="Category"
        class="w-full sm:w-40"
        :disabled="loading"
        :ui="{
          trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
        }"
        aria-label="Filter by category"
      />

      <!-- File type filter -->
      <USelect
        v-model="selectedFileType"
        :items="fileTypeOptions"
        placeholder="File Type"
        class="w-full sm:w-36"
        :disabled="loading"
        :ui="{
          trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
        }"
        aria-label="Filter by file type"
      />

      <!-- Date range filter -->
      <UPopover :content="{ align: 'end' }" :modal="true">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar"
          class="justify-start w-full sm:w-auto min-w-[140px] data-[state=open]:bg-elevated group"
          :disabled="loading"
          aria-label="Filter by date range"
        >
          <span class="truncate text-left flex-1">
            {{ dateRangeDisplayText }}
          </span>

          <template #trailing>
            <UIcon
              v-if="selectedDateRange.start || selectedDateRange.end"
              name="i-lucide-x"
              class="shrink-0 text-muted size-4 hover:text-foreground"
              role="button"
              aria-label="Clear date range"
              @click.stop="clearDateRange"
            />
            <UIcon
              v-else
              name="i-lucide-chevron-down"
              class="shrink-0 text-muted size-4 group-data-[state=open]:rotate-180 transition-transform duration-200"
            />
          </template>
        </UButton>

        <template #content>
          <div class="p-2 min-w-[200px]">
            <div class="space-y-1">
              <UButton
                v-for="preset in dateRangePresets"
                :key="preset.days"
                :label="preset.label"
                color="neutral"
                variant="ghost"
                class="w-full justify-start"
                @click="selectDateRangePreset(preset)"
              />
            </div>
            <USeparator class="my-2" />
            <div class="space-y-2">
              <div>
                <label class="text-xs text-muted mb-1 block">From</label>
                <UInput
                  :model-value="selectedDateRange.start ? format(selectedDateRange.start, 'yyyy-MM-dd') : ''"
                  type="date"
                  class="w-full"
                  @update:model-value="(v: string) => selectedDateRange.start = v ? new Date(v) : null"
                />
              </div>
              <div>
                <label class="text-xs text-muted mb-1 block">To</label>
                <UInput
                  :model-value="selectedDateRange.end ? format(selectedDateRange.end, 'yyyy-MM-dd') : ''"
                  type="date"
                  class="w-full"
                  @update:model-value="(v: string) => selectedDateRange.end = v ? new Date(v) : null"
                />
              </div>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- Clear all button -->
      <UButton
        v-if="hasActiveFilters"
        label="Clear"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :disabled="loading"
        aria-label="Clear all filters"
        @click="clearAllFilters"
      />
    </div>

    <!-- Active filters display -->
    <div
      v-if="hasActiveFilters"
      class="flex flex-wrap gap-2"
      role="status"
      aria-live="polite"
    >
      <UBadge
        v-if="searchQuery"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-search" class="size-3" />
          "{{ searchQuery }}"
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            aria-label="Remove search filter"
            @click="searchQuery = ''"
          />
        </span>
      </UBadge>

      <UBadge
        v-if="selectedCategory"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          Category: {{ categoryOptions.find(c => c.value === selectedCategory)?.label }}
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            aria-label="Remove category filter"
            @click="selectedCategory = ''"
          />
        </span>
      </UBadge>

      <UBadge
        v-if="selectedFileType"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          Type: {{ fileTypeOptions.find(t => t.value === selectedFileType)?.label }}
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            aria-label="Remove file type filter"
            @click="selectedFileType = ''"
          />
        </span>
      </UBadge>

      <UBadge
        v-if="selectedDateRange.start || selectedDateRange.end"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="size-3" />
          {{ dateRangeDisplayText }}
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            aria-label="Remove date filter"
            @click="clearDateRange"
          />
        </span>
      </UBadge>
    </div>
  </div>
</template>
