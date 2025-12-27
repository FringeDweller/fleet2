<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { z } from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface LowStockPart {
  id: string
  sku: string
  name: string
  quantityInStock: string
  reorderThreshold: string | null
  reorderQuantity: string | null
  onOrderQuantity: string | null
  onOrderDate: string | null
  onOrderNotes: string | null
  unit: string
  supplier: string | null
  category: { id: string; name: string } | null
  shortage: number
  suggestedOrder: number
  effectiveStock: number
  isOnOrder: boolean
}

interface LowStockResponse {
  parts: LowStockPart[]
  summary: {
    totalLowStock: number
    criticalCount: number
    onOrderCount: number
    totalShortage: number
  }
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UTooltip = resolveComponent('UTooltip')
const NuxtLink = resolveComponent('NuxtLink')

const toast = useToast()
const includeOnOrder = ref(true)

const { data, status, refresh } = await useFetch<LowStockResponse>('/api/parts/low-stock', {
  query: computed(() => ({
    includeOnOrder: includeOnOrder.value ? 'true' : 'false',
  })),
})

const lowStockParts = computed(() => data.value?.parts || [])
const summary = computed(() => data.value?.summary)

// Mark on order modal
const isOnOrderModalOpen = ref(false)
const selectedPart = ref<(typeof lowStockParts.value)[0] | null>(null)
const isSubmitting = ref(false)

const onOrderSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional(),
})

type OnOrderFormData = z.infer<typeof onOrderSchema>

const onOrderForm = reactive<OnOrderFormData>({
  quantity: 0,
  notes: '',
})

function openOnOrderModal(part: (typeof lowStockParts.value)[0]) {
  selectedPart.value = part
  onOrderForm.quantity = part.suggestedOrder || 0
  onOrderForm.notes = ''
  isOnOrderModalOpen.value = true
}

async function handleMarkOnOrder(event: FormSubmitEvent<OnOrderFormData>) {
  if (!selectedPart.value) return

  isSubmitting.value = true
  try {
    await $fetch(`/api/parts/${selectedPart.value.id}/on-order`, {
      method: 'POST',
      body: {
        quantity: event.data.quantity,
        notes: event.data.notes,
      },
    })
    toast.add({
      title: 'Part marked as on order',
      color: 'success',
    })
    isOnOrderModalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Failed to mark part as on order',
      description: err.data?.message || 'An error occurred',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

// Receive stock modal
const isReceiveModalOpen = ref(false)
const receivePart = ref<(typeof lowStockParts.value)[0] | null>(null)

const receiveSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional(),
  clearOnOrder: z.boolean(),
})

type ReceiveFormData = z.infer<typeof receiveSchema>

const receiveForm = reactive<ReceiveFormData>({
  quantity: 0,
  notes: '',
  clearOnOrder: true,
})

function openReceiveModal(part: (typeof lowStockParts.value)[0]) {
  receivePart.value = part
  receiveForm.quantity = part.isOnOrder ? parseFloat(part.onOrderQuantity || '0') : 0
  receiveForm.notes = ''
  receiveForm.clearOnOrder = true
  isReceiveModalOpen.value = true
}

