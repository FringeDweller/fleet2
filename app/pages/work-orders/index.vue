<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'
import { formatDistanceToNow, isPast, parseISO } from 'date-fns'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'in_progress' | 'pending_parts' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate: string | null
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
  }
  assignedTo: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  } | null
  createdBy: {
    id: string
    firstName: string
    lastName: string
  }
  createdAt: string
  updatedAt: string
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const UAvatar = resolveComponent('UAvatar')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()
const route = useRoute()

const columnFilters = ref([
  {
    id: 'workOrderNumber',
    value: '',
  },
])
const columnVisibility = ref()
const rowSelection = ref({})

// Filter state - initialize from URL query params
const statusFilter = ref((route.query.status as string) || 'all')
const priorityFilter = ref((route.query.priority as string) || 'all')
const assigneeFilter = ref(
  route.query.assignedToId === 'null'
    ? 'unassigned'
    : (route.query.assignedToId as string) || 'all',
)

// Computed query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  if (priorityFilter.value !== 'all') params.priority = priorityFilter.value
  if (assigneeFilter.value === 'unassigned') params.assignedToId = 'null'
  else if (assigneeFilter.value !== 'all') params.assignedToId = assigneeFilter.value
  return params
})

interface Technician {
  id: string
  firstName: string
  lastName: string
}

const { data: technicians } = await useFetch<Technician[]>('/api/technicians', { lazy: true })

const assigneeOptions = computed(() => {
  const options = [
    { label: 'All Assignees', value: 'all' },
    { label: 'Unassigned', value: 'unassigned' },
  ]
  if (technicians.value) {
    for (const tech of technicians.value) {
      options.push({
        label: `${tech.firstName} ${tech.lastName}`,
        value: tech.id,
      })
    }
  }
  return options
})

const { data, status, refresh } = await useFetch<WorkOrder[]>('/api/work-orders', {
  lazy: true,
  query: queryParams,
})

function getRowItems(row: Row<WorkOrder>) {
  return [
    {
      type: 'label',
      label: 'Actions',
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/work-orders/${row.original.id}`)
      },
    },
    {
      label: 'Edit work order',
      icon: 'i-lucide-pencil',
      onSelect() {
        router.push(`/work-orders/${row.original.id}/edit`)
      },
    },
    {
      label: 'Copy WO number',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(row.original.workOrderNumber)
        toast.add({
          title: 'Copied to clipboard',
          description: 'Work order number copied to clipboard',
        })
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Archive work order',
      icon: 'i-lucide-archive',
      color: 'error',
      onSelect() {
        archiveWorkOrder(row.original.id)
      },
    },
  ]
}

async function archiveWorkOrder(id: string) {
  try {
    // @ts-expect-error - Nuxt route typing issue with DELETE method
    await $fetch(`/api/work-orders/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Work order archived',
      description: 'The work order has been archived successfully.',
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive work order.',
      color: 'error',
    })
  }
}

const statusColors = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral',
} as const

const priorityColors = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
} as const

const statusLabels = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  closed: 'Closed',
} as const

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate) return false
  if (['completed', 'closed'].includes(status)) return false
  return isPast(parseISO(dueDate))
}

const columns: TableColumn<WorkOrder>[] = [
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
    accessorKey: 'workOrderNumber',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'WO #',
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
      h('span', { class: 'font-medium text-highlighted' }, row.original.workOrderNumber),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) =>
      h('div', { class: 'max-w-[200px]' }, [
        h('p', { class: 'font-medium text-highlighted truncate' }, row.original.title),
        h(
          'p',
          { class: 'text-sm text-muted truncate' },
          `${row.original.asset.assetNumber} - ${row.original.asset.make || ''} ${row.original.asset.model || ''}`.trim(),
        ),
      ]),
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = priorityColors[row.original.priority]
      return h(
        UBadge,
        { class: 'capitalize', variant: 'subtle', color },
        () => row.original.priority,
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
    accessorKey: 'assignedTo',
    header: 'Assigned To',
    cell: ({ row }) => {
      const assignee = row.original.assignedTo
      if (!assignee) return h('span', { class: 'text-muted' }, 'Unassigned')
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, {
          src: assignee.avatarUrl || undefined,
          alt: `${assignee.firstName} ${assignee.lastName}`,
          size: 'xs',
        }),
        h('span', undefined, `${assignee.firstName} ${assignee.lastName}`),
      ])
    },
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }) => {
      const dueDate = row.original.dueDate
      if (!dueDate) return h('span', { class: 'text-muted' }, '-')
      const overdue = isOverdue(dueDate, row.original.status)
      return h(
        'span',
        {
          class: overdue ? 'text-error font-medium' : undefined,
        },
        [
          formatDistanceToNow(parseISO(dueDate), { addSuffix: true }),
          overdue ? h('span', { class: 'ml-1' }, '(Overdue)') : null,
        ],
      )
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
    return (table.value?.tableApi?.getColumn('workOrderNumber')?.getFilterValue() as string) || ''
  },
  set: (value: string) => {
    table.value?.tableApi?.getColumn('workOrderNumber')?.setFilterValue(value || undefined)
  },
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
})
</script>

<template>
  <UDashboardPanel id="work-orders">
    <template #header>
      <UDashboardNavbar title="Work Orders">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Assignments"
            icon="i-lucide-users"
            color="neutral"
            variant="outline"
            class="mr-2"
            @click="router.push('/work-orders/assignments')"
          />
          <UButton
            label="Kanban View"
            icon="i-lucide-kanban"
            color="neutral"
            variant="outline"
            class="mr-2"
            @click="router.push('/work-orders/kanban')"
          />
          <UButton
            label="Calendar View"
            icon="i-lucide-calendar"
            color="neutral"
            variant="outline"
            class="mr-2"
            @click="router.push('/maintenance/calendar')"
          />
          <UButton
            label="New Work Order"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/work-orders/new')"
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
          placeholder="Search work orders..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'Draft', value: 'draft' },
              { label: 'Open', value: 'open' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Pending Parts', value: 'pending_parts' },
              { label: 'Completed', value: 'completed' },
              { label: 'Closed', value: 'closed' }
            ]"
            placeholder="Filter status"
            class="min-w-40"
          />
          <USelect
            v-model="priorityFilter"
            :items="[
              { label: 'All Priorities', value: 'all' },
              { label: 'Critical', value: 'critical' },
              { label: 'High', value: 'high' },
              { label: 'Medium', value: 'medium' },
              { label: 'Low', value: 'low' }
            ]"
            placeholder="Filter priority"
            class="min-w-36"
          />
          <USelect
            v-model="assigneeFilter"
            :items="assigneeOptions"
            placeholder="Filter assignee"
            class="min-w-40"
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
        :data="data"
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
