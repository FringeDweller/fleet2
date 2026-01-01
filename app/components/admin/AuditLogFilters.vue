<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone, today } from '@internationalized/date'
import type { AuditLogFilters } from '~/composables/useAuditLog'

/**
 * Emitted filter changes from the audit log filters component
 */
const emit = defineEmits<{
  /** Emitted when any filter value changes */
  'update:filters': [filters: AuditLogFilters]
}>()

const props = defineProps<{
  /** Current filter values */
  filters: AuditLogFilters
  /** Whether filters are loading */
  loading?: boolean
}>()

// Date formatter for display
const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

// Predefined date ranges
const dateRanges = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

// Entity types commonly found in the audit log
const entityTypeOptions = [
  { value: '', label: 'All Entity Types' },
  { value: 'asset', label: 'Assets' },
  { value: 'user', label: 'Users' },
  { value: 'work_order', label: 'Work Orders' },
  { value: 'part', label: 'Parts' },
  { value: 'inspection', label: 'Inspections' },
  { value: 'document', label: 'Documents' },
  { value: 'fuel', label: 'Fuel Transactions' },
  { value: 'operator', label: 'Operators' },
  { value: 'organisation', label: 'Organisation' },
  { value: 'role', label: 'Roles' },
  { value: 'schedule', label: 'Maintenance Schedules' },
  { value: 'geofence', label: 'Geofences' },
  { value: 'form', label: 'Custom Forms' },
]

// Action types based on AuditAction from audit-logger.ts
const actionTypeOptions = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'view', label: 'View' },
  { value: 'export', label: 'Export' },
  { value: 'import', label: 'Import' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'assign', label: 'Assign' },
  { value: 'unassign', label: 'Unassign' },
  { value: 'archive', label: 'Archive' },
  { value: 'restore', label: 'Restore' },
  { value: 'upload', label: 'Upload' },
  { value: 'download', label: 'Download' },
  { value: 'move', label: 'Move' },
  { value: 'link', label: 'Link' },
  { value: 'unlink', label: 'Unlink' },
  { value: 'override', label: 'Override' },
  { value: 'clear', label: 'Clear' },
  { value: 'revert', label: 'Revert' },
]

// Local filter state
const selectedEntityType = ref(props.filters.entityType || '')
const selectedAction = ref(props.filters.action || '')
const selectedUserId = ref(props.filters.userId || '')

// Date range state
const selectedDateRange = ref<{ start: Date | undefined; end: Date | undefined }>({
  start: props.filters.startDate ? new Date(props.filters.startDate) : undefined,
  end: props.filters.endDate ? new Date(props.filters.endDate) : undefined,
})

// User search
const userSearchQuery = ref('')
const selectedUserDisplay = ref<{ id: string; name: string; email: string } | null>(null)

// Fetch users for selector
const { data: usersData, status: usersStatus } = await useFetch<{
  data: Array<{
    id: string
    name: string
    email: string
    firstName: string
    lastName: string
    avatar: { src?: string }
  }>
}>('/api/admin/users', {
  query: {
    limit: 100,
    status: 'all',
  },
  default: () => ({ data: [] }),
})

// Format users for select dropdown
const userOptions = computed(() => {
  const users = usersData.value?.data || []
  return [
    { value: '', label: 'All Users' },
    ...users.map((u) => ({
      value: u.id,
      label: u.name || `${u.firstName} ${u.lastName}`.trim() || u.email,
    })),
  ]
})

