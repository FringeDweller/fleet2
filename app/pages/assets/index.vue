<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface Asset {
  id: string
  assetNumber: string
  vin: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  operationalHours: string | null
  mileage: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  description: string | null
  imageUrl: string | null
  isArchived: boolean
  categoryId: string | null
  category: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface SavedSearch {
  id: string
  name: string
  description: string | null
  filters: Record<string, unknown>
  isDefault: boolean
  isShared: boolean
}

interface AssetsResponse {
  data: Asset[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()

const columnVisibility = ref()
const rowSelection = ref({})
const showAdvancedFilters = ref(false)
const showSaveSearchModal = ref(false)
const newSearchName = ref('')

// Server-side filter state
const filters = ref({
  search: '',
  status: 'all',
  categoryId: '',
  make: '',
  model: '',
  yearMin: '',
  yearMax: '',
  mileageMin: '',
  mileageMax: '',
  hoursMin: '',
  hoursMax: '',
})

// Pagination state
const pagination = ref({
  pageIndex: 0,
  pageSize: 25,
})

// Sorting state
const sorting = ref({
  sortBy: 'createdAt',
  sortOrder: 'desc' as 'asc' | 'desc',
})

// Build query params for API
const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    limit: pagination.value.pageSize,
    offset: pagination.value.pageIndex * pagination.value.pageSize,
    sortBy: sorting.value.sortBy,
    sortOrder: sorting.value.sortOrder,
  }

  if (filters.value.search) params.search = filters.value.search
  if (filters.value.status && filters.value.status !== 'all') params.status = filters.value.status
  if (filters.value.categoryId) params.categoryId = filters.value.categoryId
  if (filters.value.make) params.make = filters.value.make
  if (filters.value.model) params.model = filters.value.model
  if (filters.value.yearMin) params.yearMin = parseInt(filters.value.yearMin, 10)
  if (filters.value.yearMax) params.yearMax = parseInt(filters.value.yearMax, 10)
  if (filters.value.mileageMin) params.mileageMin = parseFloat(filters.value.mileageMin)
  if (filters.value.mileageMax) params.mileageMax = parseFloat(filters.value.mileageMax)
  if (filters.value.hoursMin) params.hoursMin = parseFloat(filters.value.hoursMin)
  if (filters.value.hoursMax) params.hoursMax = parseFloat(filters.value.hoursMax)

  return params
})

// Fetch assets with server-side pagination
const {
  data: response,
  status: fetchStatus,
  refresh,
} = await useFetch<AssetsResponse>('/api/assets', {
  query: queryParams,
  lazy: true,
  watch: [queryParams],
})

// Fetch categories for filter dropdown
const { data: categories } = await useFetch<{ id: string; name: string }[]>(
  '/api/asset-categories',
  {
    lazy: true,
  },
)

// Fetch saved searches
const { data: savedSearches, refresh: refreshSavedSearches } = await useFetch<SavedSearch[]>(
  '/api/saved-searches',
  {
    query: { entity: 'asset' },
    lazy: true,
  },
)

const assets = computed(() => response.value?.data || [])
const totalItems = computed(() => response.value?.pagination.total || 0)

// Check if any advanced filters are active
const hasActiveAdvancedFilters = computed(() => {
  return !!(
    filters.value.make ||
    filters.value.model ||
    filters.value.yearMin ||
    filters.value.yearMax ||
    filters.value.mileageMin ||
    filters.value.mileageMax ||
    filters.value.hoursMin ||
    filters.value.hoursMax
  )
})

// Reset pagination when filters change
watch(
  () => filters.value,
  () => {
    pagination.value.pageIndex = 0
  },
  { deep: true },
)

// Apply saved search
function applySavedSearch(search: SavedSearch) {
  const f = search.filters as Record<string, string>
  filters.value = {
    search: f.search || '',
    status: f.status || 'all',
    categoryId: f.categoryId || '',
    make: f.make || '',
    model: f.model || '',
    yearMin: f.yearMin?.toString() || '',
    yearMax: f.yearMax?.toString() || '',
    mileageMin: f.mileageMin?.toString() || '',
    mileageMax: f.mileageMax?.toString() || '',
    hoursMin: f.hoursMin?.toString() || '',
    hoursMax: f.hoursMax?.toString() || '',
  }
  toast.add({ title: 'Search applied', description: `Applied "${search.name}"` })
}

