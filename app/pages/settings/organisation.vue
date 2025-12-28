<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

const { canWriteSettings } = usePermissions()
const toast = useToast()

interface Organisation {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  primaryColor: string
  preventNegativeStock: boolean
  workOrderApprovalThreshold: string | null
  requireApprovalForAllWorkOrders: boolean
  autoCreateWorkOrderOnDefect: boolean
  blockVehicleOnCriticalDefect: boolean
  blockingDefectSeverities: Array<'minor' | 'major' | 'critical'>
  handoverThresholdMinutes: number
}

// Severity options for the multi-select
const severityOptions = [
  { value: 'minor', label: 'Minor', description: 'Low-priority issues that can wait' },
  { value: 'major', label: 'Major', description: 'Important issues needing attention soon' },
  {
    value: 'critical',
    label: 'Critical',
    description: 'Safety-critical issues requiring immediate action',
  },
]

const {
  data: organisation,
  refresh,
  status,
} = await useFetch<Organisation>('/api/organisations/current', {
  default: (): Organisation => ({
    id: '',
    name: '',
    slug: '',
    description: null,
    logoUrl: null,
    primaryColor: '#0066cc',
    preventNegativeStock: false,
    workOrderApprovalThreshold: null,
    requireApprovalForAllWorkOrders: false,
    autoCreateWorkOrderOnDefect: true,
    blockVehicleOnCriticalDefect: true,
    blockingDefectSeverities: ['critical'] as Array<'minor' | 'major' | 'critical'>,
    handoverThresholdMinutes: 30,
  }),
})

const organisationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  preventNegativeStock: z.boolean(),
  workOrderApprovalThreshold: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
    .nullable()
    .optional(),
  requireApprovalForAllWorkOrders: z.boolean(),
  autoCreateWorkOrderOnDefect: z.boolean(),
  blockVehicleOnCriticalDefect: z.boolean(),
  blockingDefectSeverities: z
    .array(z.enum(['minor', 'major', 'critical']))
    .min(1, 'At least one severity must be selected'),
  handoverThresholdMinutes: z.number().int().min(5).max(120),
})

type OrganisationSchema = z.output<typeof organisationSchema>

const formState = reactive<OrganisationSchema>({
  name: '',
  description: null,
  primaryColor: '#0066cc',
  preventNegativeStock: false,
  workOrderApprovalThreshold: null,
  requireApprovalForAllWorkOrders: false,
  autoCreateWorkOrderOnDefect: true,
  blockVehicleOnCriticalDefect: true,
  blockingDefectSeverities: ['critical'],
  handoverThresholdMinutes: 30,
})

// Sync form state with fetched data
watch(
  organisation,
  (org) => {
    if (org) {
      formState.name = org.name
      formState.description = org.description
      formState.primaryColor = org.primaryColor
      formState.preventNegativeStock = org.preventNegativeStock
      formState.workOrderApprovalThreshold = org.workOrderApprovalThreshold
      formState.requireApprovalForAllWorkOrders = org.requireApprovalForAllWorkOrders
      formState.autoCreateWorkOrderOnDefect = org.autoCreateWorkOrderOnDefect
      formState.blockVehicleOnCriticalDefect = org.blockVehicleOnCriticalDefect
      formState.blockingDefectSeverities = org.blockingDefectSeverities
      formState.handoverThresholdMinutes = org.handoverThresholdMinutes
    }
  },
  { immediate: true },
)

const isSaving = ref(false)

