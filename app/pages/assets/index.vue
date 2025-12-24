<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { upperFirst } from 'scule'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'

definePageMeta({
  middleware: 'auth'
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
  category: { id: string, name: string } | null
  createdAt: string
  updatedAt: string
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()

const columnFilters = ref([{
  id: 'assetNumber',
  value: ''
}])
const columnVisibility = ref()
const rowSelection = ref({})

const { data, status, refresh } = await useFetch<Asset[]>('/api/assets', {
  lazy: true
})

function getRowItems(row: Row<Asset>) {
  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/assets/${row.original.id}`)
      }
    },
    {
      label: 'Edit asset',
      icon: 'i-lucide-pencil',
      onSelect() {
        router.push(`/assets/${row.original.id}/edit`)
      }
    },
    {
      label: 'Copy asset number',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(row.original.assetNumber)
        toast.add({
          title: 'Copied to clipboard',
          description: 'Asset number copied to clipboard'
        })
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Archive asset',
      icon: 'i-lucide-archive',
      color: 'error',
      onSelect() {
        archiveAsset(row.original.id)
      }
    }
  ]
}

async function archiveAsset(id: string) {
  try {
    await $fetch(`/api/assets/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Asset archived',
      description: 'The asset has been archived successfully.'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive asset.',
      color: 'error'
    })
  }
}

const statusColors = {
  active: 'success',
  inactive: 'neutral',
  maintenance: 'warning',
  disposed: 'error'
} as const

const columns: TableColumn<Asset>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      })
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
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.assetNumber)
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
        year ? h('p', { class: 'text-sm text-muted' }, year.toString()) : null
      ])
    }
  },
  {
    accessorKey: 'licensePlate',
    header: 'License Plate',
    cell: ({ row }) => row.original.licensePlate || '-'
  },
  {
    accessorKey: 'vin',
    header: 'VIN',
    cell: ({ row }) => row.original.vin || '-'
  },
  {
    accessorKey: 'mileage',
    header: 'Mileage',
    cell: ({ row }) => {
      const mileage = row.original.mileage
      return mileage ? `${Number(mileage).toLocaleString()} km` : '-'
    }
  },
  {
    accessorKey: 'operationalHours',
    header: 'Hours',
    cell: ({ row }) => {
      const hours = row.original.operationalHours
      return hours ? `${Number(hours).toLocaleString()} hrs` : '-'
    }
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => row.original.category?.name || '-'
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = statusColors[row.original.status]
      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
        row.original.status
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
            content: {
              align: 'end'
            },
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

const statusFilter = ref('all')

watch(() => statusFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return

  const statusColumn = table.value.tableApi.getColumn('status')
  if (!statusColumn) return

  if (newVal === 'all') {
    statusColumn.setFilterValue(undefined)
  } else {
    statusColumn.setFilterValue(newVal)
  }
})

const search = computed({
  get: (): string => {
    return (table.value?.tableApi?.getColumn('assetNumber')?.getFilterValue() as string) || ''
  },
  set: (value: string) => {
    table.value?.tableApi?.getColumn('assetNumber')?.setFilterValue(value || undefined)
  }
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})
</script>

<template>
  <UDashboardPanel id="assets">
    <template #header>
      <UDashboardNavbar title="Assets">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Add Asset"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/assets/new')"
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
          placeholder="Search assets..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Maintenance', value: 'maintenance' },
              { label: 'Disposed', value: 'disposed' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
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
