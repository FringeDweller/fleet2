<script setup lang="ts">
import type { Period, Range } from '~/types'
import type {
  DashboardLayoutConfig,
  DashboardWidget,
  DashboardWidgetOptions,
} from '~~/server/db/schema/dashboard-layouts'

const props = defineProps<{
  layout: DashboardLayoutConfig
  isEditing: boolean
  period: Period
  range: Range
}>()

const emit = defineEmits<{
  'update:layout': [layout: DashboardLayoutConfig]
  'remove-widget': [widgetId: string]
  'update-widget-options': [widgetId: string, options: DashboardWidgetOptions]
}>()

// Convert layout widgets to grid layout format
const gridLayout = computed(() => {
  return props.layout.widgets.map((widget) => ({
    i: widget.id,
    x: widget.position.x,
    y: widget.position.y,
    w: widget.position.w,
    h: widget.position.h,
    type: widget.type,
    options: widget.options,
  }))
})

// Handle layout change from grid
function handleLayoutUpdate(
  newLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>,
) {
  if (!props.isEditing) return

  const updatedWidgets: DashboardWidget[] = newLayout.map((item) => {
    const originalWidget = props.layout.widgets.find((w) => w.id === item.i)
    return {
      id: item.i,
      type: originalWidget?.type ?? 'stats',
      position: {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      },
      options: originalWidget?.options,
    }
  })

  emit('update:layout', {
    ...props.layout,
    widgets: updatedWidgets,
  })
}

// Get widget by id
function getWidget(id: string): DashboardWidget | undefined {
  return props.layout.widgets.find((w) => w.id === id)
}

// Handle remove widget
function handleRemoveWidget(widgetId: string) {
  emit('remove-widget', widgetId)
}

// Handle widget options update
function handleWidgetOptionsUpdate(widgetId: string, options: DashboardWidgetOptions) {
  emit('update-widget-options', widgetId, options)
}
</script>

<template>
  <div class="dashboard-grid">
    <ClientOnly>
      <template #fallback>
        <div class="flex items-center justify-center h-96">
          <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
        </div>
      </template>

      <GridLayout
        :layout="gridLayout"
        :col-num="layout.columns"
        :row-height="layout.rowHeight || 100"
        :is-draggable="isEditing"
        :is-resizable="isEditing"
        :vertical-compact="true"
        :use-css-transforms="true"
        :margin="[16, 16]"
        @layout-updated="handleLayoutUpdate"
      >
        <GridItem
          v-for="item in gridLayout"
          :key="item.i"
          :i="item.i"
          :x="item.x"
          :y="item.y"
          :w="item.w"
          :h="item.h"
          :static="!isEditing"
          class="dashboard-grid-item"
          :class="{ 'is-editing': isEditing }"
        >
          <DashboardWidgetWrapper
            :widget="getWidget(item.i)!"
            :is-editing="isEditing"
            :period="period"
            :range="range"
            @remove="handleRemoveWidget(item.i)"
            @update-options="(options) => handleWidgetOptionsUpdate(item.i, options)"
          />
        </GridItem>
      </GridLayout>
    </ClientOnly>
  </div>
</template>

<style scoped>
.dashboard-grid {
  min-height: 400px;
}

.dashboard-grid-item {
  transition: all 200ms ease;
}

.dashboard-grid-item.is-editing {
  cursor: move;
}

.dashboard-grid-item.is-editing :deep(.vue-grid-item) {
  border: 2px dashed var(--ui-border);
  border-radius: var(--ui-radius);
}

.dashboard-grid-item.is-editing:hover :deep(.vue-grid-item) {
  border-color: var(--ui-primary);
}
</style>