// Convert Date to CalendarDate for the calendar component
const toCalendarDate = (date: Date) => {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

// Calendar range for UCalendar component
const calendarRange = computed({
  get: () => ({
    start: selectedDateRange.value.start
      ? toCalendarDate(selectedDateRange.value.start)
      : undefined,
    end: selectedDateRange.value.end ? toCalendarDate(selectedDateRange.value.end) : undefined,
  }),
  set: (newValue: { start: CalendarDate | null; end: CalendarDate | null }) => {
    selectedDateRange.value = {
      start: newValue.start ? newValue.start.toDate(getLocalTimeZone()) : undefined,
      end: newValue.end ? newValue.end.toDate(getLocalTimeZone()) : undefined,
    }
  },
})

// Check if a predefined range is currently selected
const isRangeSelected = (range: { days: number }) => {
  if (!selectedDateRange.value.start || !selectedDateRange.value.end) return false

  const currentDate = today(getLocalTimeZone())
  let startDate = currentDate.copy()

  if (range.days > 0) {
    startDate = startDate.subtract({ days: range.days })
  }

  const selectedStart = toCalendarDate(selectedDateRange.value.start)
  const selectedEnd = toCalendarDate(selectedDateRange.value.end)

  return selectedStart.compare(startDate) === 0 && selectedEnd.compare(currentDate) === 0
}

// Select a predefined date range
const selectRange = (range: { days: number }) => {
  const endDate = today(getLocalTimeZone())
  let startDate = endDate.copy()

  if (range.days > 0) {
    startDate = startDate.subtract({ days: range.days })
  }

  selectedDateRange.value = {
    start: startDate.toDate(getLocalTimeZone()),
    end: endDate.toDate(getLocalTimeZone()),
  }
}

// Display text for the date range button
const dateRangeDisplayText = computed(() => {
  if (selectedDateRange.value.start && selectedDateRange.value.end) {
    return `${df.format(selectedDateRange.value.start)} - ${df.format(selectedDateRange.value.end)}`
  }
  if (selectedDateRange.value.start) {
    return df.format(selectedDateRange.value.start)
  }
  return 'Pick a date range'
})

// Emit filter changes whenever local values change
const emitFilters = () => {
  const filters: AuditLogFilters = {}

  if (selectedAction.value) {
    filters.action = selectedAction.value
  }
  if (selectedEntityType.value) {
    filters.entityType = selectedEntityType.value
  }
  if (selectedUserId.value) {
    filters.userId = selectedUserId.value
  }
  if (selectedDateRange.value.start) {
    filters.startDate = selectedDateRange.value.start.toISOString().split('T')[0]
  }
  if (selectedDateRange.value.end) {
    filters.endDate = selectedDateRange.value.end.toISOString().split('T')[0]
  }

  emit('update:filters', filters)
}

// Watch for changes and emit
watch(
  [selectedAction, selectedEntityType, selectedUserId, selectedDateRange],
  () => {
    emitFilters()
  },
  { deep: true },
)

// Clear all filters
const clearFilters = () => {
  selectedAction.value = ''
  selectedEntityType.value = ''
  selectedUserId.value = ''
  selectedDateRange.value = { start: undefined, end: undefined }
}

// Clear date range
const clearDateRange = () => {
  selectedDateRange.value = { start: undefined, end: undefined }
}

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return !!(
    selectedAction.value ||
    selectedEntityType.value ||
    selectedUserId.value ||
    selectedDateRange.value.start ||
    selectedDateRange.value.end
  )
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Filter row -->
    <div class="flex flex-col sm:flex-row flex-wrap gap-3">
      <!-- Date Range Picker -->
      <UPopover :content="{ align: 'start' }" :modal="true">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar"
          class="justify-start data-[state=open]:bg-elevated group min-w-[200px]"
          :disabled="loading"
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
              :aria-label="'Clear date range'"
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
          <div class="flex items-stretch sm:divide-x divide-default">
            <div class="hidden sm:flex flex-col justify-center py-2">
              <UButton
                v-for="(range, index) in dateRanges"
                :key="index"
                :label="range.label"
                color="neutral"
                variant="ghost"
                class="rounded-none px-4"
                :class="[isRangeSelected(range) ? 'bg-elevated' : 'hover:bg-elevated/50']"
                truncate
                @click="selectRange(range)"
              />
            </div>

            <UCalendar
              v-model="calendarRange"
              class="p-2"
              :number-of-months="2"
              range
            />
          </div>
        </template>
      </UPopover>

      <!-- Entity Type Filter -->
      <USelect
        v-model="selectedEntityType"
        :items="entityTypeOptions"
        placeholder="All Entity Types"
        class="w-full sm:w-48"
        :disabled="loading"
        :ui="{
          trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
        }"
      />

      <!-- User Filter -->
      <USelect
        v-model="selectedUserId"
        :items="userOptions"
        placeholder="All Users"
        class="w-full sm:w-56"
        :disabled="loading || usersStatus === 'pending'"
        :ui="{
          trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
        }"
      />

      <!-- Action Type Filter -->
      <USelect
        v-model="selectedAction"
        :items="actionTypeOptions"
        placeholder="All Actions"
        class="w-full sm:w-40"
        :disabled="loading"
        :ui="{
          trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
        }"
      />

      <!-- Clear Filters Button -->
      <UButton
        v-if="hasActiveFilters"
        label="Clear"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :disabled="loading"
        @click="clearFilters"
      />
    </div>

    <!-- Active filters display (optional visual feedback) -->
    <div
      v-if="hasActiveFilters"
      class="flex flex-wrap gap-2"
      role="status"
      aria-live="polite"
    >
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
            :aria-label="'Remove date filter'"
            @click="clearDateRange"
          />
        </span>
      </UBadge>

      <UBadge
        v-if="selectedEntityType"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          Entity: {{ entityTypeOptions.find(e => e.value === selectedEntityType)?.label }}
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            :aria-label="'Remove entity type filter'"
            @click="selectedEntityType = ''"
          />
        </span>
      </UBadge>

      <UBadge
        v-if="selectedUserId"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          User: {{ userOptions.find(u => u.value === selectedUserId)?.label }}
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            :aria-label="'Remove user filter'"
            @click="selectedUserId = ''"
          />
        </span>
      </UBadge>

      <UBadge
        v-if="selectedAction"
        color="primary"
        variant="subtle"
      >
        <span class="flex items-center gap-1">
          Action: {{ actionTypeOptions.find(a => a.value === selectedAction)?.label }}
          <UIcon
            name="i-lucide-x"
            class="size-3 cursor-pointer hover:text-primary-foreground"
            role="button"
            :aria-label="'Remove action filter'"
            @click="selectedAction = ''"
          />
        </span>
      </UBadge>
    </div>
  </div>
</template>
