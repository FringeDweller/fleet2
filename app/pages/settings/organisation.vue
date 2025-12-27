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
}

const {
  data: organisation,
  refresh,
  status,
} = await useFetch<Organisation>('/api/organisations/current', {
  default: () => ({
    id: '',
    name: '',
    slug: '',
    description: null,
    logoUrl: null,
    primaryColor: '#0066cc',
    preventNegativeStock: false,
  }),
})

const organisationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  preventNegativeStock: z.boolean(),
})

type OrganisationSchema = z.output<typeof organisationSchema>

const formState = reactive<OrganisationSchema>({
  name: '',
  description: null,
  primaryColor: '#0066cc',
  preventNegativeStock: false,
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
      </UPageCard>
    </UForm>
  </div>
</template>
