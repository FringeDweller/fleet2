<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const toast = useToast()

const isLoading = ref(false)

const formData = reactive({
  name: '',
  description: '',
  status: 'draft' as 'draft' | 'active' | 'archived',
  fields: [] as Array<{
    id: string
    fieldType: string
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    position: number
    options?: Array<{ label: string; value: string }>
    width?: 'full' | 'half' | 'third'
  }>,
  settings: {
    allowDraft: false,
    requireSignature: false,
    allowMultipleSubmissions: true,
    submitButtonText: 'Submit',
    successMessage: 'Form submitted successfully',
  },
})

async function createForm() {
  if (!formData.name.trim()) {
    toast.add({
      title: 'Error',
      description: 'Form name is required.',
      color: 'error',
    })
    return
  }

  isLoading.value = true
  try {
    const form = await $fetch('/api/custom-forms', {
      method: 'POST',
      body: formData,
    })
    toast.add({
      title: 'Form created',
      description: `"${formData.name}" has been created.`,
    })
    router.push(`/settings/custom-forms/${(form as { id: string }).id}`)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to create form.',
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="custom-form-new">
    <template #header>
      <UDashboardNavbar title="Create Custom Form">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/settings/custom-forms')"
          />
        </template>

        <template #right>
          <UButton
            label="Create Form"
            icon="i-lucide-check"
            color="primary"
            :loading="isLoading"
            @click="createForm"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto p-6">
        <UPageCard variant="subtle">
          <div class="space-y-6">
            <UFormField label="Form Name" required>
              <UInput
                v-model="formData.name"
                placeholder="Enter form name"
                autofocus
              />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="formData.description"
                placeholder="Describe the purpose of this form"
                :rows="3"
              />
            </UFormField>

            <USeparator />

            <h3 class="font-medium">Form Settings</h3>

            <div class="space-y-4">
              <UCheckbox
                v-model="formData.settings.allowDraft"
                label="Allow draft submissions"
              />
              <UCheckbox
                v-model="formData.settings.requireSignature"
                label="Require signature"
              />
              <UCheckbox
                v-model="formData.settings.allowMultipleSubmissions"
                label="Allow multiple submissions"
              />
            </div>

            <UFormField label="Submit Button Text">
              <UInput v-model="formData.settings.submitButtonText" />
            </UFormField>

            <UFormField label="Success Message">
              <UTextarea
                v-model="formData.settings.successMessage"
                :rows="2"
              />
            </UFormField>
          </div>
        </UPageCard>

        <p class="text-sm text-muted mt-4 text-center">
          You can add fields to your form after creating it.
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
