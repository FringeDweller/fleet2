<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatDistanceToNow } from 'date-fns'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface FuelTransaction {
  id: string
  quantity: string
  unitCost: string | null
  totalCost: string | null
  fuelType: 'diesel' | 'petrol' | 'electric' | 'lpg' | 'other'
  odometer: string | null
  engineHours: string | null
  locationName: string | null
  vendor: string | null
  notes: string | null
  transactionDate: string
  createdAt: string
  asset: { id: string; assetNumber: string; make: string | null; model: string | null }
  user: { id: string; firstName: string; lastName: string }
  operatorSession: { id: string; status: string; startTime: string } | null
}

interface TransactionsResponse {
  data: FuelTransaction[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')

const router = useRouter()
const table = useTemplateRef('table')

const columnFilters = ref([])
const columnVisibility = ref()
const rowSelection = ref({})

// Filter state
const assetFilter = ref('')
const fuelTypeFilter = ref('')
const dateFromFilter = ref('')
const dateToFilter = ref('')
const searchFilter = ref('')

// Computed query params
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (assetFilter.value) params.assetId = assetFilter.value
  if (fuelTypeFilter.value) params.fuelType = fuelTypeFilter.value
  if (dateFromFilter.value) params.dateFrom = dateFromFilter.value
  if (dateToFilter.value) params.dateTo = dateToFilter.value
  if (searchFilter.value) params.search = searchFilter.value
  return params
})

const { data, status, refresh } = await useFetch<TransactionsResponse>('/api/fuel/transactions', {
  lazy: true,
  query: queryParams,
})

// Fetch assets for filter dropdown
const { data: assetsData } = await useFetch<{ data: Asset[] }>('/api/assets', { lazy: true })

const assetOptions = computed(() => {
  return [
    { label: 'All Assets', value: '' },
    ...(assetsData.value?.data?.map((a) => ({
      label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
      value: a.id,
    })) || []),
  ]
})

const fuelTypeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'Petrol', value: 'petrol' },
  { label: 'Electric', value: 'electric' },
  { label: 'LPG', value: 'lpg' },
  { label: 'Other', value: 'other' },
]

const fuelTypeColors: Record<string, string> = {
  diesel: 'info',
  petrol: 'warning',
  electric: 'success',
  lpg: 'neutral',
  other: 'neutral',
}

const fuelTypeLabels: Record<string, string> = {
  diesel: 'Diesel',
  petrol: 'Petrol',
  electric: 'Electric',
  lpg: 'LPG',
  other: 'Other',
}

function clearFilters() {
  assetFilter.value = ''
  fuelTypeFilter.value = ''
  dateFromFilter.value = ''
  dateToFilter.value = ''
  searchFilter.value = ''
}

const hasFilters = computed(() => {
  return (
    assetFilter.value ||
    fuelTypeFilter.value ||
    dateFromFilter.value ||
    dateToFilter.value ||
    searchFilter.value
  )
})