async function onSubmit(event: FormSubmitEvent<OrganisationSchema>) {
  if (!canWriteSettings.value) return

  isSaving.value = true
  try {
    await $fetch('/api/organisations/current', {
      method: 'PUT',
      body: event.data,
    })
    toast.add({
      title: 'Settings saved',
      description: 'Organisation settings have been updated.',
      icon: 'i-lucide-check',
      color: 'success',
    })
    await refresh()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save settings'
    toast.add({
      title: 'Error',
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div>
    <UForm
      id="organisation-settings"
      :schema="organisationSchema"
      :state="formState"
      @submit="onSubmit"
    >
      <UPageCard
        title="Organisation Settings"
        description="Manage your organisation's profile and preferences."
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <PermissionGate permission="settings:write">
          <UButton
            form="organisation-settings"
            label="Save changes"
            color="neutral"
            type="submit"
            :loading="isSaving"
            class="w-fit lg:ms-auto"
          />
        </PermissionGate>
      </UPageCard>

      <div v-if="status === 'pending'" class="p-8 text-center text-muted">
        Loading organisation settings...
      </div>

      <UPageCard v-else variant="subtle">
        <UFormField
          name="name"
          label="Organisation Name"
          description="The name of your organisation displayed throughout the application."
          required
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <UInput
            v-model="formState.name"
            :disabled="!canWriteSettings"
            autocomplete="off"
          />
        </UFormField>

        <USeparator />

        <div class="flex max-sm:flex-col justify-between items-start gap-4 py-4">
          <div>
            <p class="text-sm font-medium text-highlighted">Organisation Slug</p>
            <p class="text-sm text-muted mt-1">
              Unique identifier used in URLs. Cannot be changed.
            </p>
          </div>
          <UBadge color="neutral" variant="subtle" size="lg">
            {{ organisation?.slug }}
          </UBadge>
        </div>

        <USeparator />

        <UFormField
          name="description"
          label="Description"
          description="A brief description of your organisation."
          class="flex max-sm:flex-col justify-between items-start gap-4"
          :ui="{ container: 'w-full' }"
        >
          <UTextarea
            v-model="formState.description"
            :rows="3"
            :disabled="!canWriteSettings"
            autoresize
            class="w-full"
          />
        </UFormField>

        <USeparator />

        <UFormField
          name="primaryColor"
          label="Primary Color"
          description="Brand color used for buttons and accents."
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <div class="flex items-center gap-3">
            <input
              v-model="formState.primaryColor"
              type="color"
              :disabled="!canWriteSettings"
              class="w-10 h-10 rounded cursor-pointer disabled:cursor-not-allowed"
            />
            <UInput
              v-model="formState.primaryColor"
              :disabled="!canWriteSettings"
              class="w-28"
              placeholder="#0066cc"
            />
          </div>
        </UFormField>

        <USeparator />

        <h3 class="text-base font-semibold text-highlighted py-4">
          Inventory Settings
        </h3>

        <UFormField
          name="preventNegativeStock"
          class="flex justify-between items-center gap-4"
        >
          <div>
            <p class="text-sm font-medium text-highlighted">Prevent Negative Stock</p>
            <p class="text-sm text-muted mt-1">
              When enabled, the system will prevent parts from going below zero quantity.
            </p>
          </div>
          <USwitch
            v-model="formState.preventNegativeStock"
            :disabled="!canWriteSettings"
          />
        </UFormField>

        <USeparator />

        <h3 class="text-base font-semibold text-highlighted py-4">
          Work Order Approval Settings
        </h3>

        <UFormField
          name="requireApprovalForAllWorkOrders"
          class="flex justify-between items-center gap-4"
        >
          <div>
            <p class="text-sm font-medium text-highlighted">Require Approval for All Work Orders</p>
            <p class="text-sm text-muted mt-1">
              When enabled, all work orders require manager approval before they can be opened.
            </p>
          </div>
          <USwitch
            v-model="formState.requireApprovalForAllWorkOrders"
            :disabled="!canWriteSettings"
          />
        </UFormField>

        <USeparator />

        <UFormField
          name="workOrderApprovalThreshold"
          label="Approval Threshold Amount"
          description="Work orders with estimated costs at or above this amount require approval. Leave empty to only use the toggle above."
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <div class="flex items-center gap-2">
            <span class="text-muted">$</span>
            <UInput
              v-model="formState.workOrderApprovalThreshold"
              :disabled="!canWriteSettings || formState.requireApprovalForAllWorkOrders"
              placeholder="0.00"
              class="w-32"
              type="text"
              inputmode="decimal"
            />
          </div>
        </UFormField>
        <p v-if="formState.requireApprovalForAllWorkOrders" class="text-sm text-muted -mt-2">
          The threshold is ignored when approval is required for all work orders.
        </p>

        <USeparator />

        <h3 class="text-base font-semibold text-highlighted py-4">
          Defect Management Settings
        </h3>

        <UFormField
          name="autoCreateWorkOrderOnDefect"
          class="flex justify-between items-center gap-4"
        >
          <div>
            <p class="text-sm font-medium text-highlighted">Auto-Create Work Orders for Defects</p>
            <p class="text-sm text-muted mt-1">
              Automatically create work orders when major or critical defects are reported.
            </p>
          </div>
          <USwitch
            v-model="formState.autoCreateWorkOrderOnDefect"
            :disabled="!canWriteSettings"
          />
        </UFormField>

        <USeparator />

        <h3 class="text-base font-semibold text-highlighted py-4">
          Vehicle Operation Blocking
        </h3>
        <p class="text-sm text-muted -mt-2 mb-4">
          Control when vehicles are blocked from operation due to active defects.
        </p>

        <UFormField
          name="blockVehicleOnCriticalDefect"
          class="flex justify-between items-center gap-4"
        >
          <div>
            <p class="text-sm font-medium text-highlighted">Enable Operation Blocking</p>
            <p class="text-sm text-muted mt-1">
              Block vehicles from operation when they have unresolved defects of the configured severity.
            </p>
          </div>
          <USwitch
            v-model="formState.blockVehicleOnCriticalDefect"
            :disabled="!canWriteSettings"
          />
        </UFormField>

        <template v-if="formState.blockVehicleOnCriticalDefect">
          <USeparator class="my-2" />

          <UFormField
            name="blockingDefectSeverities"
            label="Blocking Severities"
            description="Select which defect severity levels will block vehicle operation."
            class="flex max-sm:flex-col justify-between items-start gap-4"
          >
            <div class="space-y-3">
              <div
                v-for="option in severityOptions"
                :key="option.value"
                class="flex items-start gap-3"
              >
                <UCheckbox
                  :model-value="formState.blockingDefectSeverities.includes(option.value as 'minor' | 'major' | 'critical')"
                  :disabled="!canWriteSettings"
                  @update:model-value="(checked: boolean | 'indeterminate') => {
                    if (checked === true) {
                      if (!formState.blockingDefectSeverities.includes(option.value as 'minor' | 'major' | 'critical')) {
                        formState.blockingDefectSeverities.push(option.value as 'minor' | 'major' | 'critical')
                      }
                    } else if (checked === false) {
                      const index = formState.blockingDefectSeverities.indexOf(option.value as 'minor' | 'major' | 'critical')
                      if (index > -1 && formState.blockingDefectSeverities.length > 1) {
                        formState.blockingDefectSeverities.splice(index, 1)
                      }
                    }
                  }"
                />
                <div class="-mt-0.5">
                  <p class="text-sm font-medium text-highlighted">{{ option.label }}</p>
                  <p class="text-xs text-muted">{{ option.description }}</p>
                </div>
              </div>
            </div>
          </UFormField>

          <UAlert
            icon="i-lucide-shield-alert"
            color="warning"
            variant="soft"
            class="mt-4"
            title="Supervisor Override"
            description="Supervisors, managers, and admins can override operation blocks when necessary. All overrides are logged in the audit trail."
          />
        </template>

        <USeparator />

        <h3 class="text-base font-semibold text-highlighted py-4">
          Operator Handover Settings
        </h3>

        <UFormField
          name="handoverThresholdMinutes"
          label="Handover Window"
          description="Time window in minutes within which operator sessions are considered a handover (linked together)."
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <div class="flex items-center gap-2">
            <UInput
              v-model.number="formState.handoverThresholdMinutes"
              :disabled="!canWriteSettings"
              type="number"
              :min="5"
              :max="120"
              class="w-24"
            />
            <span class="text-muted">minutes</span>
          </div>
        </UFormField>
      </UPageCard>
    </UForm>
  </div>
</template>
