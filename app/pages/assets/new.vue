<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface AssetCategory {
  id: string
  name: string
}

const router = useRouter()
const toast = useToast()
const { $fetchWithCsrf } = useCsrfToken()

const { data: categories } = await useFetch<AssetCategory[]>('/api/asset-categories', {
  lazy: true,
})

const schema = z.object({
  assetNumber: z.string().optional(),
  vin: z.string().max(17, 'VIN must be 17 characters or less').optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(20).optional(),
  operationalHours: z.number().min(0).optional(),
  mileage: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  assetNumber: undefined,
  vin: undefined,
  make: undefined,
  model: undefined,
  year: undefined,
  licensePlate: undefined,
  operationalHours: 0,
  mileage: 0,
  status: 'active',
  description: undefined,
  categoryId: undefined,
})

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const asset = await $fetchWithCsrf('/api/assets', {
      method: 'POST',
      body: event.data,
    })
    toast.add({
      title: 'Asset created',
      description: `Asset ${(asset as { assetNumber: string }).assetNumber} has been created successfully.`,
      color: 'success',
    })
    router.push('/assets')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create asset.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Disposed', value: 'disposed' },
]

const categoryOptions = computed(() => {
  return categories.value?.map((c) => ({ label: c.name, value: c.id })) || []
})
</script>

<template>
  <UDashboardPanel id="new-asset">
    <template #header>
      <UDashboardNavbar title="New Asset">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/assets')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl">
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
              <UFormField
                label="Asset Number"
                name="assetNumber"
                hint="Leave blank to auto-generate"
              >
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
              @click="router.push('/assets')"
            />
            <UButton
              label="Create Asset"
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
