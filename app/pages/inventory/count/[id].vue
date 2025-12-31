<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { z } from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface CountItem {
  id: string
  part: {
    id: string
    sku: string
    name: string
    unit: string
  }
  location: string | null
  systemQuantity: string
  countedQuantity: string | null
  discrepancy: string | null
  status: 'pending' | 'counted' | 'approved' | 'rejected'
  notes: string | null
  adjustmentReason: string | null
}

interface CountSession {
  id: string
  name: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  startedAt: string
  completedAt: string | null
  startedBy: {
    firstName: string
    lastName: string
  }
  items: CountItem[]
  stats: {
    total: number
    pending: number
    counted: number
    approved: number
    rejected: number
    totalDiscrepancy: number
  }
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UModal = resolveComponent('UModal')

const route = useRoute()
const router = useRouter()
const toast = useToast()

const sessionId = route.params.id as string

const {
  data: session,
  status,
  refresh,
} = await useFetch<CountSession>(`/api/inventory/count/${sessionId}`, { lazy: true })

// Modal states
const editingItem = ref<CountItem | null>(null)
const isEditModalOpen = ref(false)
const countedQuantity = ref('')
const countNotes = ref('')

const approvingItem = ref<CountItem | null>(null)
const isApproveModalOpen = ref(false)
const adjustmentReason = ref('')

const filterStatus = ref('')

const filteredItems = computed(() => {
  if (!session.value?.items) return []
  if (!filterStatus.value) return session.value.items
  return session.value.items.filter((item: CountItem) => item.status === filterStatus.value)
})

function openEditModal(item: CountItem) {
  editingItem.value = item
  countedQuantity.value = item.countedQuantity || ''
  countNotes.value = item.notes || ''
  isEditModalOpen.value = true
}

function openApproveModal(item: CountItem) {
  approvingItem.value = item
  adjustmentReason.value = item.adjustmentReason || ''
  isApproveModalOpen.value = true
}

async function updateCount() {
  if (!editingItem.value) return

  try {
    await $fetch(`/api/inventory/count/${sessionId}/items/${editingItem.value.id}`, {
      method: 'PUT',
      body: {
        countedQuantity: countedQuantity.value,
        notes: countNotes.value,
      },
    })

    toast.add({
      title: 'Count Updated',
      description: 'Item count has been updated successfully.',
      color: 'success',
    })

    isEditModalOpen.value = false
    refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update count.',
      color: 'error',
    })
  }
}

async function approveAdjustment() {
  if (!approvingItem.value) return

  try {
    await $fetch(`/api/inventory/count/${sessionId}/items/${approvingItem.value.id}/approve`, {
      method: 'POST',
      body: {
        adjustmentReason: adjustmentReason.value,
      },
    })

    toast.add({
      title: 'Adjustment Approved',
      description: 'Inventory adjustment has been applied.',
      color: 'success',
    })

    isApproveModalOpen.value = false
    refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to approve adjustment.',
      color: 'error',
    })
  }
}

async function completeSession() {
  if (
    !confirm(
      'Are you sure you want to complete this inventory count? This action cannot be undone.',
    )
  ) {
    return
  }

  try {
    await $fetch(`/api/inventory/count/${sessionId}/complete`, {
      method: 'POST',
    })

    toast.add({
      title: 'Count Completed',
      description: 'Inventory count session has been completed.',
      color: 'success',
    })

    refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to complete count.',
      color: 'error',
    })
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return { color: 'neutral' as const, label: 'Pending' }
    case 'counted':
      return { color: 'info' as const, label: 'Counted' }
    case 'approved':
      return { color: 'success' as const, label: 'Approved' }
    case 'rejected':
      return { color: 'error' as const, label: 'Rejected' }
    default:
      return { color: 'neutral' as const, label: status }
  }
}

