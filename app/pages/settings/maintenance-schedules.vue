<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { upperFirst } from 'scule'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { formatDistanceToNow, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth'
})

interface MaintenanceScheduleRow {
  id: string
  name: string
  description: string | null
  scheduleType: 'time_based' | 'usage_based' | 'combined'
  intervalType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'
  intervalValue: number
  intervalMileage: number | null
  intervalHours: number | null
  nextDueDate: string | null
  isActive: boolean
  asset: { id: string; assetNumber: string; make: string | null; model: string | null } | null
  category: { id: string; name: string } | null
  template: { id: string; name: string } | null
  createdAt: string
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
    id: 'name',
    value: ''
  }
])
const columnVisibility = ref()
const rowSelection = ref({})

// Filter state - initialize from URL query params
const scheduleTypeFilter = ref((route.query.scheduleType as string) || 'all')
const isActiveFilter = ref((route.query.isActive as string) || 'all')

// Computed query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (scheduleTypeFilter.value !== 'all') params.scheduleType = scheduleTypeFilter.value
  if (isActiveFilter.value !== 'all') params.isActive = isActiveFilter.value
  return params
})

const { data, status, refresh } = await useFetch<MaintenanceScheduleRow[]>(
  '/api/maintenance-schedules',
  {
    lazy: true,
    query: queryParams
  }
)

