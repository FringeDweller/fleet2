<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatDistanceToNow } from 'date-fns'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface Movement {
  id: string
  usageType: string
  quantityChange: string
  previousQuantity: string
  newQuantity: string
  unitCostAtTime: string | null
  notes: string | null
  reference: string | null
  createdAt: string
  part: { id: string; sku: string; name: string; unit: string }
  user: { id: string; firstName: string; lastName: string } | null
  workOrder: { id: string; workOrderNumber: string; title: string } | null
}

interface MovementsResponse {
  data: Movement[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
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
const partFilter = ref('')
const usageTypeFilter = ref('')
const dateFromFilter = ref('')
const dateToFilter = ref('')
const searchFilter = ref('')

// Computed query params
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (partFilter.value) params.partId = partFilter.value
  if (usageTypeFilter.value) params.usageType = usageTypeFilter.value
  if (dateFromFilter.value) params.dateFrom = dateFromFilter.value
  if (dateToFilter.value) params.dateTo = dateToFilter.value
  if (searchFilter.value) params.search = searchFilter.value
  return params
})

const { data, status, refresh } = await useFetch<MovementsResponse>('/api/parts/movements', {
  lazy: true,
  query: queryParams,
})

// Fetch parts for filter dropdown
const { data: partsData } = await useFetch<{ data: { id: string; name: string; sku: string }[] }>(
  '/api/parts',
  { lazy: true },
)

interface PartOption {
  id: string
  name: string
  sku: string
}

const partOptions = computed(() => {
  return [
    { label: 'All Parts', value: '' },
    ...(partsData.value?.data?.map((p: PartOption) => ({
      label: `${p.sku} - ${p.name}`,
      value: p.id,
    })) || []),
  ]
})

const usageTypeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Work Order', value: 'work_order' },
  { label: 'Adjustment', value: 'adjustment' },
  { label: 'Restock', value: 'restock' },
  { label: 'Return', value: 'return' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Expired', value: 'expired' },
]

const usageTypeColors: Record<string, string> = {
  work_order: 'error',
  adjustment: 'info',
  restock: 'success',
  return: 'warning',
  damaged: 'error',
  expired: 'error',
}

const usageTypeLabels: Record<string, string> = {
  work_order: 'Work Order',
  adjustment: 'Adjustment',
  restock: 'Restock',
  return: 'Return',
  damaged: 'Damaged',
  expired: 'Expired',
}

function clearFilters() {
  partFilter.value = ''
  usageTypeFilter.value = ''
  dateFromFilter.value = ''
  dateToFilter.value = ''
  searchFilter.value = ''
}

const hasFilters = computed(() => {
  return (
    partFilter.value ||
    usageTypeFilter.value ||
    dateFromFilter.value ||
    dateToFilter.value ||
    searchFilter.value
  )
})

