<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth'
})

interface PartCategory {
  id: string
  name: string
}

const router = useRouter()
const toast = useToast()

const { data: categories } = await useFetch<PartCategory[]>('/api/part-categories', {
  lazy: true
})

const schema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  unit: z
    .enum(['each', 'liters', 'gallons', 'kg', 'lbs', 'meters', 'feet', 'box', 'set', 'pair'])
    .default('each'),
  quantityInStock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).optional(),
  reorderThreshold: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  supplierPartNumber: z.string().max(100).optional(),
  location: z.string().max(100).optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  unit: 'each',
  quantityInStock: 0
})

const loading = ref(false)

const categoryOptions = computed(() => {
  return categories.value?.map(c => ({ label: c.name, value: c.id })) || []
})

const unitOptions = [
  { label: 'Each', value: 'each' },
  { label: 'Liters', value: 'liters' },
  { label: 'Gallons', value: 'gallons' },
  { label: 'Kilograms', value: 'kg' },
  { label: 'Pounds', value: 'lbs' },
  { label: 'Meters', value: 'meters' },
  { label: 'Feet', value: 'feet' },
  { label: 'Box', value: 'box' },
  { label: 'Set', value: 'set' },
  { label: 'Pair', value: 'pair' }
]

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const part = await $fetch('/api/parts', {
      method: 'POST',
      body: event.data
    })
    toast.add({
      title: 'Part created',
      description: 'The part has been added to the catalog.',
      color: 'success'
    })
    router.push(`/inventory/parts/${(part as { id: string }).id}`)
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to create part.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="new-part">
    <template #header>
      <UDashboardNavbar title="New Part">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/inventory/parts')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          <UCard>
            <template #header>
              <h3 class="font-medium">Basic Information</h3>
            </template>

            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="SKU" name="sku" required>
                  <UInput v-model="state.sku" placeholder="PART-001" class="w-full" />
                </UFormField>

                <UFormField label="Category" name="categoryId">
                  <USelect
                    v-model="state.categoryId"
                    :items="categoryOptions"
                    placeholder="Select a category"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <UFormField label="Name" name="name" required>
                <UInput v-model="state.name" placeholder="Oil Filter" class="w-full" />
              </UFormField>

              <UFormField label="Description" name="description">
                <UTextarea
                  v-model="state.description"
                  placeholder="Enter part description..."
                  class="w-full"
                  :rows="3"
                />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Unit of Measure" name="unit">
                  <USelect v-model="state.unit" :items="unitOptions" class="w-full" />
                </UFormField>

                <UFormField label="Unit Cost ($)" name="unitCost">
                  <UInput
                    v-model.number="state.unitCost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Stock Management</h3>
            </template>

            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Initial Stock Quantity" name="quantityInStock">
                  <UInput
                    v-model.number="state.quantityInStock"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Minimum Stock Level" name="minimumStock">
                  <UInput
                    v-model.number="state.minimumStock"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField
                  label="Reorder Threshold"
                  name="reorderThreshold"
                  hint="Alert when stock falls to this level"
                >
                  <UInput
                    v-model.number="state.reorderThreshold"
                    type="number"
                    min="0"
                    placeholder="10"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  label="Reorder Quantity"
                  name="reorderQuantity"
                  hint="Suggested quantity to order"
                >
                  <UInput
                    v-model.number="state.reorderQuantity"
                    type="number"
                    min="0"
                    placeholder="25"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <UFormField label="Storage Location" name="location">
                <UInput
                  v-model="state.location"
                  placeholder="Warehouse A, Shelf B3"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Supplier Information</h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Supplier Name" name="supplier">
                <UInput v-model="state.supplier" placeholder="ABC Auto Parts" class="w-full" />
              </UFormField>

              <UFormField label="Supplier Part Number" name="supplierPartNumber">
                <UInput v-model="state.supplierPartNumber" placeholder="SUP-12345" class="w-full" />
              </UFormField>
            </div>
          </UCard>

          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="router.push('/inventory/parts')"
            />
            <UButton label="Create Part" color="primary" type="submit" :loading="loading" />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
