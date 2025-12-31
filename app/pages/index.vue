<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { sub } from 'date-fns'
import type { Period, Range } from '~/types'
import type {
  DashboardLayoutConfig,
  DashboardWidget,
  DashboardWidgetOptions,
  DashboardWidgetType,
} from '~~/server/db/schema/dashboard-layouts'

definePageMeta({
  middleware: 'auth',
})

const { isNotificationsSlideoverOpen } = useDashboard()
const toast = useToast()

// Editing state
const isEditing = ref(false)
const isAddWidgetModalOpen = ref(false)
const isSaving = ref(false)

// Date range and period for widgets
const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date(),
})
const period = ref<Period>('daily')

// Fetch user's saved layout
const {
  data: layoutData,
  status: layoutStatus,
  refresh: refreshLayout,
} = await useFetch('/api/dashboard/layout')

// Local layout state for editing
const localLayout = ref<DashboardLayoutConfig | null>(null)

// Initialize local layout from fetched data
watch(
  layoutData,
  (data) => {
    if (data?.layoutConfig) {
      localLayout.value = JSON.parse(JSON.stringify(data.layoutConfig))
    }
  },
  { immediate: true },
)

// Current layout (use local when editing, fetched otherwise)
const currentLayout = computed(() => {
  if (isEditing.value && localLayout.value) {
    return localLayout.value
  }
  return layoutData.value?.layoutConfig ?? getDefaultLayout()
})

// Get default layout
function getDefaultLayout(): DashboardLayoutConfig {
  return {
    columns: 12,
    rowHeight: 100,
    widgets: [
      {
        id: 'stats-1',
        type: 'stats',
        position: { x: 0, y: 0, w: 12, h: 1 },
        options: {},
      },
      {
        id: 'chart-1',
        type: 'chart',
        position: { x: 0, y: 1, w: 12, h: 4 },
        options: {},
      },
      {
        id: 'lowStock-1',
        type: 'lowStock',
        position: { x: 0, y: 5, w: 6, h: 4 },
        options: {},
      },
      {
        id: 'fuelAnomalies-1',
        type: 'fuelAnomalies',
        position: { x: 6, y: 5, w: 6, h: 4 },
        options: {},
      },
      {
        id: 'sales-1',
        type: 'sales',
        position: { x: 0, y: 9, w: 6, h: 4 },
        options: {},
      },
    ],
  }
}

// Existing widget types for add modal
const existingWidgetTypes = computed<DashboardWidgetType[]>(() => {
  return currentLayout.value.widgets.map((w: DashboardWidget) => w.type)
})

// Handle layout update from grid
function handleLayoutUpdate(newLayout: DashboardLayoutConfig) {
  if (localLayout.value) {
    localLayout.value = newLayout
  }
}

// Handle remove widget
function handleRemoveWidget(widgetId: string) {
  if (!localLayout.value) return

  localLayout.value = {
    ...localLayout.value,
    widgets: localLayout.value.widgets.filter((w) => w.id !== widgetId),
  }
}

// Handle widget options update
function handleWidgetOptionsUpdate(widgetId: string, options: DashboardWidgetOptions) {
  if (!localLayout.value) return

  localLayout.value = {
    ...localLayout.value,
    widgets: localLayout.value.widgets.map((w) => (w.id === widgetId ? { ...w, options } : w)),
  }
}

// Handle add widget
function handleAddWidget(type: DashboardWidgetType) {
  if (!localLayout.value) return

  // Get widget metadata for default size
  const defaultSizes: Record<DashboardWidgetType, { w: number; h: number }> = {
    stats: { w: 12, h: 1 },
    chart: { w: 12, h: 4 },
    lowStock: { w: 6, h: 4 },
    fuelAnomalies: { w: 6, h: 4 },
    sales: { w: 6, h: 4 },
    recentWorkOrders: { w: 6, h: 4 },
  }

  // Find the lowest y position to place new widget
  const maxY = localLayout.value.widgets.reduce((max, w) => {
    return Math.max(max, w.position.y + w.position.h)
  }, 0)

  // Generate unique ID
  const existingIds = localLayout.value.widgets
    .filter((w) => w.type === type)
    .map((w) => {
      const match = w.id.match(/-(\d+)$/)
      return match?.[1] ? Number.parseInt(match[1], 10) : 0
    })
  const nextId = Math.max(0, ...existingIds) + 1

  const newWidget: DashboardWidget = {
    id: `${type}-${nextId}`,
    type,
    position: {
      x: 0,
      y: maxY,
      w: defaultSizes[type]?.w ?? 6,
      h: defaultSizes[type]?.h ?? 4,
    },
    options: {},
  }

  localLayout.value = {
    ...localLayout.value,
    widgets: [...localLayout.value.widgets, newWidget],
  }

  toast.add({
    title: 'Widget added',
    description: `${type} widget has been added to your dashboard.`,
    color: 'success',
  })
}

