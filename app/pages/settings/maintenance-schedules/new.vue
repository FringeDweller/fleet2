<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth'
})

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

interface AssetCategory {
  id: string
  name: string
}

interface TaskTemplate {
  id: string
  name: string
  description: string | null
}

interface Technician {
  id: string
  firstName: string
  lastName: string
}

const router = useRouter()
const toast = useToast()

const { data: assets } = await useFetch<Asset[]>('/api/assets', { lazy: true })
const { data: categories } = await useFetch<AssetCategory[]>('/api/asset-categories', { lazy: true })
const { data: templates } = await useFetch<TaskTemplate[]>('/api/task-templates?activeOnly=true', { lazy: true })
const { data: technicians } = await useFetch<Technician[]>('/api/technicians', { lazy: true })

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  templateId: z.string().uuid().optional(),
  assignmentType: z.enum(['asset', 'category']),
  assetId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  scheduleType: z.enum(['time_based', 'usage_based', 'combined']).default('time_based'),
  // Time-based fields
  intervalType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom']).optional(),
  intervalValue: z.number().int().positive().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Usage-based fields
  intervalMileage: z.number().int().positive().optional(),
  intervalHours: z.number().int().positive().optional(),
  thresholdAlertPercent: z.number().int().min(1).max(100).default(90),
  // Work order settings
  leadTimeDays: z.number().int().min(0).default(7),
  defaultPriority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  defaultAssigneeId: z.string().uuid().optional(),
  isActive: z.boolean().default(true)
}).refine(
  (data) => {
    if (data.assignmentType === 'asset') return !!data.assetId
    if (data.assignmentType === 'category') return !!data.categoryId
    return false
  },
  {
    message: 'Please select either an asset or a category',
    path: ['assetId']
  }
).refine(
  (data) => {
    if (data.scheduleType === 'time_based' || data.scheduleType === 'combined') {
      return !!data.intervalType && !!data.startDate
    }
    return true
  },
  {
    message: 'Interval type and start date are required for time-based schedules',
    path: ['intervalType']
  }
).refine(
  (data) => {
    if (data.scheduleType === 'usage_based' || data.scheduleType === 'combined') {
      return !!data.intervalMileage || !!data.intervalHours
    }
    return true
  },
  {
    message: 'At least one of interval mileage or interval hours is required for usage-based schedules',
    path: ['intervalMileage']
  }
)

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: '',
  description: undefined,
  templateId: undefined,
  assignmentType: 'asset',
  assetId: undefined,
  categoryId: undefined,
  scheduleType: 'time_based',
  // Time-based defaults
  intervalType: 'monthly',
  intervalValue: 1,
  dayOfWeek: undefined,
  dayOfMonth: 1,
  monthOfYear: 1,
  startDate: new Date().toISOString().split('T')[0],
  endDate: undefined,
  // Usage-based defaults
  intervalMileage: undefined,
  intervalHours: undefined,
  thresholdAlertPercent: 90,
  // Work order settings
  leadTimeDays: 7,
  defaultPriority: 'medium',
  defaultAssigneeId: undefined,
  isActive: true
})

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/maintenance-schedules', {
      method: 'POST',
      body: {
        ...event.data,
        startDate: event.data.startDate ? new Date(event.data.startDate).toISOString() : undefined,
        endDate: event.data.endDate ? new Date(event.data.endDate).toISOString() : undefined
      }
    })
    toast.add({
      title: 'Schedule created',
      description: 'The maintenance schedule has been created successfully.',
      color: 'success'
    })
    router.push('/settings/maintenance-schedules')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create maintenance schedule.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const intervalTypeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
  { label: 'Custom (days)', value: 'custom' }
]

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' }
]

const dayOfWeekOptions = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 }
]

const monthOptions = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 }
]

const assetOptions = computed(() => {
  return assets.value?.map(a => ({
    label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
    value: a.id
  })) || []
})

