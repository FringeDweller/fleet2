<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

const props = withDefaults(
  defineProps<{
    limit?: number
  }>(),
  {
    limit: 5,
  },
)

const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')

interface WorkOrderListItem {
  id: string
  workOrderNumber: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  asset?: { id: string; assetNumber: string; make: string; model: string } | null
  assignee?: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  } | null
}

// Fetch recent work orders
const { data, status, refresh } = await useFetch<WorkOrderListItem[]>('/api/work-orders', {
  query: {
    status: undefined, // All statuses
  },
})

// Limit the results
const workOrders = computed(() => {
  if (!data.value) return []
  return data.value.slice(0, props.limit)
})

// Auto refresh every 5 minutes
onMounted(() => {
  const interval = setInterval(refresh, 5 * 60 * 1000)
  onUnmounted(() => clearInterval(interval))
})

// Status colors
const statusColors: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral',
}

// Priority colors
const priorityColors: Record<string, 'neutral' | 'info' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
}

// Format date
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format status
function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Table columns
const columns: TableColumn<(typeof workOrders.value)[number]>[] = [
  {
    accessorKey: 'workOrderNumber',
    header: 'WO #',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-primary' }, row.getValue('workOrderNumber')),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => h('span', { class: 'truncate max-w-[200px]' }, row.getValue('title')),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return h(
        UBadge,
        { color: statusColors[status] || 'neutral', variant: 'subtle', class: 'capitalize' },
        () => formatStatus(status),
      )
    },
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => {
      const priority = row.getValue('priority') as string
      return h(
        UBadge,
        { color: priorityColors[priority] || 'neutral', variant: 'subtle', class: 'capitalize' },
        () => priority,
      )
    },
  },
  {
    accessorKey: 'assignee',
    header: 'Assignee',
    cell: ({ row }) => {
      const assignee = row.original.assignee
      if (!assignee) return h('span', { class: 'text-muted' }, 'Unassigned')

      return h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, {
          src: assignee.avatarUrl,
          alt: `${assignee.firstName} ${assignee.lastName}`,
          size: 'xs',
        }),
        h('span', { class: 'text-sm' }, `${assignee.firstName} ${assignee.lastName}`),
      ])
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDate(row.getValue('createdAt')),
  },
]
</script>

<template>
  <UPageCard
    title="Recent Work Orders"
    variant="subtle"
    :ui="{
      header: 'border-b border-default-200 pb-3',
      body: 'p-0',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-clipboard-list" class="size-5 text-primary" />
          <span class="font-semibold">Recent Work Orders</span>
          <UBadge v-if="workOrders.length" color="neutral" variant="subtle">
            {{ workOrders.length }}
          </UBadge>
        </div>
        <NuxtLink to="/work-orders" class="text-sm text-primary hover:underline">
          View all
        </NuxtLink>
      </div>
    </template>

    <div v-if="status === 'pending'" class="p-4 text-center text-muted">
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
    </div>

    <div v-else-if="workOrders.length === 0" class="p-4 text-center text-muted">
      <UIcon name="i-lucide-clipboard-check" class="size-8 text-success mb-2" />
      <p>No work orders found</p>
    </div>

    <UTable
      v-else
      :data="workOrders"
      :columns="columns"
      class="shrink-0"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r text-xs',
        td: 'border-b border-default text-sm',
      }"
    />
  </UPageCard>
</template>