const columns: TableColumn<CountItem>[] = [
  {
    accessorKey: 'part.sku',
    header: 'SKU',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm' }, row.original.part.sku),
  },
  {
    accessorKey: 'part.name',
    header: 'Part Name',
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.original.part.name),
  },
  {
    accessorKey: 'systemQuantity',
    header: 'System Qty',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm' },
        `${parseFloat(row.original.systemQuantity).toLocaleString()} ${row.original.part.unit}`,
      ),
  },
  {
    accessorKey: 'countedQuantity',
    header: 'Counted Qty',
    cell: ({ row }) => {
      if (!row.original.countedQuantity) {
        return h('span', { class: 'text-muted text-sm' }, '—')
      }
      return h(
        'span',
        { class: 'text-sm' },
        `${parseFloat(row.original.countedQuantity).toLocaleString()} ${row.original.part.unit}`,
      )
    },
  },
  {
    accessorKey: 'discrepancy',
    header: 'Discrepancy',
    cell: ({ row }) => {
      if (!row.original.discrepancy) {
        return h('span', { class: 'text-muted text-sm' }, '—')
      }
      const disc = parseFloat(row.original.discrepancy)
      const color = disc > 0 ? 'text-success' : disc < 0 ? 'text-error' : 'text-muted'
      return h(
        'span',
        { class: `text-sm font-medium ${color}` },
        `${disc > 0 ? '+' : ''}${disc.toLocaleString()}`,
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const badge = getStatusBadge(row.original.status)
      return h(UBadge, { color: badge.color, variant: 'subtle', size: 'sm' }, () => badge.label)
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const item = row.original
      const canEdit = session.value?.status === 'in_progress'

      return h('div', { class: 'flex gap-1 justify-end' }, [
        canEdit && (item.status === 'pending' || item.status === 'counted')
          ? h(UButton, {
              label: item.status === 'pending' ? 'Count' : 'Edit',
              color: 'primary',
              variant: 'outline',
              size: 'xs',
              onClick: () => openEditModal(item),
            })
          : null,
        canEdit && item.status === 'counted'
          ? h(UButton, {
              label: 'Approve',
              color: 'success',
              variant: 'outline',
              size: 'xs',
              onClick: () => openApproveModal(item),
            })
          : null,
      ])
    },
  },
]
</script>

