<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface Defect {
  id: string
  title: string
  description: string | null
  category: string | null
  severity: 'minor' | 'major' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  location: string | null
  reportedAt: string
  updatedAt: string
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
  }
  inspection: {
    id: string
    status: string
    completedAt: string | null
    template: {
      id: string
      name: string
    } | null
  } | null
  workOrder: {
    id: string
    workOrderNumber: string
    status: string
  } | null
  reportedBy: {
    id: string
    firstName: string
    lastName: string
  }
  resolvedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()
const route = useRoute()

const columnFilters = ref([
  {
    id: 'title',
    value: '',
  },
])
const columnVisibility = ref()
const rowSelection = ref({})

// Filter state - initialize from URL query params
const statusFilter = ref((route.query.status as string) || 'all')
const severityFilter = ref((route.query.severity as string) || 'all')

// Computed query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  if (severityFilter.value !== 'all') params.severity = severityFilter.value
  return params
})

const { data, status, refresh } = await useFetch<{ data: Defect[]; pagination: { total: number } }>(
  '/api/defects',
  {
    lazy: true,
    query: queryParams,
  },
)

function getRowItems(row: Row<Defect>) {
  const items = [
    {
      type: 'label',
      label: 'Actions',
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/defects/${row.original.id}`)
      },
    },
    {
      label: 'View asset',
      icon: 'i-lucide-truck',
      onSelect() {
        router.push(`/assets/${row.original.asset.id}`)
      },
    },
  ]

  if (row.original.workOrder) {
    items.push({
      label: 'View work order',
      icon: 'i-lucide-clipboard-list',
      onSelect() {
        router.push(`/work-orders/${row.original.workOrder!.id}`)
      },
    })
  }

  if (row.original.inspection) {
    items.push({
      label: 'View inspection',
      icon: 'i-lucide-clipboard-check',
      onSelect() {
        router.push(`/inspections/${row.original.inspection!.id}`)
      },
    })
  }

  if (row.original.status !== 'resolved' && row.original.status !== 'closed') {
    items.push(
      {
        type: 'separator',
      } as any,
      {
        label: 'Mark as resolved',
        icon: 'i-lucide-check-circle',
        color: 'success',
        async onSelect() {
          await resolveDefect(row.original.id)
        },
      } as any,
    )
  }

  return items
}

async function resolveDefect(id: string) {
  try {
    await $fetch(`/api/defects/${id}`, {
      method: 'PATCH',
      body: { status: 'resolved' },
    })
    toast.add({
      title: 'Defect resolved',
      description: 'The defect has been marked as resolved.',
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to resolve defect.',
      color: 'error',
    })
  }
}

const statusColors = {
  open: 'error',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
} as const

const severityColors = {
  minor: 'neutral',
  major: 'warning',
  critical: 'error',
} as const

const statusLabels = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
} as const

const columns: TableColumn<Defect>[] = [
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
    accessorKey: 'title',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Title',
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
      h('div', { class: 'max-w-[250px]' }, [
        h('p', { class: 'font-medium text-highlighted truncate' }, row.original.title),
        h(
          'p',
          { class: 'text-sm text-muted truncate' },
          `${row.original.asset.assetNumber}${row.original.asset.make ? ` - ${row.original.asset.make}` : ''}${row.original.asset.model ? ` ${row.original.asset.model}` : ''}`,
        ),
      ]),
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = severityColors[row.original.severity]
      return h(
        UBadge,
        { class: 'capitalize', variant: 'subtle', color },
        () => row.original.severity,
      )
    },
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
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => {
      if (row.original.inspection) {
        return h('div', { class: 'flex items-center gap-1.5' }, [
          h('span', { class: 'i-lucide-clipboard-check text-muted' }),
          h('span', undefined, row.original.inspection.template?.name || 'Inspection'),
        ])
      }
      return h('span', { class: 'text-muted' }, 'Manual')
    },
  },
  {
    accessorKey: 'workOrder',
    header: 'Work Order',
    cell: ({ row }) => {
      if (!row.original.workOrder) {
        return h('span', { class: 'text-muted' }, '-')
      }
      return h(
        UButton,
        {
          variant: 'link',
          color: 'primary',
          size: 'xs',
          onClick: () => router.push(`/work-orders/${row.original.workOrder!.id}`),
        },
        () => row.original.workOrder!.workOrderNumber,
      )
    },
  },
  {
    accessorKey: 'reportedBy',
    header: 'Reported By',
    cell: ({ row }) =>
      h(
        'span',
        undefined,
        `${row.original.reportedBy.firstName} ${row.original.reportedBy.lastName}`,
      ),
  },
  {
    accessorKey: 'reportedAt',
    header: 'Reported',
    cell: ({ row }) =>
      h(
        'span',
        undefined,
        formatDistanceToNow(parseISO(row.original.reportedAt), { addSuffix: true }),
      ),
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

const search = computed({
  get: (): string => {
    return (table.value?.tableApi?.getColumn('title')?.getFilterValue() as string) || ''
  },
  set: (value: string) => {
    table.value?.tableApi?.getColumn('title')?.setFilterValue(value || undefined)
  },
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
})
</script>

<template>
  <UDashboardPanel id="defects">
    <template #header>
      <UDashboardNavbar title="Defects">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Report Defect"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/defects/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Search defects..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'Open', value: 'open' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Resolved', value: 'resolved' },
              { label: 'Closed', value: 'closed' }
            ]"
            placeholder="Filter status"
            class="min-w-36"
          />
          <USelect
            v-model="severityFilter"
            :items="[
              { label: 'All Severities', value: 'all' },
              { label: 'Critical', value: 'critical' },
              { label: 'Major', value: 'major' },
              { label: 'Minor', value: 'minor' }
            ]"
            placeholder="Filter severity"
            class="min-w-36"
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

      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel()
        }"
        class="shrink-0"
        :data="data?.data || []"
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

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="table?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