async function handleReceiveStock(event: FormSubmitEvent<ReceiveFormData>) {
  if (!receivePart.value) return

  isSubmitting.value = true
  try {
    await $fetch(`/api/parts/${receivePart.value.id}/receive`, {
      method: 'POST',
      body: {
        quantity: event.data.quantity,
        notes: event.data.notes,
        clearOnOrder: event.data.clearOnOrder,
      },
    })
    toast.add({
      title: 'Stock received successfully',
      color: 'success',
    })
    isReceiveModalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Failed to receive stock',
      description: err.data?.message || 'An error occurred',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

// Clear on order
async function clearOnOrder(part: (typeof lowStockParts.value)[0]) {
  try {
    await $fetch(`/api/parts/${part.id}/on-order`, {
      method: 'POST',
      body: { quantity: 0 },
    })
    toast.add({
      title: 'On order status cleared',
      color: 'success',
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Failed to clear on order status',
      description: err.data?.message || 'An error occurred',
      color: 'error',
    })
  }
}

const columns: TableColumn<LowStockPart>[] = [
  {
    accessorKey: 'name',
    header: 'Part',
    cell: ({ row }) =>
      h(
        NuxtLink,
        {
          to: `/inventory/parts/${row.original.id}`,
          class: 'font-medium hover:text-primary',
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: 'sku',
    header: 'SKU',
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) =>
      row.original.category ? row.original.category.name : h('span', { class: 'text-muted' }, '-'),
  },
  {
    id: 'stock',
    header: 'Current Stock',
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: Number.parseFloat(row.original.quantityInStock) === 0 ? 'error' : 'warning',
          variant: 'subtle',
        },
        () => `${Number.parseFloat(row.original.quantityInStock).toFixed(1)} ${row.original.unit}`,
      ),
  },
  {
    id: 'threshold',
    header: 'Threshold',
    cell: ({ row }) => Number.parseFloat(row.original.reorderThreshold || '0').toFixed(1),
  },
  {
    id: 'shortage',
    header: 'Shortage',
    cell: ({ row }) =>
      h('span', { class: 'text-error font-medium' }, row.original.shortage.toFixed(1)),
  },
  {
    id: 'onOrder',
    header: 'On Order',
    cell: ({ row }) =>
      row.original.isOnOrder
        ? h('div', { class: 'flex items-center gap-2' }, [
            h(UBadge, { color: 'info', variant: 'subtle' }, () =>
              Number.parseFloat(row.original.onOrderQuantity || '0').toFixed(1),
            ),
            h(UTooltip, { text: 'Clear on order' }, () =>
              h(UButton, {
                variant: 'ghost',
                color: 'neutral',
                size: 'xs',
                icon: 'i-lucide-x',
                onClick: () => clearOnOrder(row.original),
              }),
            ),
          ])
        : h('span', { class: 'text-muted' }, '-'),
  },
  {
    accessorKey: 'supplier',
    header: 'Supplier',
    cell: ({ row }) =>
      row.original.supplier ? row.original.supplier : h('span', { class: 'text-muted' }, '-'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-end gap-1' }, [
        !row.original.isOnOrder
          ? h(UTooltip, { text: 'Mark as on order' }, () =>
              h(UButton, {
                variant: 'ghost',
                color: 'primary',
                size: 'xs',
                icon: 'i-lucide-shopping-cart',
                onClick: () => openOnOrderModal(row.original),
              }),
            )
          : null,
        h(UTooltip, { text: 'Receive stock' }, () =>
          h(UButton, {
            variant: 'ghost',
            color: 'success',
            size: 'xs',
            icon: 'i-lucide-package-plus',
            onClick: () => openReceiveModal(row.original),
          }),
        ),
      ]),
  },
]
</script>