const categoryOptions = computed(() => {
  return categories.value?.map(c => ({
    label: c.name,
    value: c.id
  })) || []
})

const templateOptions = computed(() => {
  return templates.value?.map(t => ({
    label: t.name,
    value: t.id
  })) || []
})

const technicianOptions = computed(() => {
  return technicians.value?.map(t => ({
    label: `${t.firstName} ${t.lastName}`,
    value: t.id
  })) || []
})

// Show/hide fields based on schedule type
const showTimeBasedFields = computed(() =>
  state.scheduleType === 'time_based' || state.scheduleType === 'combined'
)
const showUsageBasedFields = computed(() =>
  state.scheduleType === 'usage_based' || state.scheduleType === 'combined'
)

// Show/hide conditional fields based on interval type (for time-based)
const showDayOfWeek = computed(() => state.intervalType === 'weekly' && showTimeBasedFields.value)
const showDayOfMonth = computed(() =>
  showTimeBasedFields.value && ['monthly', 'quarterly', 'annually'].includes(state.intervalType || '')
)
const showMonthOfYear = computed(() => state.intervalType === 'annually' && showTimeBasedFields.value)
const showCustomInterval = computed(() => state.intervalType === 'custom' && showTimeBasedFields.value)

// Reset conditional fields when interval type changes
watch(() => state.intervalType, () => {
  if (!showDayOfWeek.value) state.dayOfWeek = undefined
  if (!showDayOfMonth.value) state.dayOfMonth = undefined
  if (!showMonthOfYear.value) state.monthOfYear = undefined
  if (!showCustomInterval.value) state.intervalValue = 1
})

// Reset fields when schedule type changes
watch(() => state.scheduleType, (newType) => {
  if (newType === 'usage_based') {
    // Clear time-based fields
    state.intervalType = undefined
    state.dayOfWeek = undefined
    state.dayOfMonth = undefined
    state.monthOfYear = undefined
    state.intervalValue = undefined
    state.startDate = undefined
    state.endDate = undefined
  } else if (newType === 'time_based') {
    // Clear usage-based fields
    state.intervalMileage = undefined
    state.intervalHours = undefined
  }
  // For 'combined', don't clear anything
})

// Clear asset/category when switching assignment type
watch(() => state.assignmentType, (newType) => {
  if (newType === 'asset') {
    state.categoryId = undefined
  } else {
    state.assetId = undefined
  }
})
</script>