// Save current search
async function saveCurrentSearch() {
  if (!newSearchName.value.trim()) {
    toast.add({ title: 'Error', description: 'Please enter a name for the search', color: 'error' })
    return
  }

  try {
    await $fetch('/api/saved-searches', {
      method: 'POST',
      body: {
        name: newSearchName.value,
        entity: 'asset',
        filters: {
          search: filters.value.search || undefined,
          status: filters.value.status !== 'all' ? filters.value.status : undefined,
          categoryId: filters.value.categoryId || undefined,
          make: filters.value.make || undefined,
          model: filters.value.model || undefined,
          yearMin: filters.value.yearMin ? parseInt(filters.value.yearMin, 10) : undefined,
          yearMax: filters.value.yearMax ? parseInt(filters.value.yearMax, 10) : undefined,
          mileageMin: filters.value.mileageMin ? parseFloat(filters.value.mileageMin) : undefined,
          mileageMax: filters.value.mileageMax ? parseFloat(filters.value.mileageMax) : undefined,
          hoursMin: filters.value.hoursMin ? parseFloat(filters.value.hoursMin) : undefined,
          hoursMax: filters.value.hoursMax ? parseFloat(filters.value.hoursMax) : undefined,
        },
      },
    })
    toast.add({ title: 'Search saved', description: `Saved "${newSearchName.value}"` })
    newSearchName.value = ''
    showSaveSearchModal.value = false
    refreshSavedSearches()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to save search', color: 'error' })
  }
}

// Delete saved search
async function deleteSavedSearch(id: string) {
  try {
    await $fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Search deleted' })
    refreshSavedSearches()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to delete search', color: 'error' })
  }
}

// Saved searches dropdown items
const savedSearchItems = computed(() => {
  if (!savedSearches.value || savedSearches.value.length === 0) return []

  const items: Array<{
    type?: string
    label?: string
    icon?: string
    color?: string
    onSelect?: () => void
  }> = [{ type: 'label', label: 'Saved Searches' }]

  savedSearches.value.forEach((s) => {
    items.push({
      label: s.name,
      icon: s.isShared ? 'i-lucide-users' : 'i-lucide-bookmark',
      onSelect: () => applySavedSearch(s),
    })
    items.push({
      label: `Delete ${s.name}`,
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => deleteSavedSearch(s.id),
    })
    items.push({ type: 'separator' })
  })

  // Remove last separator
  items.pop()

  return items
})

// Export to CSV
async function exportToCSV() {
  try {
    const params = new URLSearchParams()
    if (filters.value.search) params.set('search', filters.value.search)
    if (filters.value.status && filters.value.status !== 'all')
      params.set('status', filters.value.status)
    if (filters.value.categoryId) params.set('categoryId', filters.value.categoryId)
    if (filters.value.make) params.set('make', filters.value.make)
    if (filters.value.model) params.set('model', filters.value.model)
    if (filters.value.yearMin) params.set('yearMin', filters.value.yearMin)
    if (filters.value.yearMax) params.set('yearMax', filters.value.yearMax)
    if (filters.value.mileageMin) params.set('mileageMin', filters.value.mileageMin)
    if (filters.value.mileageMax) params.set('mileageMax', filters.value.mileageMax)
    if (filters.value.hoursMin) params.set('hoursMin', filters.value.hoursMin)
    if (filters.value.hoursMax) params.set('hoursMax', filters.value.hoursMax)

    window.location.href = `/api/assets/export?${params.toString()}`
    toast.add({ title: 'Export started', description: 'Your CSV download will begin shortly' })
  } catch {
    toast.add({ title: 'Error', description: 'Failed to export assets', color: 'error' })
  }
}

// Clear all filters
function clearFilters() {
  filters.value = {
    search: '',
    status: 'all',
    categoryId: '',
    make: '',
    model: '',
    yearMin: '',
    yearMax: '',
    mileageMin: '',
    mileageMax: '',
    hoursMin: '',
    hoursMax: '',
  }
}

