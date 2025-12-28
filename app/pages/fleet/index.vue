<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const router = useRouter()
const toast = useToast()

const {
  // State
  filters,
  autoRefresh,
  refreshInterval,
  lastRefresh,

  // Data
  allAssets,
  mapStats,
  categories,

  // Status
  isLoading,

  // Actions
  refresh,
  clearFilters,

  // Helpers
  getStatusColor,
  formatLastUpdate,
} = useFleetMap()

// Refresh interval options
const refreshIntervalOptions = [
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '5 minutes', value: 300000 },
]

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

// Handle manual refresh
async function handleRefresh() {
  await refresh()
  toast.add({
    title: 'Fleet data refreshed',
    icon: 'i-lucide-check',
  })
}

// Table columns
const columns: TableColumn<(typeof allAssets.value)[0]>[] = [
  {
    accessorKey: 'assetNumber',
    header: 'Asset #',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-highlighted' }, row.original.assetNumber),
  },
  {
    accessorKey: 'assetName',
    header: 'Vehicle',
    cell: ({ row }) => {
      const asset = row.original
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, asset.assetName || '-'),
        asset.licensePlate ? h('p', { class: 'text-xs text-muted' }, asset.licensePlate) : null,
      ])
    },
  },
  {
    accessorKey: 'categoryName',
    header: 'Category',
    cell: ({ row }) => row.original.categoryName || '-',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      const color = getStatusColor(status) as 'success' | 'neutral' | 'warning' | 'error'
      return h(UBadge, { color, variant: 'subtle', class: 'capitalize' }, () => status)
    },
  },
  {
    id: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const asset = row.original
      if (!asset.hasLocation) {
        return h(UBadge, { color: 'neutral', variant: 'outline', size: 'xs' }, () => 'No GPS')
      }
      return h('div', { class: 'max-w-xs' }, [
        h(
          'p',
          { class: 'text-sm text-highlighted truncate' },
          asset.locationName || 'Unknown location',
        ),
        h(
          'p',
          { class: 'text-xs text-muted font-mono' },
          `${asset.latitude?.toFixed(4)}, ${asset.longitude?.toFixed(4)}`,
        ),
      ])
    },
  },
  {
    accessorKey: 'lastLocationUpdate',
    header: 'Last Update',
    cell: ({ row }) => formatLastUpdate(row.original.lastLocationUpdate),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const asset = row.original
      return h('div', { class: 'flex items-center gap-1' }, [
        asset.hasLocation
          ? h(
              UButton,
              {
                icon: 'i-lucide-map',
                color: 'neutral',
                variant: 'ghost',
                size: 'xs',
                onClick: () => router.push(`/fleet/map?asset=${asset.assetId}`),
              },
              () => 'Map',
            )
          : null,
        h(
          UButton,
          {
            icon: 'i-lucide-eye',
            color: 'neutral',
            variant: 'ghost',
            size: 'xs',
            onClick: () => router.push(`/assets/${asset.assetId}`),
          },
          () => 'Details',
        ),
      ])
    },
  },
]
</script>

<template>
  <UDashboardPanel id="fleet-overview">
    <template #header>
      <UDashboardNavbar title="Fleet Overview">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <!-- View toggle -->
            <div class="flex items-center border border-default rounded-lg overflow-hidden">
              <UButton
                icon="i-lucide-list"
                color="neutral"
                variant="ghost"
                size="sm"
                class="rounded-none"
                :class="{ 'bg-elevated': true }"
              >
                List
              </UButton>
              <UButton
                icon="i-lucide-map"
                color="neutral"
                variant="ghost"
                size="sm"
                class="rounded-none"
                @click="router.push('/fleet/map')"
              >
                Map
              </UButton>
            </div>

            <UDivider orientation="vertical" class="h-6" />

            <!-- Auto-refresh toggle -->
            <div class="flex items-center gap-2">
              <USwitch v-model="autoRefresh" size="sm" />
              <span class="text-sm text-muted hidden sm:inline">Auto-refresh</span>
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
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Stats cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-truck" class="w-5 h-5 text-primary" />
            </div>
            <div>
              <p class="text-2xl font-bold text-highlighted">
                {{ mapStats?.total || 0 }}
              </p>
              <p class="text-xs text-muted">Total Assets</p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-green-500/10">
              <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p class="text-2xl font-bold text-highlighted">
                {{ mapStats?.withLocation || 0 }}
              </p>
              <p class="text-xs text-muted">With GPS</p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-green-500/10">
              <UIcon name="i-lucide-circle-check" class="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                {{ mapStats?.byStatus.active || 0 }}
              </p>
              <p class="text-xs text-muted">Active</p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-amber-500/10">
              <UIcon name="i-lucide-wrench" class="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {{ mapStats?.byStatus.maintenance || 0 }}
              </p>
              <p class="text-xs text-muted">In Maintenance</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <UInput
          v-model="filters.search"
          icon="i-lucide-search"
          placeholder="Search assets..."
          class="w-64"
        />

        <USelect
          v-model="filters.status"
          :items="statusOptions"
          class="w-40"
        />

        <USelect
          v-model="filters.categoryId"
          :items="categoryOptions"
          class="w-40"
        />

        <UButton
          v-if="filters.search || filters.status !== 'all' || filters.categoryId"
          label="Clear Filters"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="clearFilters"
        />

        <div class="flex-1" />

        <span v-if="lastRefresh" class="text-xs text-muted">
          Last updated {{ formatLastUpdate(lastRefresh.toISOString()) }}
        </span>
      </div>

      <!-- Data table -->
      <UTable
        :data="allAssets"
        :columns="columns"
        :loading="isLoading"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
      />

      <!-- Empty state -->
      <div
        v-if="!isLoading && allAssets.length === 0"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-truck" class="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
        <h3 class="text-lg font-medium text-highlighted mb-2">
          No Assets Found
        </h3>
        <p class="text-muted text-sm mb-4">
          No fleet assets match your current filters.
        </p>
        <UButton
          label="Clear Filters"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          @click="clearFilters"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