// Start editing
function startEditing() {
  // Clone the current layout for editing
  localLayout.value = JSON.parse(JSON.stringify(currentLayout.value))
  isEditing.value = true
}

// Cancel editing
function cancelEditing() {
  // Reset to saved layout
  if (layoutData.value?.layoutConfig) {
    localLayout.value = JSON.parse(JSON.stringify(layoutData.value.layoutConfig))
  } else {
    localLayout.value = getDefaultLayout()
  }
  isEditing.value = false
}

// Save layout
async function saveLayout() {
  if (!localLayout.value) return

  isSaving.value = true
  try {
    await $fetch('/api/dashboard/layout', {
      method: 'PUT',
      body: localLayout.value,
    })

    toast.add({
      title: 'Dashboard saved',
      description: 'Your dashboard layout has been saved successfully.',
      color: 'success',
    })

    isEditing.value = false
    await refreshLayout()
  } catch (error) {
    console.error('Failed to save layout:', error)
    toast.add({
      title: 'Save failed',
      description: 'Failed to save your dashboard layout. Please try again.',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

// Reset to default layout
function resetToDefault() {
  localLayout.value = getDefaultLayout()
  toast.add({
    title: 'Layout reset',
    description: 'Dashboard has been reset to default layout.',
    color: 'info',
  })
}

// Quick actions dropdown items
const items = [
  [
    {
      label: 'New mail',
      icon: 'i-lucide-send',
      to: '/inbox',
    },
    {
      label: 'New customer',
      icon: 'i-lucide-user-plus',
      to: '/customers',
    },
  ],
] satisfies DropdownMenuItem[][]
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <!-- Edit mode actions -->
          <template v-if="isEditing">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-rotate-ccw"
              @click="resetToDefault"
            >
              Reset
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              @click="cancelEditing"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-check"
              :loading="isSaving"
              @click="saveLayout"
            >
              Save
            </UButton>
          </template>

          <!-- Normal mode actions -->
          <template v-else>
            <UTooltip text="Edit Dashboard">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-layout-dashboard"
                square
                @click="startEditing"
              />
            </UTooltip>

            <UTooltip text="Notifications" :shortcuts="['N']">
              <UButton
                color="neutral"
                variant="ghost"
                square
                @click="isNotificationsSlideoverOpen = true"
              >
                <UChip color="error" inset>
                  <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
                </UChip>
              </UButton>
            </UTooltip>

            <UDropdownMenu :items="items">
              <UButton icon="i-lucide-plus" size="md" class="rounded-full" />
            </UDropdownMenu>
          </template>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <!-- NOTE: The `-ms-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
          <HomeDateRangePicker v-model="range" class="-ms-1" />
          <HomePeriodSelect v-model="period" :range="range" />
        </template>

        <template v-if="isEditing" #right>
          <UButton
            variant="soft"
            color="primary"
            icon="i-lucide-plus"
            @click="isAddWidgetModalOpen = true"
          >
            Add Widget
          </UButton>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="layoutStatus === 'pending'" class="flex items-center justify-center h-96">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
      </div>

      <!-- Edit mode banner -->
      <div
        v-if="isEditing"
        class="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3"
      >
        <UIcon name="i-lucide-info" class="size-5 text-primary shrink-0" />
        <span class="text-sm">
          <strong>Edit Mode:</strong> Drag widgets to rearrange, resize by dragging corners, or click
          the trash icon to remove. Click "Add Widget" to add new widgets.
        </span>
      </div>

      <!-- Dashboard grid -->
      <DashboardGrid
        v-if="currentLayout && layoutStatus !== 'pending'"
        :layout="currentLayout"
        :is-editing="isEditing"
        :period="period"
        :range="range"
        @update:layout="handleLayoutUpdate"
        @remove-widget="handleRemoveWidget"
        @update-widget-options="handleWidgetOptionsUpdate"
      />

      <!-- Empty state -->
      <div
        v-if="currentLayout?.widgets.length === 0 && !isEditing"
        class="flex flex-col items-center justify-center h-96 text-center"
      >
        <UIcon name="i-lucide-layout-dashboard" class="size-16 text-muted mb-4" />
        <h3 class="text-lg font-semibold">Your dashboard is empty</h3>
        <p class="text-muted mt-1 mb-4">
          Click "Edit Dashboard" to add widgets and customize your view.
        </p>
        <UButton color="primary" icon="i-lucide-layout-dashboard" @click="startEditing">
          Edit Dashboard
        </UButton>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Widget Modal -->
  <DashboardAddWidgetModal
    v-model:open="isAddWidgetModalOpen"
    :existing-widget-types="existingWidgetTypes"
    @add-widget="handleAddWidget"
  />
</template>