function getRowItems(row: Row<Asset>) {
  return [
    {
      type: 'label',
      label: 'Actions',
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/assets/${row.original.id}`)
      },
    },
    {
      label: 'Edit asset',
      icon: 'i-lucide-pencil',
      onSelect() {
        router.push(`/assets/${row.original.id}/edit`)
      },
    },
    {
      label: 'Copy asset number',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(row.original.assetNumber)
        toast.add({
          title: 'Copied to clipboard',
          description: 'Asset number copied to clipboard',
        })
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Archive asset',
      icon: 'i-lucide-archive',
      color: 'error',
      onSelect() {
        archiveAsset(row.original.id)
      },
    },
  ]
}

async function archiveAsset(id: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/assets/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Asset archived',
      description: 'The asset has been archived successfully.',
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive asset.',
      color: 'error',
    })
  }
}

const statusColors = {
  active: 'success',
  inactive: 'neutral',
  maintenance: 'warning',
  disposed: 'error',
} as const

const columns: TableColumn<Asset>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all',
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        ariaLabel: 'Select row',
      }),
  },
  {
    accessorKey: 'assetNumber',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Asset #',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      })
    },
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-highlighted' }, row.original.assetNumber),
  },
  {
    accessorKey: 'make',
    header: 'Make/Model',
    cell: ({ row }) => {
      const make = row.original.make || ''
      const model = row.original.model || ''
      const year = row.original.year || ''
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, `${make} ${model}`.trim() || '-'),
        year ? h('p', { class: 'text-sm text-muted' }, year.toString()) : null,
      ])
    },
  },
  {
    accessorKey: 'licensePlate',
    header: 'License Plate',
    cell: ({ row }) => row.original.licensePlate || '-',
  },
  {
    accessorKey: 'vin',
    header: 'VIN',
    cell: ({ row }) => row.original.vin || '-',
  },
  {
    accessorKey: 'mileage',
    header: 'Mileage',
    cell: ({ row }) => {
      const mileage = row.original.mileage
      return mileage ? `${Number(mileage).toLocaleString()} km` : '-'
    },
  },
  {
    accessorKey: 'operationalHours',
    header: 'Hours',
    cell: ({ row }) => {
      const hours = row.original.operationalHours
      return hours ? `${Number(hours).toLocaleString()} hrs` : '-'
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => row.original.category?.name || '-',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = statusColors[row.original.status]
      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () => row.original.status)
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-right' },
        h(
          UDropdownMenu,
          {
            content: {
              align: 'end',
            },
            items: getRowItems(row),
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'ml-auto',
            }),
        ),
      )
    },
  },
]
</script>

<template>
  <UDashboardPanel id="assets">
    <template #header>
      <UDashboardNavbar title="Assets">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="Export CSV"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              @click="exportToCSV"
            />
            <UButton
              label="Add Asset"
              icon="i-lucide-plus"
              color="primary"
              @click="router.push('/assets/new')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Search and Filter Bar -->
      <div class="flex flex-wrap items-center justify-between gap-1.5 mb-4">
        <div class="flex flex-wrap items-center gap-1.5">
          <UInput
            v-model="filters.search"
            class="w-64"
            icon="i-lucide-search"
            placeholder="Search assets..."
          />

          <USelect
            v-model="filters.status"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Maintenance', value: 'maintenance' },
              { label: 'Disposed', value: 'disposed' }
            ]"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
            }"
            class="min-w-36"
          />

          <USelect
            v-model="filters.categoryId"
            :items="[
              { label: 'All Categories', value: '' },
              ...(categories || []).map(c => ({ label: c.name, value: c.id }))
            ]"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
            }"
            class="min-w-36"
          />

          <UButton
            :label="showAdvancedFilters ? 'Hide Filters' : 'More Filters'"
            :icon="hasActiveAdvancedFilters ? 'i-lucide-filter-x' : 'i-lucide-filter'"
            :color="hasActiveAdvancedFilters ? 'primary' : 'neutral'"
            variant="outline"
            @click="showAdvancedFilters = !showAdvancedFilters"
          />

          <UButton
            v-if="
              hasActiveAdvancedFilters
                || filters.search
                || filters.status !== 'all'
                || filters.categoryId
            "
            label="Clear"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            @click="clearFilters"
          />
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Saved Searches Dropdown -->
          <UDropdownMenu
            v-if="savedSearchItems.length > 0"
            :items="savedSearchItems"
            :content="{ align: 'end' }"
          >
            <UButton
              label="Saved"
              icon="i-lucide-bookmark"
              color="neutral"
              variant="outline"
            />
          </UDropdownMenu>

          <UButton
            label="Save Search"
            icon="i-lucide-save"
            color="neutral"
            variant="outline"
            @click="showSaveSearchModal = true"
          />

          <UDropdownMenu
            :items="
              table?.tableApi
                ?.getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => ({
                  label: upperFirst(column.id),
                  type: 'checkbox' as const,
                  checked: column.getIsVisible(),
                  onUpdateChecked(checked: boolean) {
                    table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
                  },
                  onSelect(e?: Event) {
                    e?.preventDefault()
                  }
                }))
            "
            :content="{ align: 'end' }"
          >
            <UButton
              label="Columns"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-settings-2"
            />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Advanced Filters Panel -->
      <div
        v-if="showAdvancedFilters"
        class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 mb-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-default"
      >
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Make</label>
          <UInput v-model="filters.make" placeholder="e.g. Ford" size="sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Model</label>
          <UInput v-model="filters.model" placeholder="e.g. F-150" size="sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Year Min</label>
          <UInput
            v-model="filters.yearMin"
            type="number"
            placeholder="2020"
            size="sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Year Max</label>
          <UInput
            v-model="filters.yearMax"
            type="number"
            placeholder="2024"
            size="sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Mileage Min</label>
          <UInput
            v-model="filters.mileageMin"
            type="number"
            placeholder="0"
            size="sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Mileage Max</label>
          <UInput
            v-model="filters.mileageMax"
            type="number"
            placeholder="100000"
            size="sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Hours Min</label>
          <UInput
            v-model="filters.hoursMin"
            type="number"
            placeholder="0"
            size="sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Hours Max</label>
          <UInput
            v-model="filters.hoursMax"
            type="number"
            placeholder="5000"
            size="sm"
          />
        </div>
      </div>

      <!-- Results Summary -->
      <div class="flex items-center justify-between mb-2 text-sm text-muted">
        <span>{{ totalItems }} asset{{ totalItems === 1 ? '' : 's' }} found</span>
      </div>

      <!-- Data Table -->
      <UTable
        ref="table"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        class="shrink-0"
        :data="assets"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Showing {{ pagination.pageIndex * pagination.pageSize + 1 }}-{{
            Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalItems)
          }}
          of {{ totalItems }}
        </div>

        <div class="flex items-center gap-1.5">
          <USelect
            :model-value="pagination.pageSize.toString()"
            :items="[
              { label: '10 per page', value: '10' },
              { label: '25 per page', value: '25' },
              { label: '50 per page', value: '50' },
              { label: '100 per page', value: '100' }
            ]"
            class="min-w-32"
            @update:model-value="
              (v: string) => {
                pagination.pageSize = parseInt(v)
                pagination.pageIndex = 0
              }
            "
          />
          <UPagination
            :default-page="pagination.pageIndex + 1"
            :items-per-page="pagination.pageSize"
            :total="totalItems"
            @update:page="(p: number) => (pagination.pageIndex = p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Save Search Modal -->
  <UModal v-model:open="showSaveSearchModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              Save Current Search
            </h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showSaveSearchModal = false"
            />
          </div>
        </template>

        <div class="space-y-4">
          <UFormField label="Search Name">
            <UInput
              v-model="newSearchName"
              placeholder="e.g. Active trucks over 50k miles"
              @keyup.enter="saveCurrentSearch"
            />
          </UFormField>

          <div class="text-sm text-muted">
            <p class="font-medium mb-2">
              Current filters:
            </p>
            <ul class="list-disc list-inside space-y-1">
              <li v-if="filters.search">
                Search: "{{ filters.search }}"
              </li>
              <li v-if="filters.status !== 'all'">
                Status: {{ filters.status }}
              </li>
              <li v-if="filters.categoryId">
                Category selected
              </li>
              <li v-if="filters.make">
                Make: {{ filters.make }}
              </li>
              <li v-if="filters.model">
                Model: {{ filters.model }}
              </li>
              <li v-if="filters.yearMin || filters.yearMax">
                Year: {{ filters.yearMin || '...' }} - {{ filters.yearMax || '...' }}
              </li>
              <li v-if="filters.mileageMin || filters.mileageMax">
                Mileage: {{ filters.mileageMin || '0' }} - {{ filters.mileageMax || '...' }}
              </li>
              <li v-if="filters.hoursMin || filters.hoursMax">
                Hours: {{ filters.hoursMin || '0' }} - {{ filters.hoursMax || '...' }}
              </li>
            </ul>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showSaveSearchModal = false"
            />
            <UButton label="Save Search" color="primary" @click="saveCurrentSearch" />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
