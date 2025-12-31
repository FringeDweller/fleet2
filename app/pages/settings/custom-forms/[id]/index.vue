<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import type { ConditionalLogic } from '~/composables/useConditionalLogic'

interface CustomFormField {
  id: string
  fieldType: string
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  position: number
  options?: Array<{ label: string; value: string; color?: string }>
  width?: 'full' | 'half' | 'third'
  validation?: {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    patternMessage?: string
  }
  conditionalVisibilityAdvanced?: ConditionalLogic
  conditionalRequired?: ConditionalLogic
}

interface CustomFormVersion {
  id: string
  version: number
  publishedAt: string
  changelog: string | null
  publishedBy?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface CustomForm {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  version: number
  fields: CustomFormField[]
  settings: {
    allowDraft?: boolean
    requireSignature?: boolean
    allowMultipleSubmissions?: boolean
    submitButtonText?: string
    successMessage?: string
  }
  versionCount: number
  latestPublishedVersion: CustomFormVersion | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const formId = route.params.id as string

// Fetch form
const {
  data: form,
  status: fetchStatus,
  refresh,
} = await useFetch<CustomForm>(`/api/custom-forms/${formId}`, {
  lazy: true,
})

// State
const isLoading = ref(false)
const isPublishing = ref(false)
const publishModalOpen = ref(false)
const versionHistoryOpen = ref(false)
const publishChangelog = ref('')
const previewMode = ref(false)

// Field type options
const fieldTypes = [
  { label: 'Text', value: 'text', icon: 'i-lucide-type' },
  { label: 'Text Area', value: 'textarea', icon: 'i-lucide-align-left' },
  { label: 'Number', value: 'number', icon: 'i-lucide-hash' },
  { label: 'Email', value: 'email', icon: 'i-lucide-mail' },
  { label: 'Phone', value: 'phone', icon: 'i-lucide-phone' },
  { label: 'Date', value: 'date', icon: 'i-lucide-calendar' },
  { label: 'Time', value: 'time', icon: 'i-lucide-clock' },
  { label: 'Date & Time', value: 'datetime', icon: 'i-lucide-calendar-clock' },
  { label: 'Dropdown', value: 'dropdown', icon: 'i-lucide-list' },
  { label: 'Multi-Select', value: 'multi_select', icon: 'i-lucide-list-checks' },
  { label: 'Checkbox', value: 'checkbox', icon: 'i-lucide-check-square' },
  { label: 'Radio', value: 'radio', icon: 'i-lucide-circle-dot' },
  { label: 'File Upload', value: 'file', icon: 'i-lucide-file' },
  { label: 'Photo', value: 'photo', icon: 'i-lucide-camera' },
  { label: 'Signature', value: 'signature', icon: 'i-lucide-pen-line' },
  { label: 'Location', value: 'location', icon: 'i-lucide-map-pin' },
  { label: 'Barcode/QR', value: 'barcode', icon: 'i-lucide-scan-barcode' },
  { label: 'Section Header', value: 'section', icon: 'i-lucide-heading' },
]

// Editing state
const editingField = ref<CustomFormField | null>(null)
const fieldModalOpen = ref(false)

function addField(type: string) {
  const newField: CustomFormField = {
    id: crypto.randomUUID(),
    fieldType: type,
    label: `New ${fieldTypes.find((t) => t.value === type)?.label || 'Field'}`,
    required: false,
    position: form.value?.fields.length || 0,
    width: 'full',
  }

  if (['dropdown', 'multi_select', 'radio'].includes(type)) {
    newField.options = [
      { label: 'Option 1', value: 'option_1' },
      { label: 'Option 2', value: 'option_2' },
    ]
  }

  form.value?.fields.push(newField)
  editingField.value = newField
  fieldModalOpen.value = true
}

function editField(field: CustomFormField) {
  editingField.value = { ...field }
  fieldModalOpen.value = true
}

function saveField() {
  if (!editingField.value || !form.value) return

  const index = form.value.fields.findIndex((f: CustomFormField) => f.id === editingField.value!.id)
  if (index >= 0) {
    form.value.fields[index] = { ...editingField.value }
  }
  fieldModalOpen.value = false
  editingField.value = null
}

function removeField(fieldId: string) {
  if (!form.value) return
  form.value.fields = form.value.fields.filter((f: CustomFormField) => f.id !== fieldId)
  // Reorder positions
  form.value.fields.forEach((f: CustomFormField, i: number) => {
    f.position = i
  })
}

function moveField(fieldId: string, direction: 'up' | 'down') {
  if (!form.value) return
  const index = form.value.fields.findIndex((f: CustomFormField) => f.id === fieldId)
  if (index < 0) return

  if (direction === 'up' && index > 0) {
    const temp = form.value.fields[index - 1]
    form.value.fields[index - 1] = form.value.fields[index]!
    form.value.fields[index] = temp!
  } else if (direction === 'down' && index < form.value.fields.length - 1) {
    const temp = form.value.fields[index + 1]
    form.value.fields[index + 1] = form.value.fields[index]!
    form.value.fields[index] = temp!
  }

  // Update positions
  form.value.fields.forEach((f: CustomFormField, i: number) => {
    f.position = i
  })
}

async function saveForm() {
  if (!form.value) return

  isLoading.value = true
  try {
    await $fetch(`/api/custom-forms/${formId}`, {
      method: 'PUT',
      body: {
        name: form.value.name,
        description: form.value.description,
        status: form.value.status,
        fields: form.value.fields,
        settings: form.value.settings,
      },
    })
    toast.add({
      title: 'Form saved',
      description: 'Your changes have been saved.',
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to save form.',
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

async function publishForm() {
  if (!form.value) return

  isPublishing.value = true
  try {
    await $fetch(`/api/custom-forms/${formId}/publish`, {
      method: 'POST',
      body: {
        changelog: publishChangelog.value || undefined,
      },
    })
    toast.add({
      title: 'Form published',
      description: `Version ${form.value.version + 1} is now live.`,
    })
    publishModalOpen.value = false
    publishChangelog.value = ''
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to publish form.',
      color: 'error',
    })
  } finally {
    isPublishing.value = false
  }
}

function getFieldIcon(type: string) {
  return fieldTypes.find((t) => t.value === type)?.icon || 'i-lucide-square'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'success'
    case 'draft':
      return 'warning'
    case 'archived':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function addOption() {
  if (!editingField.value) return
  if (!editingField.value.options) {
    editingField.value.options = []
  }
  const index = editingField.value.options.length + 1
  editingField.value.options.push({
    label: `Option ${index}`,
    value: `option_${index}`,
  })
}

function removeOption(index: number) {
  if (!editingField.value?.options) return
  editingField.value.options.splice(index, 1)
}
</script>

<template>
  <UDashboardPanel id="custom-form-builder">
    <template #header>
      <UDashboardNavbar :title="form?.name || 'Form Builder'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/settings/custom-forms')"
          />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <!-- Version indicator -->
            <div
              v-if="form"
              class="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md mr-2"
            >
              <UIcon name="i-lucide-git-branch" class="w-4 h-4 text-muted" />
              <span class="text-sm">
                v{{ form.version }}
                <span v-if="!form.isPublished" class="text-muted">(unpublished)</span>
              </span>
              <UButton
                icon="i-lucide-history"
                variant="ghost"
                size="xs"
                title="View version history"
                @click="router.push(`/settings/custom-forms/${formId}/versions`)"
              />
            </div>

            <UBadge v-if="form" :color="getStatusColor(form.status)" variant="subtle">
              {{ form.status }}
            </UBadge>

            <UButton
              icon="i-lucide-list"
              title="View Responses"
              color="neutral"
              variant="ghost"
              @click="router.push(`/settings/custom-forms/${formId}/responses`)"
            />

            <UButton
              icon="i-lucide-bar-chart-3"
              title="Analytics"
              color="neutral"
              variant="ghost"
              @click="router.push(`/settings/custom-forms/${formId}/analytics`)"
            />

            <UButton
              :label="previewMode ? 'Edit' : 'Preview'"
              :icon="previewMode ? 'i-lucide-pencil' : 'i-lucide-eye'"
              color="neutral"
              variant="soft"
              :disabled="!form || form.fields.length === 0"
              @click="previewMode = !previewMode"
            />

            <UButton
              label="Save"
              icon="i-lucide-save"
              color="neutral"
              variant="soft"
              :loading="isLoading"
              :disabled="!form"
              @click="saveForm"
            />

            <UButton
              label="Publish"
              icon="i-lucide-rocket"
              color="primary"
              :disabled="!form || form.fields.length === 0"
              @click="publishModalOpen = true"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="fetchStatus === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Form not found -->
      <div v-else-if="!form" class="text-center py-12">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
        <p class="text-lg font-medium mb-2">Form not found</p>
        <UButton label="Back to Forms" @click="router.push('/settings/custom-forms')" />
      </div>

      <!-- Form builder -->
      <div v-else class="flex h-full">
        <!-- Preview Mode -->
        <div v-if="previewMode" class="flex-1 p-6 overflow-y-auto">
          <div class="max-w-3xl mx-auto">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-xl font-semibold">{{ form.name }}</h2>
                <p v-if="form.description" class="text-muted mt-1">{{ form.description }}</p>
              </div>
              <UBadge color="info" variant="subtle">
                Preview Mode
              </UBadge>
            </div>
            <FormsFormPreview :fields="form.fields" />
          </div>
        </div>

        <!-- Edit Mode -->
        <template v-else>
          <!-- Field palette -->
          <div class="w-64 border-r border-default p-4 overflow-y-auto">
            <h3 class="font-medium text-sm text-muted mb-3">Add Fields</h3>
            <div class="space-y-1">
              <UButton
                v-for="fieldType in fieldTypes"
                :key="fieldType.value"
                :label="fieldType.label"
                :icon="fieldType.icon"
                color="neutral"
                variant="ghost"
                block
                class="justify-start"
                @click="addField(fieldType.value)"
              />
            </div>
          </div>

        <!-- Form canvas -->
        <div class="flex-1 p-6 overflow-y-auto bg-muted/20">
          <div class="max-w-2xl mx-auto">
            <!-- Form header -->
            <UPageCard variant="subtle" class="mb-4">
              <UFormField label="Form Name" required>
                <UInput v-model="form.name" />
              </UFormField>
              <UFormField label="Description" class="mt-4">
                <UTextarea v-model="form.description" :rows="2" />
              </UFormField>
            </UPageCard>

            <!-- Fields -->
            <div v-if="form.fields.length === 0" class="text-center py-12 border-2 border-dashed border-default rounded-lg">
              <UIcon name="i-lucide-layout-list" class="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
              <p class="text-muted">Add fields from the palette on the left</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(field, index) in form.fields"
                :key="field.id"
                class="group bg-default rounded-lg border border-default p-4 hover:border-primary/50 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <UIcon :name="getFieldIcon(field.fieldType)" class="w-5 h-5 text-primary shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium truncate">{{ field.label }}</span>
                        <span v-if="field.required" class="text-error text-sm">*</span>
                        <UBadge color="neutral" variant="subtle" size="xs">
                          {{ field.fieldType }}
                        </UBadge>
                        <UBadge v-if="field.width && field.width !== 'full'" color="info" variant="subtle" size="xs">
                          {{ field.width }}
                        </UBadge>
                        <UBadge
                          v-if="field.conditionalVisibilityAdvanced?.enabled"
                          color="warning"
                          variant="subtle"
                          size="xs"
                          class="gap-1"
                        >
                          <UIcon name="i-lucide-eye" class="w-3 h-3" />
                          conditional
                        </UBadge>
                        <UBadge
                          v-if="field.conditionalRequired?.enabled"
                          color="error"
                          variant="subtle"
                          size="xs"
                          class="gap-1"
                        >
                          <UIcon name="i-lucide-asterisk" class="w-3 h-3" />
                          conditional required
                        </UBadge>
                      </div>
                      <p v-if="field.helpText" class="text-sm text-muted truncate mt-0.5">
                        {{ field.helpText }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <UButton
                      icon="i-lucide-chevron-up"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === 0"
                      @click="moveField(field.id, 'up')"
                    />
                    <UButton
                      icon="i-lucide-chevron-down"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === form.fields.length - 1"
                      @click="moveField(field.id, 'down')"
                    />
                    <UButton
                      icon="i-lucide-pencil"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="editField(field)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="error"
                      variant="ghost"
                      @click="removeField(field.id)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings panel -->
        <div class="w-72 border-l border-default p-4 overflow-y-auto">
          <h3 class="font-medium text-sm text-muted mb-3">Form Settings</h3>
          <div class="space-y-4">
            <UFormField label="Status">
              <USelect
                v-model="form.status"
                :items="[
                  { label: 'Draft', value: 'draft' },
                  { label: 'Active', value: 'active' },
                  { label: 'Archived', value: 'archived' },
                ]"
              />
            </UFormField>

            <USeparator />

            <UCheckbox
              v-model="form.settings.allowDraft"
              label="Allow draft submissions"
            />
            <UCheckbox
              v-model="form.settings.requireSignature"
              label="Require signature"
            />
            <UCheckbox
              v-model="form.settings.allowMultipleSubmissions"
              label="Allow multiple submissions"
            />

            <USeparator />

            <UFormField label="Submit Button Text">
              <UInput v-model="form.settings.submitButtonText" placeholder="Submit" />
            </UFormField>

            <UFormField label="Success Message">
              <UTextarea
                v-model="form.settings.successMessage"
                placeholder="Thank you for your submission"
                :rows="2"
              />
            </UFormField>
          </div>
        </div>
        </template>
      </div>
    </template>

    <!-- Field Edit Modal -->
    <UModal v-model:open="fieldModalOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard v-if="editingField">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Edit Field</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="fieldModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <UFormField label="Label" required>
              <UInput v-model="editingField.label" />
            </UFormField>

            <UFormField label="Placeholder">
              <UInput v-model="editingField.placeholder" />
            </UFormField>

            <UFormField label="Help Text">
              <UInput v-model="editingField.helpText" />
            </UFormField>

            <div class="flex items-center gap-4">
              <UCheckbox v-model="editingField.required" label="Required" />
            </div>

            <UFormField label="Width">
              <USelect
                v-model="editingField.width"
                :items="[
                  { label: 'Full Width', value: 'full' },
                  { label: 'Half Width', value: 'half' },
                  { label: 'Third Width', value: 'third' },
                ]"
              />
            </UFormField>

            <!-- Options for dropdown, multi_select, radio -->
            <div v-if="['dropdown', 'multi_select', 'radio'].includes(editingField.fieldType)">
              <USeparator class="my-4" />
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium">Options</span>
                <UButton
                  label="Add Option"
                  icon="i-lucide-plus"
                  size="xs"
                  variant="soft"
                  @click="addOption"
                />
              </div>
              <div class="space-y-2">
                <div
                  v-for="(option, index) in editingField.options"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <UInput
                    v-model="option.label"
                    placeholder="Label"
                    class="flex-1"
                  />
                  <UInput
                    v-model="option.value"
                    placeholder="Value"
                    class="flex-1"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="removeOption(index)"
                  />
                </div>
              </div>
            </div>

            <!-- Conditional Logic Section -->
            <div v-if="form && form.fields.length > 1">
              <USeparator class="my-4" />
              <div class="space-y-4">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <UIcon name="i-lucide-git-branch" class="w-4 h-4 text-muted" />
                  <span>Conditional Logic</span>
                </div>

                <!-- Conditional Visibility -->
                <FormsConditionBuilder
                  v-model="editingField.conditionalVisibilityAdvanced"
                  :fields="form.fields.filter((f: CustomFormField) => f.id !== editingField!.id)"
                  :current-field-id="editingField.id"
                  label="Conditional Visibility"
                  description="Show this field only when conditions are met"
                />

                <!-- Conditional Required -->
                <FormsConditionBuilder
                  v-model="editingField.conditionalRequired"
                  :fields="form.fields.filter((f: CustomFormField) => f.id !== editingField!.id)"
                  :current-field-id="editingField.id"
                  label="Conditional Required"
                  description="Make this field required when conditions are met"
                />

                <!-- Preview of conditions -->
                <FormsConditionPreview
                  v-if="editingField.conditionalVisibilityAdvanced?.enabled"
                  :conditional-logic="editingField.conditionalVisibilityAdvanced"
                  :fields="form.fields"
                  type="visibility"
                />
                <FormsConditionPreview
                  v-if="editingField.conditionalRequired?.enabled"
                  :conditional-logic="editingField.conditionalRequired"
                  :fields="form.fields"
                  type="required"
                />
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="fieldModalOpen = false" />
              <UButton label="Save" @click="saveField" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Publish Modal -->
    <UModal v-model:open="publishModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Publish Form</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="publishModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-muted">
              Publishing creates a new version of this form. This version will be used
              for all new submissions.
            </p>

            <div v-if="form" class="p-3 bg-muted/50 rounded-lg">
              <div class="flex items-center gap-2 text-sm">
                <UIcon name="i-lucide-info" class="w-4 h-4 text-info" />
                <span>
                  Current version: <strong>{{ form.version }}</strong>
                  will become <strong>{{ form.version + 1 }}</strong>
                </span>
              </div>
            </div>

            <UFormField label="Changelog (optional)">
              <UTextarea
                v-model="publishChangelog"
                placeholder="Describe what changed in this version..."
                :rows="3"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="publishModalOpen = false" />
              <UButton
                label="Publish"
                icon="i-lucide-rocket"
                :loading="isPublishing"
                @click="publishForm"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