const columns: TableColumn<Movement>[] = [
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
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt)
      return h('div', { class: 'text-sm' }, [
        h('p', {}, date.toLocaleDateString('en-AU')),
        h('p', { class: 'text-muted' }, formatDistanceToNow(date, { addSuffix: true })),
      ])
    },
  },
  {
    accessorKey: 'usageType',
    header: 'Type',
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color:
            (usageTypeColors[row.original.usageType] as 'error' | 'info' | 'success' | 'warning') ||
            'neutral',
          variant: 'subtle',
        },
        () => usageTypeLabels[row.original.usageType] || row.original.usageType,
      ),
  },
  {
    accessorKey: 'part',
    header: 'Part',
    cell: ({ row }) =>
      h('div', { class: 'max-w-[200px]' }, [
        h(
          'p',
          {
            class: 'font-medium text-highlighted truncate cursor-pointer hover:underline',
            onClick: () => router.push(`/inventory/parts/${row.original.part.id}`),
          },
          row.original.part.name,
        ),
        h('p', { class: 'text-sm text-muted font-mono' }, row.original.part.sku),
      ]),
  },
  {
    accessorKey: 'quantityChange',
    header: 'Change',
    cell: ({ row }) => {
      const change = parseFloat(row.original.quantityChange)
      const isPositive = change > 0
      return h('div', { class: 'text-center' }, [
        h(
          'p',
          { class: ['font-bold text-lg', isPositive ? 'text-success' : 'text-error'] },
          `${isPositive ? '+' : ''}${change.toLocaleString()}`,
        ),
        h('p', { class: 'text-xs text-muted' }, row.original.part.unit),
      ])
    },
  },
  {
    id: 'stockLevel',
    header: 'Stock Level',
    cell: ({ row }) => {
      const prev = parseFloat(row.original.previousQuantity)
      const next = parseFloat(row.original.newQuantity)
      return h('div', { class: 'text-sm' }, [
        h('span', { class: 'text-muted' }, prev.toLocaleString()),
        h('span', { class: 'mx-1' }, '\u2192'),
        h('span', { class: 'font-medium' }, next.toLocaleString()),
      ])
    },
  },
  {
    accessorKey: 'reference',
    header: 'Reference',
    cell: ({ row }) => {
      const parts = []
      if (row.original.reference) {
        parts.push(h('p', { class: 'text-sm font-mono' }, row.original.reference))
      }
      if (row.original.workOrder) {
        parts.push(
          h(
            'p',
            {
              class: 'text-sm text-primary cursor-pointer hover:underline',
              onClick: () => router.push(`/work-orders/${row.original.workOrder!.id}`),
            },
            row.original.workOrder.workOrderNumber,
          ),
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
    header: 'User',
    cell: ({ row }) => {
      if (!row.original.user) return h('span', { class: 'text-muted' }, '-')
      return h(
        'span',
        { class: 'text-sm' },
        `${row.original.user.firstName} ${row.original.user.lastName}`,
      )
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => {
      if (!row.original.notes) return h('span', { class: 'text-muted' }, '-')
      return h(
        'p',
        { class: 'text-sm truncate max-w-[200px]', title: row.original.notes },
        row.original.notes,
      )
    },
  },
]

const pagination = ref({
  pageIndex: 0,
  pageSize: 25,
})
</script>

<template>
  <UDashboardPanel id="stock-movements">
    <template #header>
      <UDashboardNavbar title="Stock Movements">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/inventory/parts')"
          />
        </template>

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
            label="Parts Catalog"
            icon="i-lucide-package"
            color="neutral"
            variant="outline"
            @click="router.push('/inventory/parts')"
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
          placeholder="Search notes/reference..."
        />

        <USelect
          v-model="partFilter"
          :items="partOptions"
          placeholder="Filter by part"
          class="min-w-48"
        />

        <USelect
          v-model="usageTypeFilter"
          :items="usageTypeOptions"
          placeholder="Movement type"
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

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ data?.pagination.total || 0 }}
            </p>
            <p class="text-sm text-muted">
              Total Movements
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-success">
              {{ data?.data?.filter((m: Movement) => parseFloat(m.quantityChange) > 0).length || 0 }}
            </p>
            <p class="text-sm text-muted">
              Stock In
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-error">
              {{ data?.data?.filter((m: Movement) => parseFloat(m.quantityChange) < 0).length || 0 }}
            </p>
            <p class="text-sm text-muted">
              Stock Out
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ data?.data?.filter((m: Movement) => m.usageType === 'work_order').length || 0 }}
            </p>
            <p class="text-sm text-muted">
              Work Order Usage
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
          separator: 'h-0'
        }"
      />

      <!-- Empty State -->
      <div
        v-if="status !== 'pending' && (!data?.data || data.data.length === 0)"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-package-search" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          No stock movements found
        </h3>
        <p class="text-muted mb-4">
          {{ hasFilters ? 'Try adjusting your filters.' : 'Stock movements will appear here when you adjust inventory.' }}
        </p>
        <div class="flex justify-center gap-2">
          <UButton
            v-if="hasFilters"
            label="Clear Filters"
            @click="clearFilters"
          />
          <UButton
            label="Go to Parts"
            color="neutral"
            variant="outline"
            @click="router.push('/inventory/parts')"
          />
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="data?.data && data.data.length > 0"
        class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto"
      >
        <div class="text-sm text-muted">
          Showing {{ data?.data?.length || 0 }} of {{ data?.pagination.total || 0 }} movements
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