<template>
  <UDashboardPanel id="new-maintenance-schedule">
    <template #header>
      <UDashboardNavbar title="New Maintenance Schedule">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/settings/maintenance-schedules')"
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
                Schedule Details
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Schedule Name" name="name" required>
                <UInput
                  v-model="state.name"
                  placeholder="e.g., Monthly Oil Change - Fleet Trucks"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Description" name="description">
                <UTextarea
                  v-model="state.description"
                  placeholder="Description of this maintenance schedule..."
                  class="w-full"
                  :rows="2"
                />
              </UFormField>

              <UFormField label="Task Template" name="templateId" hint="Optional - defines checklist and parts">
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
                Assignment
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Assign To" name="assignmentType" required>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="state.assignmentType"
                      type="radio"
                      value="asset"
                      class="form-radio"
                    >
                    <span>Specific Asset</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="state.assignmentType"
                      type="radio"
                      value="category"
                      class="form-radio"
                    >
                    <span>Asset Category</span>
                  </label>
                </div>
              </UFormField>

              <UFormField
                v-if="state.assignmentType === 'asset'"
                label="Asset"
                name="assetId"
                required
              >
                <USelect
                  v-model="state.assetId"
                  :items="assetOptions"
                  placeholder="Select an asset"
                  class="w-full"
                  searchable
                />
              </UFormField>

              <UFormField
                v-if="state.assignmentType === 'category'"
                label="Category"
                name="categoryId"
                required
              >
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
                Schedule Configuration
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Schedule Type" name="scheduleType" required>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="state.scheduleType"
                      type="radio"
                      value="time_based"
                      class="form-radio"
                    >
                    <span>Time-Based</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="state.scheduleType"
                      type="radio"
                      value="usage_based"
                      class="form-radio"
                    >
                    <span>Usage-Based</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="state.scheduleType"
                      type="radio"
                      value="combined"
                      class="form-radio"
                    >
                    <span>Combined</span>
                  </label>
                </div>
              </UFormField>

              <!-- Time-based fields -->
              <div v-if="showTimeBasedFields" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Interval Type" name="intervalType" required>
                  <USelect
                    v-model="state.intervalType"
                    :items="intervalTypeOptions"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  v-if="showCustomInterval"
                  label="Interval Value (days)"
                  name="intervalValue"
                  required
                >
                  <UInput
                    v-model.number="state.intervalValue"
                    type="number"
                    min="1"
                    placeholder="e.g., 30"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <UFormField
                v-if="showDayOfWeek"
                label="Day of Week"
                name="dayOfWeek"
                required
              >
                <USelect
                  v-model.number="state.dayOfWeek"
                  :items="dayOfWeekOptions"
                  placeholder="Select day"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="showDayOfMonth"
                label="Day of Month"
                name="dayOfMonth"
                required
              >
                <UInput
                  v-model.number="state.dayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g., 15"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="showMonthOfYear"
                label="Month"
                name="monthOfYear"
                required
              >
                <USelect
                  v-model.number="state.monthOfYear"
                  :items="monthOptions"
                  placeholder="Select month"
                  class="w-full"
                />
              </UFormField>

              <div v-if="showTimeBasedFields" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Start Date" name="startDate" required>
                  <UInput
                    v-model="state.startDate"
                    type="date"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="End Date" name="endDate" hint="Optional">
                  <UInput
                    v-model="state.endDate"
                    type="date"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <!-- Usage-based fields -->
              <div v-if="showUsageBasedFields" class="space-y-4 pt-4 border-t border-default">
                <p class="text-sm text-muted">
                  Triggers are based on asset usage metrics. At least one interval is required.
                </p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField
                    label="Interval Mileage (km)"
                    name="intervalMileage"
                    hint="Trigger every X km"
                  >
                    <UInput
                      v-model.number="state.intervalMileage"
                      type="number"
                      min="1"
                      placeholder="e.g., 5000"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField
                    label="Interval Hours"
                    name="intervalHours"
                    hint="Trigger every X operational hours"
                  >
                    <UInput
                      v-model.number="state.intervalHours"
                      type="number"
                      min="1"
                      placeholder="e.g., 250"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <UFormField
                  label="Alert Threshold (%)"
                  name="thresholdAlertPercent"
                  hint="Alert when this percentage of interval is reached"
                >
                  <UInput
                    v-model.number="state.thresholdAlertPercent"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="90"
                    class="w-full max-w-xs"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Work Order Settings
              </h3>
            </template>

            <div class="space-y-4">
              <UFormField
                label="Lead Time (days)"
                name="leadTimeDays"
                hint="How many days before due date to create work order"
              >
                <UInput
                  v-model.number="state.leadTimeDays"
                  type="number"
                  min="0"
                  placeholder="7"
                  class="w-full"
                />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Default Priority" name="defaultPriority">
                  <USelect
                    v-model="state.defaultPriority"
                    :items="priorityOptions"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Default Assignee" name="defaultAssigneeId" hint="Optional">
                  <USelect
                    v-model="state.defaultAssigneeId"
                    :items="technicianOptions"
                    placeholder="Select technician (optional)"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="router.push('/settings/maintenance-schedules')"
            />
            <UButton
              label="Save as Draft"
              color="neutral"
              variant="outline"
              :loading="loading"
              type="submit"
              @click="state.isActive = false"
            />
            <UButton
              label="Create & Activate"
              color="primary"
              :loading="loading"
              type="submit"
              @click="state.isActive = true"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