<template>
  <UDashboardPanel id="reorder-alerts">
    <template #header>
      <UDashboardNavbar title="Reorder Alerts">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="status === 'pending'"
            @click="refresh()"
          >
            Refresh
          </UButton>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UCheckbox v-model="includeOnOrder" label="Include parts on order" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Summary cards -->
      <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <UPageCard
          icon="i-lucide-alert-triangle"
          title="Low Stock"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5',
            wrapper: 'items-start',
            leading: 'p-2.5 rounded-full bg-warning/10 ring ring-inset ring-warning/25',
            title: 'font-normal text-muted text-xs uppercase',
          }"
        >
          <span class="text-2xl font-semibold text-highlighted">
            {{ summary?.totalLowStock || 0 }}
          </span>
        </UPageCard>

        <UPageCard
          icon="i-lucide-x-circle"
          title="Out of Stock"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5',
            wrapper: 'items-start',
            leading: 'p-2.5 rounded-full bg-error/10 ring ring-inset ring-error/25',
            title: 'font-normal text-muted text-xs uppercase',
          }"
        >
          <span class="text-2xl font-semibold text-highlighted">
            {{ summary?.criticalCount || 0 }}
          </span>
        </UPageCard>

        <UPageCard
          icon="i-lucide-truck"
          title="On Order"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5',
            wrapper: 'items-start',
            leading: 'p-2.5 rounded-full bg-info/10 ring ring-inset ring-info/25',
            title: 'font-normal text-muted text-xs uppercase',
          }"
        >
          <span class="text-2xl font-semibold text-highlighted">
            {{ summary?.onOrderCount || 0 }}
          </span>
        </UPageCard>

        <UPageCard
          icon="i-lucide-package-minus"
          title="Total Shortage"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5',
            wrapper: 'items-start',
            leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25',
            title: 'font-normal text-muted text-xs uppercase',
          }"
        >
          <span class="text-2xl font-semibold text-highlighted">
            {{ summary?.totalShortage?.toFixed(0) || 0 }}
          </span>
        </UPageCard>
      </UPageGrid>

      <!-- Parts table -->
      <UTable :columns="columns" :data="lowStockParts" :loading="status === 'pending'">
        <template #empty>
          <div class="text-center py-8">
            <UIcon name="i-lucide-check-circle" class="size-12 text-success mb-2" />
            <p class="text-lg font-medium">All parts are adequately stocked</p>
            <p class="text-muted text-sm">No parts are currently below their reorder threshold</p>
          </div>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>

  <!-- Mark On Order Modal -->
  <UModal v-model:open="isOnOrderModalOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Mark as On Order</h3>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              @click="isOnOrderModalOpen = false"
            />
          </div>
        </template>

        <div v-if="selectedPart" class="mb-4 p-3 bg-default-50 rounded-lg">
          <div class="font-medium">{{ selectedPart.name }}</div>
          <div class="text-sm text-muted">SKU: {{ selectedPart.sku }}</div>
          <div class="text-sm mt-1">
            Current stock:
            <span class="font-medium">{{ parseFloat(selectedPart.quantityInStock).toFixed(1) }}</span>
            / Threshold:
            <span class="font-medium">
              {{ parseFloat(selectedPart.reorderThreshold || '0').toFixed(1) }}
            </span>
          </div>
        </div>

        <UForm :schema="onOrderSchema" :state="onOrderForm" @submit="handleMarkOnOrder">
          <div class="space-y-4">
            <UFormField label="Order Quantity" name="quantity">
              <UInput
                v-model.number="onOrderForm.quantity"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter quantity ordered"
              />
            </UFormField>

            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="onOrderForm.notes"
                placeholder="Order reference, supplier, expected delivery..."
              />
            </UFormField>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <UButton variant="ghost" color="neutral" @click="isOnOrderModalOpen = false">
              Cancel
            </UButton>
            <UButton type="submit" :loading="isSubmitting"> Mark as On Order </UButton>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>

  <!-- Receive Stock Modal -->
  <UModal v-model:open="isReceiveModalOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Receive Stock</h3>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              @click="isReceiveModalOpen = false"
            />
          </div>
        </template>

        <div v-if="receivePart" class="mb-4 p-3 bg-default-50 rounded-lg">
          <div class="font-medium">{{ receivePart.name }}</div>
          <div class="text-sm text-muted">SKU: {{ receivePart.sku }}</div>
          <div class="text-sm mt-1">
            Current stock:
            <span class="font-medium">{{ parseFloat(receivePart.quantityInStock).toFixed(1) }}</span>
            <span v-if="receivePart.isOnOrder" class="text-info">
              ({{ parseFloat(receivePart.onOrderQuantity || '0').toFixed(1) }} on order)
            </span>
          </div>
        </div>

        <UForm :schema="receiveSchema" :state="receiveForm" @submit="handleReceiveStock">
          <div class="space-y-4">
            <UFormField label="Quantity Received" name="quantity">
              <UInput
                v-model.number="receiveForm.quantity"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter quantity received"
              />
            </UFormField>

            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="receiveForm.notes"
                placeholder="Delivery reference, invoice number..."
              />
            </UFormField>

            <UCheckbox
              v-if="receivePart?.isOnOrder"
              v-model="receiveForm.clearOnOrder"
              label="Clear 'on order' status after receiving"
            />
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <UButton variant="ghost" color="neutral" @click="isReceiveModalOpen = false">
              Cancel
            </UButton>
            <UButton type="submit" color="success" :loading="isSubmitting"> Receive Stock </UButton>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
