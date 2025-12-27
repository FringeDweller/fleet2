<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { formatDistanceToNow } from 'date-fns'

definePageMeta({
  middleware: 'auth'
})

interface PartUsageHistory {
  id: string
  usageType: string
  quantityChange: string
  previousQuantity: string
  newQuantity: string
  unitCostAtTime: string | null
  notes: string | null
  reference: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string } | null
  workOrder: { id: string; workOrderNumber: string; title: string } | null
}

interface Part {
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
  supplierPartNumber: string | null
  location: string | null
  isActive: boolean
  category: { id: string; name: string } | null
  usageHistory: PartUsageHistory[]
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const {
  data: part,
  status,
  error,
  refresh
} = await useFetch<Part>(`/api/parts/${route.params.id}`, {
  lazy: true
})

// Active tab
const activeTab = ref((route.query.tab as string) || 'details')

// Stock adjustment form
const adjustmentSchema = z.object({
  usageType: z.enum(['adjustment', 'restock', 'return', 'damaged', 'expired']),
  quantityChange: z.number().refine(val => val !== 0, 'Quantity change cannot be zero'),
  notes: z.string().optional(),
  reference: z.string().max(200).optional()
})

type AdjustmentSchema = z.output<typeof adjustmentSchema>

const adjustmentState = reactive<Partial<AdjustmentSchema>>({
  usageType: 'adjustment',
  quantityChange: 0
})

const adjusting = ref(false)

async function submitAdjustment(event: FormSubmitEvent<AdjustmentSchema>) {
  adjusting.value = true
  try {
    await $fetch(`/api/parts/${route.params.id}/adjust-stock`, {
      method: 'POST',
      body: event.data
    })
    toast.add({
      title: 'Stock adjusted',
      description: 'The stock level has been updated.',
      color: 'success'
    })
    adjustmentState.quantityChange = 0
    adjustmentState.notes = undefined
    adjustmentState.reference = undefined
    refresh()
    activeTab.value = 'details'
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to adjust stock.',
      color: 'error'
    })
  } finally {
    adjusting.value = false
  }
}

async function deletePart() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/parts/${route.params.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Part deleted',
      description: 'The part has been deleted successfully.'
    })
    router.push('/inventory/parts')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to delete part.',
      color: 'error'
    })
  }
}

