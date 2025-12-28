<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
})

interface CountSession {
  id: string
  name: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  startedAt: string
  completedAt: string | null
  startedBy: {
    id: string
    firstName: string
    lastName: string
  }
  itemsCount: number
  pendingCount: number
  countedCount: number
  approvedCount: number
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const toast = useToast()
const router = useRouter()

const {
  data: sessions,
  status,
  refresh,
} = await useFetch<CountSession[]>('/api/inventory/count', {
  lazy: true,
})

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const statusFilter = ref('')

async function startNewCount() {
  router.push('/inventory/count/new')
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'in_progress':
      return { color: 'warning' as const, label: 'In Progress' }
    case 'completed':
      return { color: 'success' as const, label: 'Completed' }
    case 'cancelled':
      return { color: 'error' as const, label: 'Cancelled' }
    default:
      return { color: 'neutral' as const, label: status }
  }
}

const columns: TableColumn<CountSession>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) =>
      h('div', [
        h('p', { class: 'font-medium text-highlighted' }, row.original.name || 'Unnamed Count'),
        h(
          'p',
          { class: 'text-sm text-muted' },
          `Started ${new Date(row.original.startedAt).toLocaleDateString()}`,
        ),
      ]),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const badge = getStatusBadge(row.original.status)
      return h(UBadge, { color: badge.color, variant: 'subtle' }, () => badge.label)
    },
  },
  {
    accessorKey: 'startedBy',
    header: 'Started By',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm' },
        `${row.original.startedBy.firstName} ${row.original.startedBy.lastName}`,
      ),
  },
  {
    accessorKey: 'itemsCount',
    header: 'Items',
    cell: ({ row }) => {
      const { itemsCount, pendingCount, countedCount, approvedCount } = row.original
      return h('div', { class: 'text-sm' }, [
        h('p', { class: 'font-medium' }, `${itemsCount} total`),
        h('p', { class: 'text-muted' }, [
          `${pendingCount} pending, `,
          `${countedCount} counted, `,
          `${approvedCount} approved`,
        ]),
      ])
    },
  },
  {
    id: 'actions',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-right' },
        h(UButton, {
          label: row.original.status === 'in_progress' ? 'Continue' : 'View',
          color: row.original.status === 'in_progress' ? 'primary' : 'neutral',
          variant: 'outline',
          size: 'sm',
          onClick: () => router.push(`/inventory/count/${row.original.id}`),
        }),
      ),
  },
]

const pagination = ref({
  pageIndex: 0,
  pageSize: 25,
})
</script>

<template>
  <UDashboardPanel id="inventory-count">
    <template #header>
      <UDashboardNavbar title="Inventory Count">
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
            label="Start New Count"
            icon="i-lucide-clipboard-list"
            color="primary"
            @click="startNewCount"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5 mb-4">
        <div class="flex items-center gap-1.5">
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            placeholder="Filter by status"
            class="min-w-40"
          />
        </div>
      </div>

      <UTable
        :data="sessions"
        :columns="columns"
        :loading="status === 'pending'"
        v-model:pagination="pagination"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
        }"
      />

      <div v-if="!sessions || sessions.length === 0" class="text-center py-12">
        <p class="text-muted mb-4">No inventory count sessions yet.</p>
        <UButton
          label="Start Your First Count"
          icon="i-lucide-clipboard-list"
          color="primary"
          @click="startNewCount"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
