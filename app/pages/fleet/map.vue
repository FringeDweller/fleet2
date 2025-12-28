<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const toast = useToast()

const {
  // State
  filters,
  autoRefresh,
  refreshInterval,
  lastRefresh,
  selectedAssetId,

  // Data
  positions,
  liveStats,
  allAssets,
  mapStats,
  categories,
  filteredSidebarAssets,
  selectedAsset,

  // Computed
  mapCenter,
  mapBounds,

  // Status
  isLoading,

  // Actions
  refresh,
  selectAsset,
  clearFilters,

  // Helpers
  formatLastUpdate,
} = useFleetMap()

// Sidebar collapsed state
const sidebarCollapsed = ref(false)

// Refresh interval options
const refreshIntervalOptions = [
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '5 minutes', value: 300000 },
]

// Handle manual refresh
async function handleRefresh() {
  await refresh()
  toast.add({
    title: 'Fleet positions refreshed',
    icon: 'i-lucide-check',
  })
}

// Category options for filter
const categoryOptions = computed(() => [
  { label: 'All Categories', value: '' },
  ...(categories.value || []).map((c) => ({ label: c.name, value: c.id })),
])

// Status options for filter
const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Disposed', value: 'disposed' },
]
</script>

<template>
  <UDashboardPanel id="fleet-map">
    <template #header>
      <UDashboardNavbar title="Fleet Map">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <!-- Auto-refresh toggle -->
            <div class="flex items-center gap-2 mr-2">
              <USwitch
                v-model="autoRefresh"
                size="sm"
              />
              <span class="text-sm text-muted">Auto-refresh</span>
            </div>

            <!-- Refresh interval selector -->
            <USelect
              v-model="refreshInterval"
              :items="refreshIntervalOptions"
              :disabled="!autoRefresh"
              class="w-32"
              size="sm"
            />

            <!-- Manual refresh button -->
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="isLoading"
              @click="handleRefresh"
            >
              Refresh
            </UButton>

            <!-- Last refresh time -->
            <span v-if="lastRefresh" class="text-xs text-muted hidden md:inline">
              Updated {{ formatLastUpdate(lastRefresh.toISOString()) }}
            </span>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-[calc(100vh-8rem)]">
        <!-- Sidebar -->
        <div
          class="flex-shrink-0 border-r border-default bg-elevated/25 transition-all duration-300 flex flex-col"
          :class="sidebarCollapsed ? 'w-12' : 'w-80'"
        >
          <!-- Sidebar header -->
          <div class="flex items-center justify-between p-3 border-b border-default">
            <div v-if="!sidebarCollapsed" class="flex items-center gap-2">
              <UIcon name="i-lucide-list" class="w-4 h-4 text-muted" />
              <span class="text-sm font-medium text-highlighted">Fleet Assets</span>
              <UBadge v-if="mapStats" color="neutral" variant="subtle" size="xs">
                {{ mapStats.total }}
              </UBadge>
            </div>
            <UButton
              :icon="sidebarCollapsed ? 'i-lucide-chevrons-right' : 'i-lucide-chevrons-left'"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="sidebarCollapsed = !sidebarCollapsed"
            />
          </div>

          <!-- Filters (only when expanded) -->
          <div v-if="!sidebarCollapsed" class="p-3 space-y-2 border-b border-default">
            <UInput
              v-model="filters.search"
              icon="i-lucide-search"
              placeholder="Search assets..."
              size="sm"
            />
            <div class="grid grid-cols-2 gap-2">
              <USelect
                v-model="filters.status"
                :items="statusOptions"
                size="sm"
              />
              <USelect
                v-model="filters.categoryId"
                :items="categoryOptions"
                size="sm"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <UCheckbox v-model="filters.showInactiveAssets" size="xs" />
                Show inactive
              </label>
              <UButton
                v-if="filters.search || filters.status !== 'all' || filters.categoryId"
                label="Clear"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearFilters"
              />
            </div>
          </div>

          <!-- Stats summary (only when expanded) -->
          <div v-if="!sidebarCollapsed && mapStats" class="px-3 py-2 border-b border-default bg-elevated/50">
            <div class="grid grid-cols-2 gap-2 text-center">
              <div>
                <p class="text-lg font-semibold text-highlighted">
                  {{ mapStats.withLocation }}
                </p>
                <p class="text-xs text-muted">With GPS</p>
              </div>
              <div>
                <p class="text-lg font-semibold text-muted">
                  {{ mapStats.withoutLocation }}
                </p>
                <p class="text-xs text-muted">No GPS</p>
              </div>
            </div>
          </div>

          <!-- Asset list -->
          <div v-if="!sidebarCollapsed" class="flex-1 overflow-hidden">
            <FleetMapSidebar
              :assets="filteredSidebarAssets"
              :selected-asset-id="selectedAssetId"
              :is-loading="isLoading"
              @select-asset="selectAsset"
              @clear-selection="selectAsset(null)"
            />
          </div>

          <!-- Collapsed indicator -->
          <div v-if="sidebarCollapsed" class="flex-1 flex items-center justify-center">
            <div class="writing-mode-vertical text-xs text-muted transform rotate-180">
              Fleet Assets
            </div>
          </div>
        </div>

        <!-- Map area -->
        <div class="flex-1 relative">
          <FleetMap
            :positions="positions"
            :selected-asset-id="selectedAssetId"
            :map-center="mapCenter"
            :map-bounds="mapBounds"
            :is-loading="isLoading"
            @select-asset="selectAsset"
            @clear-selection="selectAsset(null)"
          />

          <!-- Asset details popup -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-2"
          >
            <div
              v-if="selectedAsset"
              class="absolute top-4 left-4 z-30"
            >
              <FleetAssetPopup
                :asset="selectedAsset"
                @close="selectAsset(null)"
              />
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.writing-mode-vertical {
  writing-mode: vertical-rl;
}
</style>
