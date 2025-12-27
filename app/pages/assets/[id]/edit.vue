<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

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
  categoryId: string | null
}

interface AssetCategory {
  id: string
  name: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const {
  data: asset,
  status: fetchStatus,
  error
} = await useFetch<Asset>(`/api/assets/${route.params.id}`, {
  lazy: true
})

const { data: categories } = await useFetch<AssetCategory[]>('/api/asset-categories', {
  lazy: true
})

const schema = z.object({
  assetNumber: z.string().min(1, 'Asset number is required').max(50),
  vin: z.string().max(17, 'VIN must be 17 characters or less').optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  operationalHours: z.number().min(0).optional(),
  mileage: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

watch(
  asset,
  (newAsset) => {
    if (newAsset) {
      state.assetNumber = newAsset.assetNumber
      state.vin = newAsset.vin
      state.make = newAsset.make
      state.model = newAsset.model
      state.year = newAsset.year
      state.licensePlate = newAsset.licensePlate
      state.operationalHours = newAsset.operationalHours ? Number(newAsset.operationalHours) : 0
      state.mileage = newAsset.mileage ? Number(newAsset.mileage) : 0
      state.status = newAsset.status
      state.description = newAsset.description
      state.categoryId = newAsset.categoryId ?? undefined
    }
  },
  { immediate: true }
)

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch(`/api/assets/${route.params.id}`, {
      method: 'PUT',
      body: event.data
    })
    toast.add({
      title: 'Asset updated',
      description: 'The asset has been updated successfully.',
      color: 'success'
    })
    router.push(`/assets/${route.params.id}`)
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update asset.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Disposed', value: 'disposed' }
]

const categoryOptions = computed(() => {
  return categories.value?.map(c => ({ label: c.name, value: c.id })) || []
})
</script>

<template>
  <UDashboardPanel id="edit-asset">
    <template #header>
      <UDashboardNavbar :title="`Edit ${asset?.assetNumber || 'Asset'}`">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push(`/assets/${route.params.id}`)"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="fetchStatus === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="error" class="text-center py-12">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-error mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          Asset not found
        </h3>
        <p class="text-muted mb-4">
          The asset you're looking for doesn't exist or has been removed.
        </p>
        <UButton label="Back to Assets" @click="router.push('/assets')" />
      </div>

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
                Basic Information
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Asset Number" name="assetNumber">
                <UInput v-model="state.assetNumber" placeholder="FLT-0001" class="w-full" />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Make" name="make">
                  <UInput v-model="state.make" placeholder="Toyota" class="w-full" />
                </UFormField>

                <UFormField label="Model" name="model">
                  <UInput v-model="state.model" placeholder="Hilux" class="w-full" />
                </UFormField>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Year" name="year">
                  <UInput
                    v-model.number="state.year"
                    type="number"
                    placeholder="2024"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Status" name="status">
                  <USelect v-model="state.status" :items="statusOptions" class="w-full" />
                </UFormField>
              </div>

              <UFormField label="Category" name="categoryId">
                <USelect
                  v-model="state.categoryId"
                  :items="categoryOptions"
                  placeholder="Select a category"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Vehicle Details
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField
                label="VIN"
                name="vin"
                hint="Vehicle Identification Number (17 characters)"
              >
                <UInput
                  v-model="state.vin"
                  placeholder="1HGBH41JXMN109186"
                  maxlength="17"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="License Plate" name="licensePlate">
                <UInput v-model="state.licensePlate" placeholder="ABC-123" class="w-full" />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Usage Metrics
              </h3>
            </template>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Mileage (km)" name="mileage">
                <UInput
                  v-model.number="state.mileage"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Operational Hours" name="operationalHours">
                <UInput
                  v-model.number="state.operationalHours"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Additional Information
              </h3>
            </template>

            <UFormField label="Description" name="description">
              <UTextarea
                v-model="state.description"
                placeholder="Enter any additional notes about this asset..."
                class="w-full"
                :rows="4"
              />
            </UFormField>
          </UCard>

          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="router.push(`/assets/${route.params.id}`)"
            />
            <UButton
              label="Save Changes"
              color="primary"
              type="submit"
              :loading="loading"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
