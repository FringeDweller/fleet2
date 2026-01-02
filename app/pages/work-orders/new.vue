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
}

interface AssetsResponse {
  data: Asset[]
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
}

interface Technician {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface TaskTemplate {
  id: string
  name: string
  description: string | null
  estimatedDuration: number | null
}

const router = useRouter()
const toast = useToast()
const { $fetchWithCsrf } = useCsrfToken()

const { data: assetsResponse } = await useFetch<AssetsResponse>('/api/assets', { lazy: true })
const assets = computed(() => assetsResponse.value?.data || [])
const { data: technicians } = await useFetch<Technician[]>('/api/technicians', { lazy: true })
const { data: templates } = await useFetch<TaskTemplate[]>('/api/task-templates?activeOnly=true', {
  lazy: true,
})

const schema = z.object({
  assetId: z.string().uuid('Please select an asset'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  templateId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['draft', 'open']),
  dueDate: z.string().optional(),
  estimatedDuration: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  assetId: undefined,
  title: '',
  description: undefined,
  templateId: undefined,
  assignedToId: undefined,
  priority: 'medium',
  status: 'draft',
  dueDate: undefined,
  estimatedDuration: undefined,
  notes: undefined,
})

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const workOrder = await $fetchWithCsrf('/api/work-orders', {
      method: 'POST',
      body: {
        ...event.data,
        dueDate: event.data.dueDate ? new Date(event.data.dueDate).toISOString() : undefined,
      },
    })
    toast.add({
      title: 'Work order created',
      description: `Work order ${(workOrder as { workOrderNumber: string }).workOrderNumber} has been created successfully.`,
      color: 'success',
    })
    router.push('/work-orders')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create work order.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
]

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Open', value: 'open' },
]

const assetOptions = computed(() => {
  return assets.value.map((a: Asset) => ({
    label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
    value: a.id,
  }))
})

const technicianOptions = computed(() => {
  return (
    technicians.value?.map((t) => ({
      label: `${t.firstName} ${t.lastName}`,
      value: t.id,
    })) || []
  )
})

const templateOptions = computed(() => {
  return (
    templates.value?.map((t) => ({
      label: t.name,
      value: t.id,
    })) || []
  )
})

// When template is selected, update estimated duration
watch(
  () => state.templateId,
  (templateId) => {
    if (templateId) {
      const template = templates.value?.find((t) => t.id === templateId)
      if (template?.estimatedDuration) {
        state.estimatedDuration = template.estimatedDuration
      }
    }
  },
)
</script>

<template>
  <UDashboardPanel id="new-work-order">
    <template #header>
      <UDashboardNavbar title="New Work Order">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/work-orders')"
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
                Work Order Details
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

              <UFormField label="Title" name="title" required>
                <UInput
                  v-model="state.title"
                  placeholder="e.g., Oil change and filter replacement"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Description" name="description">
                <UTextarea
                  v-model="state.description"
                  placeholder="Detailed description of the work to be done..."
                  class="w-full"
                  :rows="3"
                />
              </UFormField>

              <UFormField
                label="Task Template"
                name="templateId"
                hint="Optional - pre-fills checklist items"
              >
                <USelect
                  v-model="state.templateId"
                  :items="templateOptions"
                  placeholder="Select a template (optional)"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Assignment & Schedule
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Assign To" name="assignedToId">
                <USelect
                  v-model="state.assignedToId"
                  :items="technicianOptions"
                  placeholder="Select a technician (optional)"
                  class="w-full"
                />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Priority" name="priority">
                  <USelect v-model="state.priority" :items="priorityOptions" class="w-full" />
                </UFormField>

                <UFormField label="Initial Status" name="status">
                  <USelect v-model="state.status" :items="statusOptions" class="w-full" />
                </UFormField>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Due Date" name="dueDate">
                  <UInput v-model="state.dueDate" type="date" class="w-full" />
                </UFormField>

                <UFormField label="Estimated Duration (minutes)" name="estimatedDuration">
                  <UInput
                    v-model.number="state.estimatedDuration"
                    type="number"
                    min="1"
                    placeholder="60"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Additional Notes
              </h3>
            </template>

            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="state.notes"
                placeholder="Any additional notes or instructions..."
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
              @click="router.push('/work-orders')"
            />
            <UButton
              label="Save as Draft"
              color="neutral"
              variant="outline"
              :loading="loading"
              type="submit"
              @click="state.status = 'draft'"
            />
            <UButton
              label="Create & Open"
              color="primary"
              :loading="loading"
              type="submit"
              @click="state.status = 'open'"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
