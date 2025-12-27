<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { upperFirst } from 'scule'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'

definePageMeta({
  middleware: 'auth'
})

interface PartRow {
  id: string
  sku: string
  name: string
  description: string | null
  unit: string
  quantityInStock: string
  minimumStock: string | null
  reorderThreshold: string | null
  reorderQuantity: string | null
  unitCost: string | null
  supplier: string | null
  location: string | null
  isActive: boolean
  category: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface PartsResponse {
  data: PartRow[]
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
const categoryFilter = ref((route.query.categoryId as string) || '')
const lowStockFilter = ref(route.query.lowStock === 'true')

// Computed query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (categoryFilter.value) params.categoryId = categoryFilter.value
  if (lowStockFilter.value) params.lowStock = 'true'
  return params
})

const { data, status, refresh } = await useFetch<PartsResponse>('/api/parts', {
  lazy: true,
  query: queryParams
})

const { data: categories } = await useFetch<{ id: string; name: string }[]>(
  '/api/part-categories',
  {
    lazy: true
  }
)

const categoryOptions = computed(() => {
  return [
    { label: 'All Categories', value: '' },
    ...(categories.value?.map(c => ({ label: c.name, value: c.id })) || [])
  ]
})

function getRowItems(row: Row<PartRow>) {
  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/inventory/parts/${row.original.id}`)
      }
    },
    {
      label: 'Edit part',
      icon: 'i-lucide-pencil',
      onSelect() {
        router.push(`/inventory/parts/${row.original.id}/edit`)
      }
    },
    {
      label: 'Adjust stock',
      icon: 'i-lucide-package-plus',
      onSelect() {
        router.push(`/inventory/parts/${row.original.id}?tab=adjust`)
      }
    },
    {
      label: 'View history',
      icon: 'i-lucide-history',
      onSelect() {
        router.push(`/inventory/parts/${row.original.id}?tab=history`)
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Delete part',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect() {
        deletePart(row.original.id)
      }
    }
  ]
}

async function deletePart(id: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/parts/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Part deleted',
      description: 'The part has been deleted successfully.'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to delete part.',
      color: 'error'
    })
  }
}

function isLowStock(row: PartRow): boolean {
  if (!row.reorderThreshold) return false
  return parseFloat(row.quantityInStock) <= parseFloat(row.reorderThreshold)
}

const columns: TableColumn<PartRow>[] = [
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
    accessorKey: 'sku',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'SKU',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) => h('span', { class: 'font-mono text-sm' }, row.original.sku)
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
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      if (!row.original.category) return h('span', { class: 'text-muted' }, '-')
      return h(UBadge, { variant: 'subtle', color: 'neutral' }, () => row.original.category!.name)
    }
  },
  {
    accessorKey: 'quantityInStock',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Stock',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) => {
      const qty = parseFloat(row.original.quantityInStock)
      const lowStock = isLowStock(row.original)
      return h('div', { class: 'flex items-center gap-2' }, [
        h(
          'span',
          { class: ['font-medium', lowStock ? 'text-error' : ''] },
          `${qty.toLocaleString()} ${row.original.unit}`
        ),
        lowStock ? h(UBadge, { color: 'error', size: 'xs' }, () => 'Low') : null
      ])
    }
  },
  {
    accessorKey: 'unitCost',
    header: 'Unit Cost',
    cell: ({ row }) => {
      if (!row.original.unitCost) return h('span', { class: 'text-muted' }, '-')
      return h(
        'span',
        { class: 'text-sm' },
        `$${parseFloat(row.original.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      )
    }
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => {
      if (!row.original.location) return h('span', { class: 'text-muted' }, '-')
      return h('span', { class: 'text-sm' }, row.original.location)
    }
  },
  {
    accessorKey: 'supplier',
    header: 'Supplier',
    cell: ({ row }) => {
      if (!row.original.supplier) return h('span', { class: 'text-muted' }, '-')
      return h('span', { class: 'text-sm truncate max-w-[150px]' }, row.original.supplier)
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
  pageSize: 25
})
</script>

<template>
  <UDashboardPanel id="parts-catalog">
    <template #header>
      <UDashboardNavbar title="Parts Catalog">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/')"
          />
        </template>

        <template #right>
          <UButton
            label="Low Stock"
            :icon="lowStockFilter ? 'i-lucide-check' : 'i-lucide-alert-triangle'"
            :color="lowStockFilter ? 'warning' : 'neutral'"
            :variant="lowStockFilter ? 'soft' : 'outline'"
            @click="lowStockFilter = !lowStockFilter"
          />
          <UButton
            label="Categories"
            icon="i-lucide-folder-tree"
            color="neutral"
            variant="outline"
            @click="router.push('/inventory/parts/categories')"
          />
          <UButton
            label="New Part"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/inventory/parts/new')"
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
          placeholder="Search parts..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <USelect
            v-model="categoryFilter"
            :items="categoryOptions"
            placeholder="Filter category"
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
