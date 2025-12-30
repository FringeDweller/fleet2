<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface ItemsSummary {
  total: number
  passed: number
  failed: number
  na: number
  pending: number
}

interface Inspection {
  id: string
  status: 'in_progress' | 'completed' | 'cancelled'
  overallResult: string | null
  initiationMethod: 'nfc' | 'qr_code' | 'manual'
  startedAt: string
  completedAt: string | null
  locationName: string | null
  notes: string | null
  signedAt: string | null
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
    category: {
      id: string
      name: string
    } | null
  }
  template: {
    id: string
    name: string
    description: string | null
  }
  operator: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  }
  signedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
  itemsSummary: ItemsSummary
}

interface Operator {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface InspectionTemplate {
  id: string
  name: string
}

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const UAvatar = resolveComponent('UAvatar')
const UProgress = resolveComponent('UProgress')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()
const route = useRoute()

const columnFilters = ref<{ id: string; value: string }[]>([])
const columnVisibility = ref()
const rowSelection = ref({})

// Filter state - initialize from URL query params
const statusFilter = ref((route.query.status as string) || 'all')
const resultFilter = ref((route.query.result as string) || 'all')
const operatorFilter = ref((route.query.operatorId as string) || 'all')
const assetFilter = ref((route.query.assetId as string) || 'all')
const templateFilter = ref((route.query.templateId as string) || 'all')
const startDateFilter = ref((route.query.startDate as string) || '')
const endDateFilter = ref((route.query.endDate as string) || '')

// Fetch filter options
const { data: operators } = await useFetch<Operator[]>('/api/operators', { lazy: true })
const { data: templates } = await useFetch<InspectionTemplate[]>('/api/inspection-templates', {
  lazy: true,
})
const { data: assetsData } = await useFetch<{ data: Asset[] }>('/api/assets', {
  lazy: true,
  query: { limit: 100 },
})

const operatorOptions = computed(() => {
  const options = [{ label: 'All Operators', value: 'all' }]
  if (operators.value) {
    for (const op of operators.value) {
      options.push({
        label: `${op.firstName} ${op.lastName}`,
        value: op.id,
      })
    }
  }
  return options
})

const templateOptions = computed(() => {
  const options = [{ label: 'All Templates', value: 'all' }]
  if (templates.value) {
    for (const t of templates.value) {
      options.push({
        label: t.name,
        value: t.id,
      })
    }
  }
  return options
})

const assetOptions = computed(() => {
  const options = [{ label: 'All Assets', value: 'all' }]
  if (assetsData.value?.data) {
    for (const a of assetsData.value.data) {
      options.push({
        label: `${a.assetNumber}${a.make ? ` - ${a.make}` : ''}${a.model ? ` ${a.model}` : ''}`,
        value: a.id,
      })
    }
  }
  return options
})

// Computed query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  if (resultFilter.value !== 'all') params.overallResult = resultFilter.value
  if (operatorFilter.value !== 'all') params.operatorId = operatorFilter.value
  if (assetFilter.value !== 'all') params.assetId = assetFilter.value
  if (templateFilter.value !== 'all') params.templateId = templateFilter.value
  if (startDateFilter.value) params.startDate = startDateFilter.value
  if (endDateFilter.value) params.endDate = endDateFilter.value
  return params
})

const {
  data,
  status: fetchStatus,
  refresh,
} = await useFetch<{ data: Inspection[]; pagination: { total: number } }>(
  '/api/inspections/history',
  {
    lazy: true,
    query: queryParams,
  },
)

