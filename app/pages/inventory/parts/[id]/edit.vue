<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth'
})

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
  categoryId: string | null
}

interface PartCategory {
  id: string
  name: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const {
  data: part,
  status: fetchStatus,
  error
} = await useFetch<Part>(`/api/parts/${route.params.id}`, {
  lazy: true
})

const { data: categories } = await useFetch<PartCategory[]>('/api/part-categories', {
  lazy: true
})

const schema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional(),
  unit: z.enum(['each', 'liters', 'gallons', 'kg', 'lbs', 'meters', 'feet', 'box', 'set', 'pair']),
  minimumStock: z.number().min(0).optional().nullable(),
  reorderThreshold: z.number().min(0).optional().nullable(),
  reorderQuantity: z.number().min(0).optional().nullable(),
  unitCost: z.number().min(0).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  supplierPartNumber: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

watch(
  part,
  newPart => {
    if (newPart) {
      state.sku = newPart.sku
      state.name = newPart.name
      state.description = newPart.description
      state.categoryId = newPart.categoryId ?? undefined
      state.unit = newPart.unit as Schema['unit']
      state.minimumStock = newPart.minimumStock ? parseFloat(newPart.minimumStock) : undefined
      state.reorderThreshold = newPart.reorderThreshold
        ? parseFloat(newPart.reorderThreshold)
        : undefined
      state.reorderQuantity = newPart.reorderQuantity
        ? parseFloat(newPart.reorderQuantity)
        : undefined
      state.unitCost = newPart.unitCost ? parseFloat(newPart.unitCost) : undefined
      state.supplier = newPart.supplier
      state.supplierPartNumber = newPart.supplierPartNumber
      state.location = newPart.location
    }
  },
  { immediate: true }
)

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/parts/${route.params.id}`, {
      method: 'PUT',
      body: event.data
    })
    toast.add({
      title: 'Part updated',
      description: 'The part has been updated successfully.',
      color: 'success'
    })
    router.push(`/inventory/parts/${route.params.id}`)
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update part.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="edit-part">
    <template #header>
      <UDashboardNavbar :title="`Edit ${part?.name || 'Part'}`">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push(`/inventory/parts/${route.params.id}`)"
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
        <h3 class="text-lg font-medium mb-2">Part not found</h3>
        <p class="text-muted mb-4">
          The part you're looking for doesn't exist or has been removed.
        </p>
        <UButton label="Back to Parts" @click="router.push('/inventory/parts')" />
      </div>

      <div v-else class="max-w-2xl">
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
              <p class="text-sm text-muted">
                To adjust current stock levels, use the "Adjust Stock" feature on the part details
                page.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Minimum Stock Level" name="minimumStock">
                  <UInput
                    v-model.number="state.minimumStock"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-full"
                  />
                </UFormField>

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
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <UFormField label="Storage Location" name="location">
                  <UInput
                    v-model="state.location"
                    placeholder="Warehouse A, Shelf B3"
                    class="w-full"
                  />
                </UFormField>
              </div>
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
              @click="router.push(`/inventory/parts/${route.params.id}`)"
            />
            <UButton label="Save Changes" color="primary" type="submit" :loading="loading" />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
