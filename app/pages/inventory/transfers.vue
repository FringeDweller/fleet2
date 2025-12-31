<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { formatDistanceToNow } from 'date-fns'
import { z } from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface Transfer {
  id: string
  quantity: string
  notes: string | null
  referenceNumber: string | null
  createdAt: string
  part: {
    id: string
    sku: string
    name: string
    unit: string
  }
  fromLocation: {
    id: string
    name: string
    code: string | null
  }
  toLocation: {
    id: string
    name: string
    code: string | null
  }
  transferredBy: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface TransfersResponse {
  data: Transfer[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

interface Part {
  id: string
  sku: string
  name: string
  unit: string
}

interface StorageLocation {
  id: string
  name: string
  code: string | null
  type: string
}

interface LocationQuantity {
  locationId: string
  locationName: string
  locationType: string
  locationCode: string | null
  quantity: number
}

const UBadge = resolveComponent('UBadge')

const router = useRouter()
const toast = useToast()

// Filters
const partFilter = ref('')
const locationFilter = ref('')

// Transfer modal
const isTransferModalOpen = ref(false)
const isSubmitting = ref(false)

// Fetch transfers
const queryParams = computed(() => ({
  partId: partFilter.value || undefined,
  locationId: locationFilter.value || undefined,
  limit: '50',
}))

const {
  data: transfersResponse,
  status,
  refresh,
} = await useFetch<TransfersResponse>('/api/inventory/transfers', {
  query: queryParams,
  lazy: true,
})

// Fetch parts for dropdown
const { data: partsData } = await useFetch<{ data: Part[] }>('/api/parts', {
  query: { limit: '500' },
  lazy: true,
})

// Fetch locations for dropdown
const { data: locationsData } = await useFetch<{ data: StorageLocation[] }>(
  '/api/storage-locations',
  {
    query: { limit: '100' },
    lazy: true,
  },
)

const transfers = computed(() => transfersResponse.value?.data || [])
const parts = computed(() => partsData.value?.data || [])
const locations = computed(() => locationsData.value?.data || [])

const partOptions = computed(() => [
  { label: 'All Parts', value: '' },
  ...parts.value.map((p: Part) => ({
    label: `${p.sku} - ${p.name}`,
    value: p.id,
  })),
])

const locationOptions = computed(() => [
  { label: 'All Locations', value: '' },
  ...locations.value.map((l: StorageLocation) => ({
    label: l.code ? `${l.code} - ${l.name}` : l.name,
    value: l.id,
  })),
])

// Transfer form
const transferSchema = z.object({
  partId: z.string().uuid('Please select a part'),
  fromLocationId: z.string().uuid('Please select a source location'),
  toLocationId: z.string().uuid('Please select a destination location'),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
})

type TransferSchema = z.output<typeof transferSchema>

const transferState = reactive<Partial<TransferSchema>>({
  partId: '',
  fromLocationId: '',
  toLocationId: '',
  quantity: 0,
  notes: '',
  referenceNumber: '',
})

// Fetch available quantity at source location
const selectedPartLocations = ref<LocationQuantity[]>([])
const loadingPartLocations = ref(false)

watch(
  () => transferState.partId,
  async (partId) => {
    if (!partId) {
      selectedPartLocations.value = []
      return
    }

    loadingPartLocations.value = true
    try {
      const response = await $fetch<{ locations: LocationQuantity[] }>(
        `/api/parts/${partId}/locations`,
      )
      selectedPartLocations.value = response.locations
    } catch {
      selectedPartLocations.value = []
    } finally {
      loadingPartLocations.value = false
    }
  },
)

const fromLocationOptions = computed(() => {
  if (!transferState.partId) {
    return locations.value.map((l: StorageLocation) => ({
      label: l.code ? `${l.code} - ${l.name}` : l.name,
      value: l.id,
      disabled: true,
    }))
  }

  return selectedPartLocations.value.map((l: LocationQuantity) => ({
    label: `${l.locationCode ? `${l.locationCode} - ` : ''}${l.locationName} (${l.quantity} available)`,
    value: l.locationId,
  }))
})

const toLocationOptions = computed(() => {
  return locations.value
    .filter((l: StorageLocation) => l.id !== transferState.fromLocationId)
    .map((l: StorageLocation) => ({
      label: l.code ? `${l.code} - ${l.name}` : l.name,
      value: l.id,
    }))
})

const availableQuantity = computed(() => {
  if (!transferState.fromLocationId) return 0
  const loc = selectedPartLocations.value.find((l) => l.locationId === transferState.fromLocationId)
  return loc?.quantity || 0
})

const selectedPart = computed(() => {
  if (!transferState.partId) return null
  return parts.value.find((p: Part) => p.id === transferState.partId)
})

function openTransferModal() {
  transferState.partId = ''
  transferState.fromLocationId = ''
  transferState.toLocationId = ''
  transferState.quantity = 0
  transferState.notes = ''
  transferState.referenceNumber = ''
  selectedPartLocations.value = []
  isTransferModalOpen.value = true
}

async function submitTransfer(event: FormSubmitEvent<TransferSchema>) {
  if (event.data.fromLocationId === event.data.toLocationId) {
    toast.add({
      title: 'Error',
      description: 'Source and destination locations must be different.',
      color: 'error',
    })
    return
  }

  isSubmitting.value = true
  try {
    await $fetch('/api/inventory/transfer', {
      method: 'POST',
      body: event.data,
    })

    toast.add({
      title: 'Transfer completed',
      description: 'Inventory has been transferred successfully.',
      color: 'success',
    })

    isTransferModalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Transfer failed',
      description: err.data?.statusMessage || 'Failed to transfer inventory.',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

function clearFilters() {
  partFilter.value = ''
  locationFilter.value = ''
}

const hasFilters = computed(() => partFilter.value || locationFilter.value)

const columns: TableColumn<Transfer>[] = [
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
    id: 'transfer',
    header: 'Transfer',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h('div', { class: 'text-right' }, [
          h('p', { class: 'font-medium' }, row.original.fromLocation.name),
          row.original.fromLocation.code
            ? h('p', { class: 'text-xs text-muted font-mono' }, row.original.fromLocation.code)
            : null,
        ]),
        h(UBadge, { color: 'info', variant: 'subtle', size: 'sm' }, () => '\u2192'),
        h('div', [
          h('p', { class: 'font-medium' }, row.original.toLocation.name),
          row.original.toLocation.code
            ? h('p', { class: 'text-xs text-muted font-mono' }, row.original.toLocation.code)
            : null,
        ]),
      ]),
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
    cell: ({ row }) =>
      h('div', { class: 'text-center' }, [
        h('p', { class: 'font-bold text-lg' }, parseFloat(row.original.quantity).toLocaleString()),
        h('p', { class: 'text-xs text-muted' }, row.original.part.unit),
      ]),
  },
  {
    accessorKey: 'referenceNumber',
    header: 'Reference',
    cell: ({ row }) =>
      row.original.referenceNumber
        ? h('span', { class: 'font-mono text-sm' }, row.original.referenceNumber)
        : h('span', { class: 'text-muted' }, '-'),
  },
  {
    accessorKey: 'transferredBy',
    header: 'Transferred By',
    cell: ({ row }) =>
      row.original.transferredBy
        ? h(
            'span',
            { class: 'text-sm' },
            `${row.original.transferredBy.firstName} ${row.original.transferredBy.lastName}`,
          )
        : h('span', { class: 'text-muted' }, '-'),
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) =>
      row.original.notes
        ? h(
            'p',
            { class: 'text-sm truncate max-w-[150px]', title: row.original.notes },
            row.original.notes,
          )
        : h('span', { class: 'text-muted' }, '-'),
  },
]
</script>

<template>
  <UDashboardPanel id="inventory-transfers">
    <template #header>
      <UDashboardNavbar title="Inventory Transfers">
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
            label="New Transfer"
            icon="i-lucide-arrow-right-left"
            color="primary"
            @click="openTransferModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <USelect
          v-model="partFilter"
          :items="partOptions"
          placeholder="Filter by part"
          class="min-w-48"
        />

        <USelect
          v-model="locationFilter"
          :items="locationOptions"
          placeholder="Filter by location"
          class="min-w-48"
        />
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ transfersResponse?.pagination.total || 0 }}
            </p>
            <p class="text-sm text-muted">Total Transfers</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ transfers.filter((t: Transfer) => {
                const date = new Date(t.createdAt)
                const today = new Date()
                return date.toDateString() === today.toDateString()
              }).length }}
            </p>
            <p class="text-sm text-muted">Today</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold">
              {{ locations.length }}
            </p>
            <p class="text-sm text-muted">Active Locations</p>
          </div>
        </UCard>
      </div>

      <!-- Table -->
      <UTable
        :data="transfers"
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

      <!-- Empty State -->
      <div
        v-if="status !== 'pending' && transfers.length === 0"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-arrow-right-left" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">No transfers found</h3>
        <p class="text-muted mb-4">
          {{ hasFilters ? 'Try adjusting your filters.' : 'Transfer inventory between locations to see history here.' }}
        </p>
        <div class="flex justify-center gap-2">
          <UButton
            v-if="hasFilters"
            label="Clear Filters"
            @click="clearFilters"
          />
          <UButton
            label="New Transfer"
            color="primary"
            @click="openTransferModal"
          />
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="transfers.length > 0"
        class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto"
      >
        <div class="text-sm text-muted">
          Showing {{ transfers.length }} of {{ transfersResponse?.pagination.total || 0 }} transfers
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Transfer Modal -->
  <UModal v-model:open="isTransferModalOpen" :ui="{ content: 'sm:max-w-lg' }">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Transfer Inventory</h3>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              @click="isTransferModalOpen = false"
            />
          </div>
        </template>

        <UForm :schema="transferSchema" :state="transferState" class="space-y-4" @submit="submitTransfer">
          <UFormField label="Part" name="partId" required>
            <USelect
              v-model="transferState.partId"
              :items="partOptions.slice(1)"
              placeholder="Select a part"
              class="w-full"
            />
          </UFormField>

          <div v-if="loadingPartLocations" class="flex items-center gap-2 text-muted text-sm">
            <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
            Loading locations...
          </div>

          <div v-else-if="transferState.partId && selectedPartLocations.length === 0" class="text-warning text-sm p-3 bg-warning/10 rounded-lg">
            <UIcon name="i-lucide-alert-triangle" class="w-4 h-4 inline mr-1" />
            This part has no inventory in any location.
          </div>

          <UFormField
            v-if="transferState.partId && selectedPartLocations.length > 0"
            label="From Location"
            name="fromLocationId"
            required
          >
            <USelect
              v-model="transferState.fromLocationId"
              :items="fromLocationOptions"
              placeholder="Select source location"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="transferState.fromLocationId"
            label="To Location"
            name="toLocationId"
            required
          >
            <USelect
              v-model="transferState.toLocationId"
              :items="toLocationOptions"
              placeholder="Select destination location"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="transferState.toLocationId"
            label="Quantity"
            name="quantity"
            :hint="`Available: ${availableQuantity} ${selectedPart?.unit || ''}`"
            required
          >
            <UInput
              v-model.number="transferState.quantity"
              type="number"
              :min="0.01"
              :max="availableQuantity"
              step="0.01"
              placeholder="Enter quantity to transfer"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Reference Number" name="referenceNumber">
            <UInput
              v-model="transferState.referenceNumber"
              placeholder="e.g., TR-2024-001"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Notes" name="notes">
            <UTextarea
              v-model="transferState.notes"
              placeholder="Reason for transfer..."
              :rows="2"
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-4">
            <UButton
              label="Cancel"
              variant="ghost"
              color="neutral"
              @click="isTransferModalOpen = false"
            />
            <UButton
              type="submit"
              label="Transfer"
              icon="i-lucide-arrow-right-left"
              :loading="isSubmitting"
              :disabled="!transferState.partId || !transferState.fromLocationId || !transferState.toLocationId || !transferState.quantity"
            />
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