const usageTypeOptions = [
  { label: 'Adjustment', value: 'adjustment' },
  { label: 'Restock', value: 'restock' },
  { label: 'Return', value: 'return' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Expired', value: 'expired' }
]

const usageTypeColors: Record<string, string> = {
  work_order: 'error',
  adjustment: 'info',
  restock: 'success',
  return: 'warning',
  damaged: 'error',
  expired: 'error'
}

function isLowStock(): boolean {
  if (!part.value?.reorderThreshold) return false
  return parseFloat(part.value.quantityInStock) <= parseFloat(part.value.reorderThreshold)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <UDashboardPanel id="part-detail">
    <template #header>
      <UDashboardNavbar :title="part?.name || 'Part Details'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/inventory/parts')"
          />
        </template>

        <template #right>
          <div class="flex gap-2">
            <UButton
              label="Adjust Stock"
              icon="i-lucide-package-plus"
              color="neutral"
              variant="outline"
              @click="activeTab = 'adjust'"
            />
            <UButton
              label="Edit"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              @click="router.push(`/inventory/parts/${route.params.id}/edit`)"
            />
            <UButton
              label="Delete"
              icon="i-lucide-trash-2"
              color="error"
              variant="subtle"
              @click="deletePart"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="error" class="text-center py-12">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-error mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">Part not found</h3>
        <p class="text-muted mb-4">
          The part you're looking for doesn't exist or has been removed.
        </p>
        <UButton label="Back to Parts" @click="router.push('/inventory/parts')" />
      </div>

      <div v-else-if="part" class="space-y-6">
        <!-- Header Info -->
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold">
                {{ part.name }}
              </h1>
              <UBadge v-if="isLowStock()" color="error" variant="subtle"> Low Stock </UBadge>
              <UBadge v-if="!part.isActive" color="neutral" variant="subtle"> Inactive </UBadge>
            </div>
            <p class="text-muted font-mono">
              {{ part.sku }}
            </p>
            <p v-if="part.category" class="text-sm text-muted mt-1">
              Category: {{ part.category.name }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-3xl font-bold">
              {{ parseFloat(part.quantityInStock).toLocaleString() }}
            </p>
            <p class="text-muted">{{ part.unit }} in stock</p>
          </div>
        </div>

        <!-- Tabs -->
        <UTabs
          v-model="activeTab"
          :items="[
            { label: 'Details', value: 'details', icon: 'i-lucide-info' },
            { label: 'Adjust Stock', value: 'adjust', icon: 'i-lucide-package-plus' },
            { label: 'History', value: 'history', icon: 'i-lucide-history' }
          ]"
        />

        <!-- Details Tab -->
        <div
          v-if="activeTab === 'details'"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <UCard>
            <template #header>
              <h3 class="font-medium">Stock Information</h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">Current Stock</dt>
                <dd class="font-medium">
                  {{ parseFloat(part.quantityInStock).toLocaleString() }} {{ part.unit }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Minimum Stock</dt>
                <dd class="font-medium">
                  {{ part.minimumStock ? parseFloat(part.minimumStock).toLocaleString() : '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Reorder Threshold</dt>
                <dd class="font-medium">
                  {{
                    part.reorderThreshold ? parseFloat(part.reorderThreshold).toLocaleString() : '-'
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Reorder Quantity</dt>
                <dd class="font-medium">
                  {{
                    part.reorderQuantity ? parseFloat(part.reorderQuantity).toLocaleString() : '-'
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Storage Location</dt>
                <dd class="font-medium">
                  {{ part.location || '-' }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Pricing</h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">Unit Cost</dt>
                <dd class="font-medium">
                  {{
                    part.unitCost
                      ? `$${parseFloat(part.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : '-'
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Total Value</dt>
                <dd class="font-medium">
                  {{
                    part.unitCost
                      ? `$${(parseFloat(part.unitCost) * parseFloat(part.quantityInStock)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : '-'
                  }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Supplier</h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">Supplier Name</dt>
                <dd class="font-medium">
                  {{ part.supplier || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">Supplier Part Number</dt>
                <dd class="font-medium font-mono">
                  {{ part.supplierPartNumber || '-' }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <!-- Description -->
        <UCard v-if="activeTab === 'details' && part.description">
          <template #header>
            <h3 class="font-medium">Description</h3>
          </template>
          <p class="text-muted whitespace-pre-wrap">
            {{ part.description }}
          </p>
        </UCard>

        <!-- Record Info -->
        <UCard v-if="activeTab === 'details'">
          <template #header>
            <h3 class="font-medium">Record Information</h3>
          </template>
          <dl class="grid grid-cols-2 gap-4">
            <div>
              <dt class="text-sm text-muted">Created</dt>
              <dd class="font-medium">
                {{ formatDate(part.createdAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Last Updated</dt>
              <dd class="font-medium">
                {{ formatDate(part.updatedAt) }}
              </dd>
            </div>
          </dl>
        </UCard>

        <!-- Adjust Stock Tab -->
        <div v-if="activeTab === 'adjust'" class="max-w-lg">
          <UCard>
            <template #header>
              <h3 class="font-medium">Adjust Stock Level</h3>
            </template>

            <UForm
              :schema="adjustmentSchema"
              :state="adjustmentState"
              class="space-y-4"
              @submit="submitAdjustment"
            >
              <UFormField label="Adjustment Type" name="usageType">
                <USelect
                  v-model="adjustmentState.usageType"
                  :items="usageTypeOptions"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Quantity Change"
                name="quantityChange"
                hint="Use negative values to reduce stock"
              >
                <UInput
                  v-model.number="adjustmentState.quantityChange"
                  type="number"
                  placeholder="10 or -5"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Reference" name="reference">
                <UInput
                  v-model="adjustmentState.reference"
                  placeholder="PO-12345, Invoice #, etc."
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Notes" name="notes">
                <UTextarea
                  v-model="adjustmentState.notes"
                  placeholder="Reason for adjustment..."
                  class="w-full"
                  :rows="3"
                />
              </UFormField>

              <div class="flex justify-end gap-2 pt-4">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="activeTab = 'details'"
                />
                <UButton
                  label="Apply Adjustment"
                  color="primary"
                  type="submit"
                  :loading="adjusting"
                />
              </div>
            </UForm>
          </UCard>
        </div>

        <!-- History Tab -->
        <div v-if="activeTab === 'history'">
          <UCard>
            <template #header>
              <h3 class="font-medium">Usage History</h3>
            </template>

            <div v-if="part.usageHistory.length === 0" class="text-center py-8 text-muted">
              No usage history recorded yet.
            </div>

            <div v-else class="divide-y divide-default">
              <div
                v-for="entry in part.usageHistory"
                :key="entry.id"
                class="py-4 first:pt-0 last:pb-0"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2">
                      <UBadge
                        :color="(usageTypeColors[entry.usageType] as any) || 'neutral'"
                        variant="subtle"
                        class="capitalize"
                      >
                        {{ entry.usageType.replace('_', ' ') }}
                      </UBadge>
                      <span
                        :class="[
                          'font-medium',
                          parseFloat(entry.quantityChange) > 0 ? 'text-success' : 'text-error'
                        ]"
                      >
                        {{ parseFloat(entry.quantityChange) > 0 ? '+' : ''
                        }}{{ parseFloat(entry.quantityChange).toLocaleString() }}
                      </span>
                    </div>
                    <p class="text-sm text-muted mt-1">
                      {{ parseFloat(entry.previousQuantity).toLocaleString() }} →
                      {{ parseFloat(entry.newQuantity).toLocaleString() }}
                    </p>
                    <p v-if="entry.notes" class="text-sm mt-1">
                      {{ entry.notes }}
                    </p>
                    <p v-if="entry.workOrder" class="text-sm text-muted mt-1">
                      Work Order:
                      <NuxtLink
                        :to="`/work-orders/${entry.workOrder.id}`"
                        class="text-primary hover:underline"
                      >
                        {{ entry.workOrder.workOrderNumber }}
                      </NuxtLink>
                    </p>
                  </div>
                  <div class="text-right text-sm text-muted">
                    <p>{{ formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true }) }}</p>
                    <p v-if="entry.user">{{ entry.user.firstName }} {{ entry.user.lastName }}</p>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
