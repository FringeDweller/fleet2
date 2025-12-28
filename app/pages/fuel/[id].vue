<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { formatDistanceToNow } from 'date-fns'
import * as z from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface FuelTransaction {
  id: string
  quantity: string
  unitCost: string | null
  totalCost: string | null
  fuelType: 'diesel' | 'petrol' | 'electric' | 'lpg' | 'other'
  odometer: string | null
  engineHours: string | null
  receiptPhotoPath: string | null
  latitude: string | null
  longitude: string | null
  locationName: string | null
  locationAddress: string | null
  vendor: string | null
  notes: string | null
  syncStatus: 'synced' | 'pending'
  transactionDate: string
  createdAt: string
  updatedAt: string
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
  }
  user: { id: string; firstName: string; lastName: string; email: string }
  operatorSession: { id: string; status: string; startTime: string; endTime: string | null } | null
}

const router = useRouter()
const route = useRoute()
const toast = useToast()

const transactionId = route.params.id as string

const {
  data: transaction,
  status,
  refresh,
} = await useFetch<FuelTransaction>(`/api/fuel/transactions/${transactionId}`, { lazy: true })

const isEditing = ref(false)
const loading = ref(false)

const schema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().positive().optional().nullable(),
  totalCost: z.number().positive().optional().nullable(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']),
  odometer: z.number().min(0).optional().nullable(),
  engineHours: z.number().min(0).optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  transactionDate: z.string(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

// Initialize form state when transaction loads
watch(
  transaction,
  (t) => {
    if (t) {
      state.quantity = parseFloat(t.quantity)
      state.unitCost = t.unitCost ? parseFloat(t.unitCost) : null
      state.totalCost = t.totalCost ? parseFloat(t.totalCost) : null
      state.fuelType = t.fuelType
      state.odometer = t.odometer ? parseFloat(t.odometer) : null
      state.engineHours = t.engineHours ? parseFloat(t.engineHours) : null
      state.vendor = t.vendor
      state.notes = t.notes
      state.transactionDate = new Date(t.transactionDate).toISOString().split('T')[0]
      state.locationName = t.locationName
      state.locationAddress = t.locationAddress
    }
  },
  { immediate: true },
)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const transactionDate = new Date(event.data.transactionDate).toISOString()

    await $fetch(`/api/fuel/transactions/${transactionId}`, {
      method: 'PUT',
      body: {
        ...event.data,
        transactionDate,
      },
    })

    toast.add({
      title: 'Transaction updated',
      color: 'success',
    })

    isEditing.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to update transaction.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function deleteTransaction() {
  if (!confirm('Are you sure you want to delete this fuel transaction?')) return

  loading.value = true
  try {
    await $fetch(`/api/fuel/transactions/${transactionId}`, {
      method: 'DELETE',
    })

    toast.add({
      title: 'Transaction deleted',
      color: 'success',
    })

    router.push('/fuel')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete transaction.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const fuelTypeOptions = [
  { label: 'Diesel', value: 'diesel' },
  { label: 'Petrol', value: 'petrol' },
  { label: 'Electric', value: 'electric' },
  { label: 'LPG', value: 'lpg' },
  { label: 'Other', value: 'other' },
]

const fuelTypeLabels: Record<string, string> = {
  diesel: 'Diesel',
  petrol: 'Petrol',
  electric: 'Electric',
  lpg: 'LPG',
  other: 'Other',
}

const fuelTypeColors: Record<string, string> = {
  diesel: 'info',
  petrol: 'warning',
  electric: 'success',
  lpg: 'neutral',
  other: 'neutral',
}

function openInMaps() {
  if (transaction.value?.latitude && transaction.value?.longitude) {
    const url = `https://www.google.com/maps?q=${transaction.value.latitude},${transaction.value.longitude}`
    window.open(url, '_blank')
  }
}
</script>

<template>
  <UDashboardPanel id="fuel-transaction-detail">
    <template #header>
      <UDashboardNavbar title="Fuel Transaction">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/fuel')"
          />
        </template>

        <template #right>
          <UButton
            v-if="!isEditing"
            label="Edit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            @click="isEditing = true"
          />
          <UButton
            v-if="!isEditing"
            label="Delete"
            icon="i-lucide-trash"
            color="error"
            variant="outline"
            :loading="loading"
            @click="deleteTransaction"
          />
          <UButton
            v-if="isEditing"
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="isEditing = false"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading State -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Not Found -->
      <div v-else-if="!transaction" class="text-center py-12">
        <UIcon name="i-lucide-file-x" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          Transaction not found
        </h3>
        <UButton
          label="Back to Transactions"
          @click="router.push('/fuel')"
        />
      </div>

      <!-- View Mode -->
      <div v-else-if="!isEditing" class="max-w-4xl space-y-6">
        <!-- Header Card -->
        <UCard>
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="bg-primary/10 rounded-lg p-3">
                <UIcon name="i-lucide-fuel" class="w-8 h-8 text-primary" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-2xl font-bold">
                    {{ parseFloat(transaction.quantity).toLocaleString('en-AU', { maximumFractionDigits: 1 }) }} L
                  </h2>
                  <UBadge
                    :color="fuelTypeColors[transaction.fuelType] as 'info' | 'warning' | 'success' | 'neutral'"
                    variant="subtle"
                  >
                    {{ fuelTypeLabels[transaction.fuelType] }}
                  </UBadge>
                </div>
                <p class="text-muted">
                  {{ new Date(transaction.transactionDate).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
                </p>
              </div>
            </div>

            <div v-if="transaction.totalCost" class="text-right">
              <p class="text-2xl font-bold text-success">
                ${{ parseFloat(transaction.totalCost).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </p>
              <p v-if="transaction.unitCost" class="text-sm text-muted">
                ${{ parseFloat(transaction.unitCost).toFixed(3) }}/L
              </p>
            </div>
          </div>
        </UCard>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Asset Card -->
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Asset
              </h3>
            </template>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-muted">Asset Number</span>
                <NuxtLink
                  :to="`/assets/${transaction.asset.id}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ transaction.asset.assetNumber }}
                </NuxtLink>
              </div>
              <div v-if="transaction.asset.make || transaction.asset.model" class="flex items-center justify-between">
                <span class="text-muted">Make/Model</span>
                <span class="font-medium">
                  {{ transaction.asset.make }} {{ transaction.asset.model }}
                </span>
              </div>
              <div v-if="transaction.asset.year" class="flex items-center justify-between">
                <span class="text-muted">Year</span>
                <span class="font-medium">{{ transaction.asset.year }}</span>
              </div>
              <div v-if="transaction.asset.licensePlate" class="flex items-center justify-between">
                <span class="text-muted">License Plate</span>
                <span class="font-medium">{{ transaction.asset.licensePlate }}</span>
              </div>
            </div>
          </UCard>

          <!-- Readings Card -->
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Readings
              </h3>
            </template>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-muted">Odometer</span>
                <span class="font-medium">
                  {{ transaction.odometer ? `${parseFloat(transaction.odometer).toLocaleString('en-AU')} km` : '-' }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted">Engine Hours</span>
                <span class="font-medium">
                  {{ transaction.engineHours ? `${parseFloat(transaction.engineHours).toLocaleString('en-AU')} hrs` : '-' }}
                </span>
              </div>
            </div>
          </UCard>

          <!-- Location Card -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium">
                  Location
                </h3>
                <UButton
                  v-if="transaction.latitude && transaction.longitude"
                  label="View on Map"
                  icon="i-lucide-map"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="openInMaps"
                />
              </div>
            </template>

            <div class="space-y-3">
              <div v-if="transaction.vendor" class="flex items-center justify-between">
                <span class="text-muted">Vendor</span>
                <span class="font-medium">{{ transaction.vendor }}</span>
              </div>
              <div v-if="transaction.locationName" class="flex items-center justify-between">
                <span class="text-muted">Location</span>
                <span class="font-medium truncate max-w-[200px]">{{ transaction.locationName }}</span>
              </div>
              <div v-if="transaction.latitude && transaction.longitude" class="flex items-center justify-between">
                <span class="text-muted">GPS</span>
                <span class="font-mono text-sm">
                  {{ parseFloat(transaction.latitude).toFixed(6) }}, {{ parseFloat(transaction.longitude).toFixed(6) }}
                </span>
              </div>
              <div v-if="!transaction.vendor && !transaction.locationName && !transaction.latitude" class="text-center text-muted py-4">
                No location data recorded
              </div>
            </div>
          </UCard>

          <!-- Recorded By Card -->
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Details
              </h3>
            </template>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-muted">Recorded By</span>
                <span class="font-medium">
                  {{ transaction.user.firstName }} {{ transaction.user.lastName }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted">Recorded</span>
                <span class="font-medium">
                  {{ formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true }) }}
                </span>
              </div>
              <div v-if="transaction.operatorSession" class="flex items-center justify-between">
                <span class="text-muted">Operator Session</span>
                <UBadge color="info" variant="subtle">
                  Linked
                </UBadge>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted">Sync Status</span>
                <UBadge
                  :color="transaction.syncStatus === 'synced' ? 'success' : 'warning'"
                  variant="subtle"
                >
                  {{ transaction.syncStatus === 'synced' ? 'Synced' : 'Pending' }}
                </UBadge>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Notes Card -->
        <UCard v-if="transaction.notes">
          <template #header>
            <h3 class="font-medium">
              Notes
            </h3>
          </template>

          <p class="whitespace-pre-wrap">{{ transaction.notes }}</p>
        </UCard>
      </div>

      <!-- Edit Mode -->
      <div v-else class="max-w-2xl">
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-6"
          @submit="onSubmit"
        >
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Fuel Details
              </h3>
            </template>

            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Fuel Type" name="fuelType" required>
                  <USelect v-model="state.fuelType" :items="fuelTypeOptions" class="w-full" />
                </UFormField>

                <UFormField label="Transaction Date" name="transactionDate" required>
                  <UInput v-model="state.transactionDate" type="date" class="w-full" />
                </UFormField>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <UFormField label="Quantity (Litres)" name="quantity" required>
                  <UInput
                    v-model.number="state.quantity"
                    type="number"
                    step="0.001"
                    min="0"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Unit Cost ($/L)" name="unitCost">
                  <UInput
                    v-model.number="state.unitCost"
                    type="number"
                    step="0.001"
                    min="0"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Total Cost ($)" name="totalCost">
                  <UInput
                    v-model.number="state.totalCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Readings
              </h3>
            </template>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Odometer (km)" name="odometer">
                <UInput
                  v-model.number="state.odometer"
                  type="number"
                  step="0.1"
                  min="0"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Engine Hours" name="engineHours">
                <UInput
                  v-model.number="state.engineHours"
                  type="number"
                  step="0.1"
                  min="0"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Location
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Vendor / Station" name="vendor">
                <UInput
                  v-model="state.vendor"
                  placeholder="e.g., BP, Shell, Caltex"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Location Name" name="locationName">
                <UInput
                  v-model="state.locationName"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Notes
              </h3>
            </template>

            <UFormField name="notes">
              <UTextarea
                v-model="state.notes"
                placeholder="Any additional notes..."
                class="w-full"
                :rows="3"
              />
            </UFormField>
          </UCard>

          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="isEditing = false"
            />
            <UButton
              label="Save Changes"
              color="primary"
              :loading="loading"
              type="submit"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
