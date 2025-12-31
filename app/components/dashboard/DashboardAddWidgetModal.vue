<script setup lang="ts">
import type { WidgetMetadata } from '~~/server/api/dashboard/widgets.get'
import type { DashboardWidgetType } from '~~/server/db/schema/dashboard-layouts'

const props = defineProps<{
  open: boolean
  existingWidgetTypes: DashboardWidgetType[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'add-widget': [type: DashboardWidgetType]
}>()

// Fetch available widgets
const { data: widgetsData } = await useFetch('/api/dashboard/widgets')

const availableWidgets = computed<WidgetMetadata[]>(() => {
  return widgetsData.value?.widgets ?? []
})

// Filter out widgets that are already on the dashboard (for single-instance widgets)
const filteredWidgets = computed(() => {
  // For now, allow multiple instances of all widgets
  return availableWidgets.value
})

// Search query
const search = ref('')

// Filtered by search
const searchedWidgets = computed(() => {
  if (!search.value) return filteredWidgets.value

  const query = search.value.toLowerCase()
  return filteredWidgets.value.filter(
    (w) =>
      w.name.toLowerCase().includes(query) ||
      w.description.toLowerCase().includes(query) ||
      w.type.toLowerCase().includes(query),
  )
})

// Handle widget selection
function handleSelect(type: DashboardWidgetType) {
  emit('add-widget', type)
  emit('update:open', false)
  search.value = ''
}

// Handle modal close
function handleClose() {
  emit('update:open', false)
  search.value = ''
}
</script>

<template>
  <UModal :open="open" @update:open="handleClose">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-layout-grid" class="size-5 text-primary" />
        <span class="font-semibold">Add Widget</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Search -->
        <UInput
          v-model="search"
          placeholder="Search widgets..."
          icon="i-lucide-search"
          autofocus
        />

        <!-- Widget list -->
        <div class="grid gap-3 max-h-96 overflow-y-auto">
          <button
            v-for="widget in searchedWidgets"
            :key="widget.type"
            type="button"
            class="widget-option p-4 rounded-lg border border-default hover:border-primary hover:bg-elevated/50 transition-colors text-left"
            @click="handleSelect(widget.type)"
          >
            <div class="flex items-start gap-3">
              <div class="shrink-0 p-2 rounded-md bg-primary/10">
                <UIcon :name="widget.icon" class="size-5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="font-medium text-highlighted">{{ widget.name }}</h4>
                <p class="text-sm text-muted mt-1">{{ widget.description }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <UBadge variant="subtle" size="xs" color="neutral">
                    {{ widget.defaultSize.w }}x{{ widget.defaultSize.h }}
                  </UBadge>
                  <UBadge v-if="widget.supportsOptions.dateRange" variant="subtle" size="xs" color="info">
                    Date Range
                  </UBadge>
                  <UBadge v-if="widget.supportsOptions.period" variant="subtle" size="xs" color="info">
                    Period
                  </UBadge>
                </div>
              </div>
              <UIcon name="i-lucide-plus" class="size-5 text-muted" />
            </div>
          </button>

          <!-- No results -->
          <div v-if="searchedWidgets.length === 0" class="text-center py-8 text-muted">
            <UIcon name="i-lucide-search-x" class="size-8 mb-2" />
            <p>No widgets found matching "{{ search }}"</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="handleClose">
          Cancel
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.widget-option:focus {
  outline: none;
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 2px rgba(var(--ui-primary-rgb), 0.2);
}
</style>