const columns: TableColumn<FuelTransaction>[] = [
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
    accessorKey: 'transactionDate',
    header: 'Date',
    cell: ({ row }) => {
      const date = new Date(row.original.transactionDate)
      return h('div', { class: 'text-sm' }, [
        h('p', {}, date.toLocaleDateString('en-AU')),
        h('p', { class: 'text-muted' }, formatDistanceToNow(date, { addSuffix: true })),
      ])
    },
  },
  {
    accessorKey: 'asset',
    header: 'Asset',
    cell: ({ row }) =>
      h('div', { class: 'max-w-[180px]' }, [
        h(
          'p',
          {
            class: 'font-medium text-highlighted truncate cursor-pointer hover:underline',
            onClick: () => router.push(`/assets/${row.original.asset.id}`),
          },
          row.original.asset.assetNumber,
        ),
        h(
          'p',
          { class: 'text-sm text-muted truncate' },
          `${row.original.asset.make || ''} ${row.original.asset.model || ''}`.trim() || '-',
        ),
      ]),
  },
  {
    accessorKey: 'fuelType',
    header: 'Fuel Type',
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color:
            (fuelTypeColors[row.original.fuelType] as 'info' | 'warning' | 'success' | 'neutral') ||
            'neutral',
          variant: 'subtle',
        },
        () => fuelTypeLabels[row.original.fuelType] || row.original.fuelType,
      ),
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity (L)',
    cell: ({ row }) => {
      const quantity = parseFloat(row.original.quantity)
      return h('div', { class: 'text-right' }, [
        h(
          'p',
          { class: 'font-semibold' },
          quantity.toLocaleString('en-AU', { maximumFractionDigits: 1 }),
        ),
      ])
    },
  },
  {
    accessorKey: 'totalCost',
    header: 'Cost',
    cell: ({ row }) => {
      if (!row.original.totalCost) return h('span', { class: 'text-muted' }, '-')
      const cost = parseFloat(row.original.totalCost)
      return h('div', { class: 'text-right' }, [
        h(
          'p',
          { class: 'font-semibold' },
          `$${cost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ),
        row.original.unitCost &&
          h(
            'p',
            { class: 'text-xs text-muted' },
            `$${parseFloat(row.original.unitCost).toFixed(3)}/L`,
          ),
      ])
    },
  },
  {
    accessorKey: 'odometer',
    header: 'Odometer',
    cell: ({ row }) => {
      if (!row.original.odometer) return h('span', { class: 'text-muted' }, '-')
      const odometer = parseFloat(row.original.odometer)
      return h('span', {}, `${odometer.toLocaleString('en-AU')} km`)
    },
  },
  {
    accessorKey: 'locationName',
    header: 'Location',
    cell: ({ row }) => {
      const parts = []
      if (row.original.vendor) {
        parts.push(
          h('p', { class: 'text-sm font-medium truncate max-w-[150px]' }, row.original.vendor),
        )
      }
      if (row.original.locationName) {
        parts.push(
          h('p', { class: 'text-xs text-muted truncate max-w-[150px]' }, row.original.locationName),
        )
      }
      if (parts.length === 0) {
        return h('span', { class: 'text-muted' }, '-')
      }
      return h('div', {}, parts)
    },
  },
  {
    accessorKey: 'user',
    header: 'Recorded By',
    cell: ({ row }) => {
      return h(
        'span',
        { class: 'text-sm' },
        `${row.original.user.firstName} ${row.original.user.lastName}`,
      )
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h(UButton, {
        icon: 'i-lucide-eye',
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        onClick: () => router.push(`/fuel/${row.original.id}`),
      }),
  },
]

const pagination = ref({
  pageIndex: 0,
  pageSize: 25,
})

// Calculate summary stats
const totalLitres = computed(() => {
  return data.value?.data?.reduce((sum, t) => sum + parseFloat(t.quantity), 0) || 0
})

const totalCost = computed(() => {
  return (
    data.value?.data?.reduce((sum, t) => sum + (t.totalCost ? parseFloat(t.totalCost) : 0), 0) || 0
  )
})
</script>

<template>
  <UDashboardPanel id="fuel-transactions">
    <template #header>
      <UDashboardNavbar title="Fuel Transactions">
        <template #right>
          <UButton
            v-if="hasFilters"
            label="Clear Filters"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            @click="clearFilters"
          />
          <UButton
            label="Record Fuel"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/fuel/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UInput
          v-model="searchFilter"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Search vendor/location/notes..."
        />

        <USelect
          v-model="assetFilter"
          :items="assetOptions"
          placeholder="Filter by asset"
          class="min-w-48"
        />

        <USelect
          v-model="fuelTypeFilter"
          :items="fuelTypeOptions"
          placeholder="Fuel type"
          class="min-w-36"
        />

        <div class="flex items-center gap-2">
          <UInput
            v-model="dateFromFilter"
            type="date"
            placeholder="From"
            class="w-36"
          />
          <span class="text-muted">to</span>
          <UInput
            v-model="dateToFilter"
            type="date"
            placeholder="To"
            class="w-36"
          />
        </div>

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
                },
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

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ data?.pagination.total || 0 }}
            </p>
            <p class="text-sm text-muted">
              Total Transactions
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-info">
              {{ totalLitres.toLocaleString('en-AU', { maximumFractionDigits: 0 }) }} L
            </p>
            <p class="text-sm text-muted">
              Total Fuel
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-success">
              ${{ totalCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </p>
            <p class="text-sm text-muted">
              Total Cost
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ totalLitres > 0 ? `$${(totalCost / totalLitres).toFixed(3)}` : '-' }}
            </p>
            <p class="text-sm text-muted">
              Avg Cost/L
            </p>
          </div>
        </UCard>
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:pagination="pagination"
        class="shrink-0"
        :data="data?.data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
      />

      <!-- Empty State -->
      <div
        v-if="status !== 'pending' && (!data?.data || data.data.length === 0)"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-fuel" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          No fuel transactions found
        </h3>
        <p class="text-muted mb-4">
          {{ hasFilters ? 'Try adjusting your filters.' : 'Record your first fuel transaction to get started.' }}
        </p>
        <div class="flex justify-center gap-2">
          <UButton
            v-if="hasFilters"
            label="Clear Filters"
            @click="clearFilters"
          />
          <UButton
            label="Record Fuel"
            color="primary"
            icon="i-lucide-plus"
            @click="router.push('/fuel/new')"
          />
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="data?.data && data.data.length > 0"
        class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto"
      >
        <div class="text-sm text-muted">
          Showing {{ data?.data?.length || 0 }} of {{ data?.pagination.total || 0 }} transactions
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="data?.pagination.total || 0"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
