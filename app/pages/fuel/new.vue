<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
  mileage: string | null
  operationalHours: string | null
}

interface OperatorSession {
  id: string
  assetId: string
  status: string
  startTime: string
}

const router = useRouter()
const toast = useToast()

const { data: assets } = await useFetch<Asset[]>('/api/assets', { lazy: true })

// Check for active operator session for the current user
const { data: activeSession } = await useFetch<OperatorSession | null>(
  '/api/operator-sessions/active',
  { lazy: true },
)

// GPS location tracking
const currentLocation = ref<{ latitude: number; longitude: number; name?: string } | null>(null)
const isCapturingLocation = ref(false)
const locationError = ref<string | null>(null)

async function captureLocation() {
  if (!navigator.geolocation) {
    locationError.value = 'Geolocation is not supported by your browser'
    return
  }

  isCapturingLocation.value = true
  locationError.value = null

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      currentLocation.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }

      // Try to reverse geocode to get location name
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
        )
        const data = await response.json()
        if (data.display_name) {
          currentLocation.value.name = data.display_name
          state.locationName = data.display_name.split(',').slice(0, 3).join(',')
          state.locationAddress = data.display_name
        }
      } catch (e) {
        // Ignore reverse geocoding errors
      }

      state.latitude = position.coords.latitude
      state.longitude = position.coords.longitude
      isCapturingLocation.value = false

      toast.add({
        title: 'Location captured',
        color: 'success',
      })
    },
    (error) => {
      isCapturingLocation.value = false
      switch (error.code) {
        case error.PERMISSION_DENIED:
          locationError.value = 'Location permission denied. Please enable location access.'
          break
        case error.POSITION_UNAVAILABLE:
          locationError.value = 'Location information is unavailable.'
          break
        case error.TIMEOUT:
          locationError.value = 'Location request timed out.'
          break
        default:
          locationError.value = 'An unknown error occurred.'
          break
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  )
}

const schema = z.object({
  assetId: z.string().uuid('Please select an asset'),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().positive().optional(),
  totalCost: z.number().positive().optional(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'lpg', 'other']),
  odometer: z.number().min(0).optional(),
  engineHours: z.number().min(0).optional(),
  vendor: z.string().max(255).optional(),
  notes: z.string().optional(),
  transactionDate: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().max(255).optional(),
  locationAddress: z.string().optional(),
  receiptPhotoPath: z.string().optional(),
})

type Schema = z.output<typeof schema>

// Get today's date in local format for the date input
const today = new Date().toISOString().split('T')[0]

const state = reactive<Partial<Schema>>({
  assetId: activeSession.value?.assetId || undefined,
  quantity: undefined,
  unitCost: undefined,
  totalCost: undefined,
  fuelType: 'diesel',
  odometer: undefined,
  engineHours: undefined,
  vendor: undefined,
  notes: undefined,
  transactionDate: today,
  latitude: undefined,
  longitude: undefined,
  locationName: undefined,
  locationAddress: undefined,
  receiptPhotoPath: undefined,
})

const loading = ref(false)

// When quantity or unit cost changes, calculate total cost
watch([() => state.quantity, () => state.unitCost], ([quantity, unitCost]) => {
  if (quantity && unitCost) {
    state.totalCost = parseFloat((quantity * unitCost).toFixed(2))
  }
})

// When asset changes, prefill odometer if available
watch(
  () => state.assetId,
  (assetId) => {
    if (assetId) {
      const asset = assets.value?.find((a) => a.id === assetId)
      if (asset?.mileage) {
        state.odometer = parseFloat(asset.mileage)
      }
      if (asset?.operationalHours) {
        state.engineHours = parseFloat(asset.operationalHours)
      }
    }
  },
)

// If there's an active session, pre-select the asset
watch(
  activeSession,
  (session) => {
    if (session?.assetId && !state.assetId) {
      state.assetId = session.assetId
    }
  },
  { immediate: true },
)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const transactionDate = new Date(event.data.transactionDate).toISOString()

    await $fetch('/api/fuel/transactions', {
      method: 'POST',
      body: {
        ...event.data,
        transactionDate,
        operatorSessionId: activeSession.value?.id || null,
      },
    })

    toast.add({
      title: 'Fuel transaction recorded',
      description: `${event.data.quantity} L of ${event.data.fuelType} recorded successfully.`,
      color: 'success',
    })

    router.push('/fuel')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to record fuel transaction.',
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

const assetOptions = computed(() => {
  return (
    assets.value?.map((a) => ({
      label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
      value: a.id,
    })) || []
  )
})

// Capture location on mount
onMounted(() => {
  captureLocation()
})
</script>

<template>
  <UDashboardPanel id="new-fuel-transaction">
    <template #header>
      <UDashboardNavbar title="Record Fuel Transaction">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/fuel')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl">
        <!-- Active Session Banner -->
        <UCard v-if="activeSession" class="mb-4 bg-info/10 border-info">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-user-check" class="w-5 h-5 text-info" />
            <div>
              <p class="font-medium">Active Operator Session</p>
              <p class="text-sm text-muted">
                This fuel transaction will be linked to your current session.
              </p>
            </div>
          </div>
        </UCard>

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
              <UFormField label="Asset" name="assetId" required>
                <USelect
                  v-model="state.assetId"
                  :items="assetOptions"
                  placeholder="Select an asset"
                  class="w-full"
                  searchable
                />
              </UFormField>

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
                    placeholder="50.000"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Unit Cost ($/L)" name="unitCost">
                  <UInput
                    v-model.number="state.unitCost"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="1.899"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Total Cost ($)" name="totalCost">
                  <UInput
                    v-model.number="state.totalCost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="94.95"
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

            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Odometer (km)" name="odometer" hint="Current odometer reading">
                  <UInput
                    v-model.number="state.odometer"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="125000"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Engine Hours" name="engineHours" hint="For equipment with hour meters">
                  <UInput
                    v-model.number="state.engineHours"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="5432.5"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium">
                  Location
                </h3>
                <UButton
                  label="Capture GPS"
                  icon="i-lucide-map-pin"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="isCapturingLocation"
                  @click="captureLocation"
                />
              </div>
            </template>

            <div class="space-y-4">
              <UAlert
                v-if="locationError"
                color="error"
                icon="i-lucide-alert-circle"
                :title="locationError"
              />

              <UAlert
                v-if="currentLocation"
                color="success"
                icon="i-lucide-check-circle"
              >
                <template #title>
                  Location captured
                </template>
                <template #description>
                  {{ currentLocation.name || `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}` }}
                </template>
              </UAlert>

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
                  placeholder="e.g., 123 Main St, Sydney"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Receipt & Notes
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Receipt Photo" name="receiptPhotoPath" hint="Photo upload coming soon">
                <div class="flex items-center gap-2">
                  <UButton
                    label="Capture Photo"
                    icon="i-lucide-camera"
                    color="neutral"
                    variant="outline"
                    disabled
                  />
                  <span class="text-sm text-muted">Photo upload not yet implemented</span>
                </div>
              </UFormField>

              <UFormField label="Notes" name="notes">
                <UTextarea
                  v-model="state.notes"
                  placeholder="Any additional notes..."
                  class="w-full"
                  :rows="3"
                />
              </UFormField>
            </div>
          </UCard>

          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="router.push('/fuel')"
            />
            <UButton
              label="Record Transaction"
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