function getRowItems(row: Row<MaintenanceScheduleRow>) {
  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/settings/maintenance-schedules/${row.original.id}`)
      }
    },
    {
      label: 'Edit schedule',
      icon: 'i-lucide-pencil',
      onSelect() {
        router.push(`/settings/maintenance-schedules/${row.original.id}/edit`)
      }
    },
    {
      label: 'Preview occurrences',
      icon: 'i-lucide-calendar',
      onSelect() {
        router.push(`/settings/maintenance-schedules/${row.original.id}?tab=preview`)
      }
    },
    {
      label: row.original.isActive ? 'Pause schedule' : 'Activate schedule',
      icon: row.original.isActive ? 'i-lucide-pause' : 'i-lucide-play',
      onSelect() {
        toggleActive(row.original.id, row.original.isActive)
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Archive schedule',
      icon: 'i-lucide-archive',
      color: 'error',
      onSelect() {
        archiveSchedule(row.original.id)
      }
    }
  ]
}

async function toggleActive(id: string, currentStatus: boolean) {
  try {
    await $fetch(`/api/maintenance-schedules/${id}`, {
      method: 'PUT' as const,
      body: { isActive: !currentStatus }
    })
    toast.add({
      title: currentStatus ? 'Schedule paused' : 'Schedule activated',
      description: `The maintenance schedule has been ${currentStatus ? 'paused' : 'activated'}.`
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update schedule status.',
      color: 'error'
    })
  }
}

async function archiveSchedule(id: string) {
  try {
    await $fetch(`/api/maintenance-schedules/${id}`, { method: 'DELETE' as const })
    toast.add({
      title: 'Schedule archived',
      description: 'The maintenance schedule has been archived successfully.'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive schedule.',
      color: 'error'
    })
  }
}

const scheduleTypeColors = {
  time_based: 'info',
  usage_based: 'warning',
  combined: 'primary'
} as const

const scheduleTypeLabels = {
  time_based: 'Time-Based',
  usage_based: 'Usage-Based',
  combined: 'Combined'
} as const

const intervalTypeLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
  custom: 'Custom'
} as const

const columns: TableColumn<MaintenanceScheduleRow>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        ariaLabel: 'Select row'
      })
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Name',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) =>
      h('div', { class: 'max-w-[200px]' }, [
        h('p', { class: 'font-medium text-highlighted truncate' }, row.original.name),
        h('p', { class: 'text-sm text-muted truncate' }, row.original.description || '-')
      ])
  },
  {
    accessorKey: 'scheduleType',
    header: 'Type',
    filterFn: 'equals',
    cell: ({ row }) => {
      const scheduleType = row.original.scheduleType
      const color = scheduleTypeColors[scheduleType]

      // Determine display label
      let displayLabel: string
      if (scheduleType === 'time_based') {
        const intervalLabel = intervalTypeLabels[row.original.intervalType]
        displayLabel =
          row.original.intervalType === 'custom'
            ? `Every ${row.original.intervalValue} days`
            : intervalLabel
      } else {
        displayLabel = scheduleTypeLabels[scheduleType]
      }

      return h(UBadge, { variant: 'subtle', color }, () => displayLabel)
    }
  },
  {
    accessorKey: 'assignedTo',
    header: 'Assigned To',
    cell: ({ row }) => {
      if (row.original.asset) {
        return h('div', { class: 'max-w-[150px]' }, [
          h('p', { class: 'font-medium text-sm truncate' }, row.original.asset.assetNumber),
          h(
            'p',
            { class: 'text-xs text-muted truncate' },
            `${row.original.asset.make || ''} ${row.original.asset.model || ''}`.trim() || '-'
          )
        ])
      }
      if (row.original.category) {
        return h('div', { class: 'flex items-center gap-1' }, [
          h('span', { class: 'text-sm' }, row.original.category.name),
          h(UBadge, { size: 'xs', variant: 'subtle', color: 'neutral' }, () => 'Category')
        ])
      }
      return h('span', { class: 'text-muted' }, '-')
    }
  },
  {
    accessorKey: 'template',
    header: 'Template',
    cell: ({ row }) => {
      if (!row.original.template) return h('span', { class: 'text-muted' }, '-')
      return h('span', { class: 'text-sm' }, row.original.template.name)
    }
  },
  {
    accessorKey: 'nextDueDate',
    header: 'Next Due',
    cell: ({ row }) => {
      const scheduleType = row.original.scheduleType

      // For usage-based schedules, show "N/A - Usage Tracked"
      if (scheduleType === 'usage_based') {
        return h('span', { class: 'text-sm text-muted' }, 'N/A - Usage Tracked')
      }

      const nextDue = row.original.nextDueDate
      if (!nextDue) return h('span', { class: 'text-muted' }, '-')
      return h(
        'span',
        { class: 'text-sm' },
        formatDistanceToNow(parseISO(nextDue), { addSuffix: true })
      )
    }
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const isActive = row.original.isActive
      return h(
        UBadge,
        {
          variant: 'subtle',
          color: isActive ? 'success' : 'neutral'
        },
        () => (isActive ? 'Active' : 'Paused')
      )
    }
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
            items: getRowItems(row)
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'ml-auto'
            })
        )
      )
    }
  }
]

const search = computed({
  get: (): string => {
    return (table.value?.tableApi?.getColumn('name')?.getFilterValue() as string) || ''
  },
  set: (value: string) => {
    table.value?.tableApi?.getColumn('name')?.setFilterValue(value || undefined)
  }
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})
</script>

<template>
  <UDashboardPanel id="maintenance-schedules">
    <template #header>
      <UDashboardNavbar title="Maintenance Schedules">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/settings')"
          />
        </template>

        <template #right>
          <UButton
            label="New Schedule"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/settings/maintenance-schedules/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Maintenance Alerts -->
      <UCard class="mb-4">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bell-ring" class="size-5 text-warning" />
            <span class="font-medium">Maintenance Approaching</span>
          </div>
        </template>
        <MaintenanceAlerts />
      </UCard>

      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Search schedules..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <USelect
            v-model="scheduleTypeFilter"
            :items="[
              { label: 'All Types', value: 'all' },
              { label: 'Time-Based', value: 'time_based' },
              { label: 'Usage-Based', value: 'usage_based' },
              { label: 'Combined', value: 'combined' }
            ]"
            placeholder="Filter type"
            class="min-w-40"
          />
          <USelect
            v-model="isActiveFilter"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'true' },
              { label: 'Paused', value: 'false' }
            ]"
            placeholder="Filter status"
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