function getRowItems(row: Row<Inspection>) {
  return [
    {
      type: 'label',
      label: 'Actions',
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/inspections/${row.original.id}/complete`)
      },
    },
    {
      label: 'View asset',
      icon: 'i-lucide-truck',
      onSelect() {
        router.push(`/assets/${row.original.asset.id}`)
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Export inspection',
      icon: 'i-lucide-download',
      onSelect() {
        // Export single inspection
        window.open(`/api/inspections/export?format=csv&id=${row.original.id}`, '_blank')
      },
    },
  ]
}

const statusColors = {
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
} as const

const statusLabels = {
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const

const resultColors = {
  pass: 'success',
  fail: 'error',
} as const

function getInitiationIcon(method: string) {
  switch (method) {
    case 'nfc':
      return 'i-lucide-nfc'
    case 'qr_code':
      return 'i-lucide-qr-code'
    default:
      return 'i-lucide-clipboard-edit'
  }
}

const columns: TableColumn<Inspection>[] = [
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
    accessorKey: 'asset',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Asset',
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
      h('div', { class: 'max-w-[180px]' }, [
        h('p', { class: 'font-medium text-highlighted truncate' }, row.original.asset.assetNumber),
        h(
          'p',
          { class: 'text-sm text-muted truncate' },
          `${row.original.asset.make || ''}${row.original.asset.model ? ` ${row.original.asset.model}` : ''}`.trim() ||
            'No details',
        ),
      ]),
  },
  {
    accessorKey: 'template',
    header: 'Template',
    cell: ({ row }) =>
      h('span', { class: 'truncate max-w-[150px] block' }, row.original.template.name),
  },
  {
    accessorKey: 'operator',
    header: 'Operator',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, {
          src: row.original.operator.avatarUrl || undefined,
          alt: `${row.original.operator.firstName} ${row.original.operator.lastName}`,
          size: 'xs',
        }),
        h(
          'span',
          { class: 'truncate max-w-[120px]' },
          `${row.original.operator.firstName} ${row.original.operator.lastName}`,
        ),
      ]),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = statusColors[row.original.status]
      return h(UBadge, { variant: 'subtle', color }, () => statusLabels[row.original.status])
    },
  },
  {
    accessorKey: 'overallResult',
    header: 'Result',
    cell: ({ row }) => {
      const result = row.original.overallResult
      if (!result || row.original.status !== 'completed') {
        return h('span', { class: 'text-muted' }, '-')
      }
      const color = resultColors[result as keyof typeof resultColors] || 'neutral'
      return h(UBadge, { variant: 'subtle', color, class: 'capitalize' }, () => result)
    },
  },
  {
    accessorKey: 'itemsSummary',
    header: 'Items',
    cell: ({ row }) => {
      const summary = row.original.itemsSummary
      if (summary.total === 0) {
        return h('span', { class: 'text-muted' }, 'No items')
      }
      const passPercent = Math.round((summary.passed / summary.total) * 100)
      return h('div', { class: 'flex items-center gap-2 min-w-[100px]' }, [
        h(UProgress, {
          value: passPercent,
          color: summary.failed > 0 ? 'error' : 'success',
          size: 'xs',
          class: 'flex-1',
        }),
        h(
          'span',
          { class: 'text-xs text-muted whitespace-nowrap' },
          `${summary.passed}/${summary.total}`,
        ),
      ])
    },
  },
  {
    accessorKey: 'initiationMethod',
    header: 'Method',
    cell: ({ row }) => {
      const icon = getInitiationIcon(row.original.initiationMethod)
      const label =
        row.original.initiationMethod === 'qr_code'
          ? 'QR'
          : upperFirst(row.original.initiationMethod)
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('span', { class: `${icon} text-muted` }),
        h('span', undefined, label),
      ])
    },
  },
  {
    accessorKey: 'startedAt',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Date',
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
      h('div', undefined, [
        h('p', undefined, format(parseISO(row.original.startedAt), 'MMM d, yyyy')),
        h(
          'p',
          { class: 'text-xs text-muted' },
          formatDistanceToNow(parseISO(row.original.startedAt), { addSuffix: true }),
        ),
      ]),
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
            content: { align: 'end' },
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

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
})

// Export handlers
const isExporting = ref(false)

async function exportCSV() {
  isExporting.value = true
  try {
    const params = new URLSearchParams()
    params.set('format', 'csv')
    if (statusFilter.value !== 'all') params.set('status', statusFilter.value)
    if (resultFilter.value !== 'all') params.set('overallResult', resultFilter.value)
    if (operatorFilter.value !== 'all') params.set('operatorId', operatorFilter.value)
    if (assetFilter.value !== 'all') params.set('assetId', assetFilter.value)
    if (templateFilter.value !== 'all') params.set('templateId', templateFilter.value)
    if (startDateFilter.value) params.set('startDate', startDateFilter.value)
    if (endDateFilter.value) params.set('endDate', endDateFilter.value)

    window.open(`/api/inspections/export?${params.toString()}`, '_blank')
    toast.add({
      title: 'Export started',
      description: 'Your CSV file is being downloaded.',
    })
  } finally {
    isExporting.value = false
  }
}

function clearFilters() {
  statusFilter.value = 'all'
  resultFilter.value = 'all'
  operatorFilter.value = 'all'
  assetFilter.value = 'all'
  templateFilter.value = 'all'
  startDateFilter.value = ''
  endDateFilter.value = ''
}
</script>

<template>
  <UDashboardPanel id="inspection-history">
    <template #header>
      <UDashboardNavbar title="Inspection History">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Compliance Dashboard"
            icon="i-lucide-chart-bar"
            color="neutral"
            variant="outline"
            class="mr-2"
            @click="router.push('/inspections/compliance')"
          />
          <UButton
            label="Export CSV"
            icon="i-lucide-download"
            color="primary"
            :loading="isExporting"
            @click="exportCSV"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="flex flex-wrap items-center gap-2">
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' },
            ]"
            placeholder="Status"
            class="min-w-32"
          />
          <USelect
            v-model="resultFilter"
            :items="[
              { label: 'All Results', value: 'all' },
              { label: 'Pass', value: 'pass' },
              { label: 'Fail', value: 'fail' },
            ]"
            placeholder="Result"
            class="min-w-28"
          />
          <USelect
            v-model="assetFilter"
            :items="assetOptions"
            placeholder="Asset"
            class="min-w-40"
          />
          <USelect
            v-model="operatorFilter"
            :items="operatorOptions"
            placeholder="Operator"
            class="min-w-40"
          />
          <USelect
            v-model="templateFilter"
            :items="templateOptions"
            placeholder="Template"
            class="min-w-40"
          />
        </div>

        <div class="flex items-center gap-2">
          <UInput v-model="startDateFilter" type="date" placeholder="Start date" class="w-36" />
          <span class="text-muted">to</span>
          <UInput v-model="endDateFilter" type="date" placeholder="End date" class="w-36" />
          <UButton
            label="Clear"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearFilters"
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
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel(),
        }"
        class="shrink-0"
        :data="data?.data || []"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
      />

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ data?.pagination?.total || 0 }} inspection(s).
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="data?.pagination?.total || 0"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
