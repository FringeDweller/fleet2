<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { format, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth'
})

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate: string | null
  estimatedDuration: number | null
  actualDuration: number | null
  notes: string | null
  completionNotes: string | null
  assignedToId: string | null
  assignedTo: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface Technician {
  id: string
  firstName: string
  lastName: string
  email: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const { data: workOrder, status: fetchStatus, error } = await useFetch<WorkOrder>(`/api/work-orders/${route.params.id}`, {
  lazy: true
})

const { data: technicians } = await useFetch<Technician[]>('/api/technicians', { lazy: true })

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueDate: z.string().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  actualDuration: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  completionNotes: z.string().optional().nullable()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  title: '',
  description: undefined,
  assignedToId: undefined,
  priority: 'medium',
  dueDate: undefined,
  estimatedDuration: undefined,
  actualDuration: undefined,
  notes: undefined,
  completionNotes: undefined
})

// Watch for work order data and populate form
watch(workOrder, (wo) => {
  if (wo) {
    state.title = wo.title
    state.description = wo.description
    state.assignedToId = wo.assignedToId || undefined
    state.priority = wo.priority
    state.dueDate = wo.dueDate ? format(parseISO(wo.dueDate), 'yyyy-MM-dd') : undefined
    state.estimatedDuration = wo.estimatedDuration || undefined
    state.actualDuration = wo.actualDuration || undefined
    state.notes = wo.notes
    state.completionNotes = wo.completionNotes
  }
}, { immediate: true })

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}`, {
      method: 'PUT',
      body: {
        ...event.data,
        dueDate: event.data.dueDate ? new Date(event.data.dueDate).toISOString() : null
      }
    })
    toast.add({
      title: 'Work order updated',
      description: 'The work order has been updated successfully.',
      color: 'success'
    })
    router.push(`/work-orders/${route.params.id}`)
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update work order.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' }
]

const technicianOptions = computed(() => {
  return technicians.value?.map(t => ({
    label: `${t.firstName} ${t.lastName}`,
    value: t.id
  })) || []
})
</script>

<template>
  <UDashboardPanel id="edit-work-order">
    <template #header>
      <UDashboardNavbar :title="`Edit ${workOrder?.workOrderNumber || 'Work Order'}`">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push(`/work-orders/${route.params.id}`)"
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
          Work order not found
        </h3>
        <p class="text-muted mb-4">
          The work order you're looking for doesn't exist or has been removed.
        </p>
        <UButton label="Back to Work Orders" @click="router.push('/work-orders')" />
      </div>

      <div v-else-if="workOrder" class="max-w-2xl">
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

              <UFormField label="Priority" name="priority">
                <USelect v-model="state.priority" :items="priorityOptions" class="w-full" />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Due Date" name="dueDate">
                  <UInput
                    v-model="state.dueDate"
                    type="date"
                    class="w-full"
                  />
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

              <UFormField label="Actual Duration (minutes)" name="actualDuration">
                <UInput
                  v-model.number="state.actualDuration"
                  type="number"
                  min="1"
                  placeholder="Record actual time spent"
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

            <div class="space-y-4">
              <UFormField label="Notes" name="notes">
                <UTextarea
                  v-model="state.notes"
                  placeholder="Any additional notes or instructions..."
                  class="w-full"
                  :rows="3"
                />
              </UFormField>

              <UFormField label="Completion Notes" name="completionNotes">
                <UTextarea
                  v-model="state.completionNotes"
                  placeholder="Notes about the completed work..."
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
              @click="router.push(`/work-orders/${route.params.id}`)"
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
