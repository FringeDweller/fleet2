<script setup lang="ts">
import type { Period, Range } from '~/types'
import type { DashboardWidget, DashboardWidgetOptions } from '~~/server/db/schema/dashboard-layouts'

const props = defineProps<{
  widget: DashboardWidget
  isEditing: boolean
  period: Period
  range: Range
}>()

const emit = defineEmits<{
  remove: []
  'update-options': [options: DashboardWidgetOptions]
}>()

// Get widget title based on type
const widgetTitle = computed(() => {
  const titles: Record<string, string> = {
    stats: 'Statistics',
    chart: 'Revenue Chart',
    lowStock: 'Low Stock Alerts',
    fuelAnomalies: 'Fuel Anomalies',
    sales: 'Recent Sales',
    recentWorkOrders: 'Recent Work Orders',
  }
  return titles[props.widget.type] || 'Widget'
})

// Get widget icon based on type
const widgetIcon = computed(() => {
  const icons: Record<string, string> = {
    stats: 'i-lucide-bar-chart-3',
    chart: 'i-lucide-line-chart',
    lowStock: 'i-lucide-alert-triangle',
    fuelAnomalies: 'i-lucide-fuel',
    sales: 'i-lucide-shopping-cart',
    recentWorkOrders: 'i-lucide-clipboard-list',
  }
  return icons[props.widget.type] || 'i-lucide-square'
})

// Widget component to render (not currently used, kept for dynamic rendering if needed)
const _widgetComponent = computed(() => {
  const components: Record<string, string> = {
    stats: 'HomeStats',
    chart: 'HomeChart',
    lowStock: 'HomeLowStock',
    fuelAnomalies: 'HomeFuelAnomalies',
    sales: 'HomeSales',
    recentWorkOrders: 'DashboardRecentWorkOrders',
  }
  return components[props.widget.type]
})

function handleRemove() {
  emit('remove')
}
</script>

<template>
  <div class="widget-wrapper h-full flex flex-col overflow-hidden">
    <!-- Edit mode header -->
    <div
      v-if="isEditing"
      class="widget-header flex items-center justify-between px-3 py-2 bg-elevated border-b border-default rounded-t-lg"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-grip-vertical" class="size-4 text-muted cursor-move drag-handle" />
        <UIcon :name="widgetIcon" class="size-4 text-primary" />
        <span class="text-sm font-medium">{{ widgetTitle }}</span>
      </div>
      <div class="flex items-center gap-1">
        <UTooltip text="Remove widget">
          <UButton
            color="error"
            variant="ghost"
            size="xs"
            icon="i-lucide-trash-2"
            square
            @click="handleRemove"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Widget content -->
    <div class="widget-content flex-1 overflow-auto" :class="{ 'rounded-lg': !isEditing }">
      <!-- Stats widget -->
      <HomeStats
        v-if="widget.type === 'stats'"
        :period="widget.options?.period || period"
        :range="widget.options?.dateRange ? {
          start: new Date(widget.options.dateRange.start),
          end: new Date(widget.options.dateRange.end)
        } : range"
      />

      <!-- Chart widget -->
      <HomeChart
        v-else-if="widget.type === 'chart'"
        :period="widget.options?.period || period"
        :range="widget.options?.dateRange ? {
          start: new Date(widget.options.dateRange.start),
          end: new Date(widget.options.dateRange.end)
        } : range"
      />

      <!-- Low Stock widget -->
      <HomeLowStock v-else-if="widget.type === 'lowStock'" />

      <!-- Fuel Anomalies widget -->
      <HomeFuelAnomalies v-else-if="widget.type === 'fuelAnomalies'" />

      <!-- Sales widget -->
      <HomeSales
        v-else-if="widget.type === 'sales'"
        :period="widget.options?.period || period"
        :range="widget.options?.dateRange ? {
          start: new Date(widget.options.dateRange.start),
          end: new Date(widget.options.dateRange.end)
        } : range"
      />

      <!-- Recent Work Orders widget -->
      <DashboardRecentWorkOrders
        v-else-if="widget.type === 'recentWorkOrders'"
        :limit="widget.options?.limit || 5"
      />

      <!-- Fallback -->
      <div v-else class="flex items-center justify-center h-full text-muted">
        <span>Unknown widget type: {{ widget.type }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-wrapper {
  background: var(--ui-bg);
  border-radius: var(--ui-radius);
  box-shadow: var(--ui-shadow);
}

.widget-content {
  min-height: 0;
}

.drag-handle {
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}
</style>