<template>
  <UDashboardPanel id="inventory-count-detail">
    <template #header>
      <UDashboardNavbar :title="session?.name || 'Inventory Count'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/inventory/count')"
          />
        </template>

        <template #right>
          <UButton
            v-if="session?.status === 'in_progress'"
            label="Complete Count"
            icon="i-lucide-check"
            color="success"
            @click="completeSession"
            :disabled="session.stats.pending > 0"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div class="p-4 border border-default rounded-lg">
          <p class="text-sm text-muted">Total Items</p>
          <p class="text-2xl font-bold">{{ session?.stats.total || 0 }}</p>
        </div>
        <div class="p-4 border border-default rounded-lg">
          <p class="text-sm text-muted">Pending</p>
          <p class="text-2xl font-bold text-warning">{{ session?.stats.pending || 0 }}</p>
        </div>
        <div class="p-4 border border-default rounded-lg">
          <p class="text-sm text-muted">Counted</p>
          <p class="text-2xl font-bold text-info">{{ session?.stats.counted || 0 }}</p>
        </div>
        <div class="p-4 border border-default rounded-lg">
          <p class="text-sm text-muted">Approved</p>
          <p class="text-2xl font-bold text-success">{{ session?.stats.approved || 0 }}</p>
        </div>
        <div class="p-4 border border-default rounded-lg">
          <p class="text-sm text-muted">Total Discrepancy</p>
          <p
            class="text-2xl font-bold"
            :class="{
              'text-success': (session?.stats.totalDiscrepancy || 0) > 0,
              'text-error': (session?.stats.totalDiscrepancy || 0) < 0,
            }"
          >
            {{ session?.stats.totalDiscrepancy || 0 }}
          </p>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex gap-2 mb-4">
        <UButton
          :label="`All (${session?.stats.total || 0})`"
          :color="filterStatus === '' ? 'primary' : 'neutral'"
          :variant="filterStatus === '' ? 'solid' : 'outline'"
          size="sm"
          @click="filterStatus = ''"
        />
        <UButton
          :label="`Pending (${session?.stats.pending || 0})`"
          :color="filterStatus === 'pending' ? 'warning' : 'neutral'"
          :variant="filterStatus === 'pending' ? 'solid' : 'outline'"
          size="sm"
          @click="filterStatus = 'pending'"
        />
        <UButton
          :label="`Counted (${session?.stats.counted || 0})`"
          :color="filterStatus === 'counted' ? 'info' : 'neutral'"
          :variant="filterStatus === 'counted' ? 'solid' : 'outline'"
          size="sm"
          @click="filterStatus = 'counted'"
        />
        <UButton
          :label="`Approved (${session?.stats.approved || 0})`"
          :color="filterStatus === 'approved' ? 'success' : 'neutral'"
          :variant="filterStatus === 'approved' ? 'solid' : 'outline'"
          size="sm"
          @click="filterStatus = 'approved'"
        />
      </div>

      <!-- Items Table -->
      <UTable
        :data="filteredItems"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
        }"
      />

      <!-- Edit Count Modal -->
      <UModal v-model:open="isEditModalOpen" title="Update Count">
        <div class="p-4 space-y-4">
          <div>
            <p class="font-medium">{{ editingItem?.part.name }}</p>
            <p class="text-sm text-muted">SKU: {{ editingItem?.part.sku }}</p>
            <p class="text-sm text-muted">
              System Quantity: {{ editingItem?.systemQuantity }} {{ editingItem?.part.unit }}
            </p>
          </div>

          <UFormField label="Counted Quantity" required>
            <UInput
              v-model="countedQuantity"
              type="number"
              step="0.01"
              placeholder="Enter counted quantity"
            />
          </UFormField>

          <UFormField label="Notes">
            <UTextarea v-model="countNotes" placeholder="Add notes..." :rows="3" />
          </UFormField>

          <div class="flex gap-2">
            <UButton label="Save Count" color="primary" @click="updateCount" />
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="isEditModalOpen = false"
            />
          </div>
        </div>
      </UModal>

      <!-- Approve Adjustment Modal -->
      <UModal v-model:open="isApproveModalOpen" title="Approve Adjustment">
        <div class="p-4 space-y-4">
          <div>
            <p class="font-medium">{{ approvingItem?.part.name }}</p>
            <p class="text-sm text-muted">SKU: {{ approvingItem?.part.sku }}</p>
            <div class="mt-2 p-3 bg-elevated rounded-lg">
              <p class="text-sm">
                <span class="text-muted">System:</span>
                <span class="font-medium ml-2"
                  >{{ approvingItem?.systemQuantity }} {{ approvingItem?.part.unit }}</span
                >
              </p>
              <p class="text-sm">
                <span class="text-muted">Counted:</span>
                <span class="font-medium ml-2"
                  >{{ approvingItem?.countedQuantity }} {{ approvingItem?.part.unit }}</span
                >
              </p>
              <p class="text-sm">
                <span class="text-muted">Discrepancy:</span>
                <span
                  class="font-bold ml-2"
                  :class="{
                    'text-success': parseFloat(approvingItem?.discrepancy || '0') > 0,
                    'text-error': parseFloat(approvingItem?.discrepancy || '0') < 0,
                  }"
                >
                  {{ parseFloat(approvingItem?.discrepancy || '0') > 0 ? '+' : ''
                  }}{{ approvingItem?.discrepancy }}
                </span>
              </p>
            </div>
          </div>

          <UFormField label="Adjustment Reason" required>
            <UTextarea
              v-model="adjustmentReason"
              placeholder="Explain the reason for this adjustment..."
              :rows="3"
            />
          </UFormField>

          <UAlert
            title="Warning"
            description="Approving this adjustment will update the part's stock quantity. This action cannot be undone."
            color="warning"
            icon="i-lucide-alert-triangle"
          />

          <div class="flex gap-2">
            <UButton label="Approve Adjustment" color="success" @click="approveAdjustment" />
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="isApproveModalOpen = false"
            />
          </div>
        </div>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
