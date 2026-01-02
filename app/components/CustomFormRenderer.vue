<script setup lang="ts">
import type { CustomFormField, CustomFormSettings } from '~/types/custom-forms'

const props = defineProps<{
  formId: string
  fields: CustomFormField[]
  settings?: CustomFormSettings
  contextType?: string
  contextId?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  submitted: [submissionId: string | undefined]
  cancel: []
}>()

const toast = useToast()

// Form state - typed as any to allow flexible form field values
const responses = ref<Record<string, any>>({})
const submitting = ref(false)
const errors = ref<Record<string, string>>({})

// Initialize default values
onMounted(() => {
  for (const field of props.fields) {
    if (field.defaultValue !== undefined) {
      responses.value[field.id] = field.defaultValue
    } else if (field.fieldType === 'checkbox') {
      responses.value[field.id] = false
    } else if (field.fieldType === 'multi_select') {
      responses.value[field.id] = []
    }
  }
})

// Sort fields by position
const sortedFields = computed(() => {
  return [...props.fields].sort((a, b) => a.position - b.position)
})

// Field validation
function validateField(field: CustomFormField): string | null {
  const value = responses.value[field.id]

  // Skip section fields
  if (field.fieldType === 'section') return null

  // Required check
  if (field.required) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return `${field.label} is required`
    }
  }

  // Skip further validation if empty
  if (value === undefined || value === null || value === '') return null

  // Type-specific validation
  switch (field.fieldType) {
    case 'email':
      if (typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address'
        }
      }
      break

    case 'url':
      if (typeof value === 'string') {
        try {
          new URL(value)
        } catch {
          return 'Please enter a valid URL'
        }
      }
      break

    case 'number': {
      const num = Number(value)
      if (Number.isNaN(num)) {
        return 'Please enter a valid number'
      }
      if (field.validation?.min !== undefined && num < field.validation.min) {
        return `Must be at least ${field.validation.min}`
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        return `Must be at most ${field.validation.max}`
      }
      break
    }

    case 'text':
    case 'textarea':
      if (typeof value === 'string' && field.validation) {
        if (field.validation.minLength && value.length < field.validation.minLength) {
          return `Must be at least ${field.validation.minLength} characters`
        }
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          return `Must be at most ${field.validation.maxLength} characters`
        }
      }
      break
  }

  return null
}

// Validate all fields
function validateAll(): boolean {
  errors.value = {}
  let valid = true

  for (const field of props.fields) {
    const error = validateField(field)
    if (error) {
      errors.value[field.id] = error
      valid = false
    }
  }

  return valid
}

// Submit the form
async function handleSubmit(asDraft = false) {
  if (!asDraft && !validateAll()) {
    toast.add({
      title: 'Validation Error',
      description: 'Please fix the errors before submitting',
      color: 'error',
    })
    return
  }

  submitting.value = true

  try {
    const result = await $fetch<{ id: string }>('/api/custom-form-submissions', {
      method: 'POST',
      body: {
        formId: props.formId,
        responses: responses.value,
        status: asDraft ? 'draft' : 'submitted',
        contextType: props.contextType,
        contextId: props.contextId,
      },
    })

    toast.add({
      title: asDraft ? 'Draft Saved' : 'Form Submitted',
      description: asDraft
        ? 'Your draft has been saved'
        : 'Your form has been submitted successfully',
      color: 'success',
    })

    emit('submitted', result.id)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit form'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    submitting.value = false
  }
}

// Get field input component and props
function getFieldWidth(field: CustomFormField): string {
  switch (field.width) {
    case 'half':
      return 'sm:col-span-1'
    case 'third':
      return 'sm:col-span-1'
    default:
      return 'sm:col-span-2'
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit(false)" class="space-y-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <template v-for="field in sortedFields" :key="field.id">
        <!-- Section Header -->
        <div v-if="field.fieldType === 'section'" class="sm:col-span-2 pt-4 first:pt-0">
          <h3 class="text-lg font-medium border-b border-default pb-2">
            {{ field.label }}
          </h3>
          <p v-if="field.helpText" class="text-sm text-muted mt-1">
            {{ field.helpText }}
          </p>
        </div>

        <!-- Text Input -->
        <UFormField
          v-else-if="field.fieldType === 'text' || field.fieldType === 'email' || field.fieldType === 'phone' || field.fieldType === 'url'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            :type="field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : field.fieldType === 'url' ? 'url' : 'text'"
            :placeholder="field.placeholder"
            :disabled="readonly"
          />
        </UFormField>

        <!-- Textarea -->
        <UFormField
          v-else-if="field.fieldType === 'textarea'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UTextarea
            v-model="responses[field.id]"
            :placeholder="field.placeholder"
            :disabled="readonly"
            :rows="4"
          />
        </UFormField>

        <!-- Number Input -->
        <UFormField
          v-else-if="field.fieldType === 'number'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model.number="responses[field.id]"
            type="number"
            :placeholder="field.placeholder"
            :disabled="readonly"
            :step="field.decimalPlaces ? Math.pow(10, -field.decimalPlaces) : 1"
          />
          <template v-if="field.unit" #trailing>
            <span class="text-muted text-sm">{{ field.unit }}</span>
          </template>
        </UFormField>

        <!-- Date Input -->
        <UFormField
          v-else-if="field.fieldType === 'date'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            type="date"
            :disabled="readonly"
          />
        </UFormField>

        <!-- Time Input -->
        <UFormField
          v-else-if="field.fieldType === 'time'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            type="time"
            :disabled="readonly"
          />
        </UFormField>

        <!-- DateTime Input -->
        <UFormField
          v-else-if="field.fieldType === 'datetime'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            type="datetime-local"
            :disabled="readonly"
          />
        </UFormField>

        <!-- Dropdown / Select -->
        <UFormField
          v-else-if="field.fieldType === 'dropdown'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <USelect
            v-model="responses[field.id]"
            :options="field.options?.map(o => ({ label: o.label, value: o.value })) || []"
            :placeholder="field.placeholder || 'Select an option'"
            :disabled="readonly"
          />
        </UFormField>

        <!-- Radio Group -->
        <UFormField
          v-else-if="field.fieldType === 'radio'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <URadioGroup
            v-model="responses[field.id]"
            :items="field.options?.map(o => ({ label: o.label, value: o.value })) || []"
            :disabled="readonly"
          />
        </UFormField>

        <!-- Checkbox -->
        <UFormField
          v-else-if="field.fieldType === 'checkbox'"
          :class="getFieldWidth(field)"
          :error="errors[field.id]"
        >
          <UCheckbox
            v-model="responses[field.id]"
            :label="field.label"
            :disabled="readonly"
          />
          <p v-if="field.helpText" class="text-sm text-muted mt-1">
            {{ field.helpText }}
          </p>
        </UFormField>

        <!-- Multi-select (using checkboxes) -->
        <UFormField
          v-else-if="field.fieldType === 'multi_select'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <div class="space-y-2">
            <UCheckbox
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :model-value="(responses[field.id] as string[] || []).includes(option.value)"
              :disabled="readonly"
              @update:model-value="(checked: boolean | 'indeterminate') => {
                const arr = (responses[field.id] as string[]) || []
                if (checked === true) {
                  responses[field.id] = [...arr, option.value]
                } else {
                  responses[field.id] = arr.filter(v => v !== option.value)
                }
              }"
            />
          </div>
        </UFormField>

        <!-- File/Photo Upload (simplified placeholder) -->
        <UFormField
          v-else-if="field.fieldType === 'file' || field.fieldType === 'photo'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <div class="flex items-center justify-center w-full h-24 border-2 border-dashed border-default rounded-lg bg-muted/30">
            <div class="text-center">
              <UIcon :name="field.fieldType === 'photo' ? 'i-lucide-camera' : 'i-lucide-upload'" class="w-8 h-8 text-muted mx-auto mb-1" />
              <p class="text-sm text-muted">{{ field.fieldType === 'photo' ? 'Photo upload' : 'File upload' }} coming soon</p>
            </div>
          </div>
        </UFormField>

        <!-- Signature (simplified placeholder) -->
        <UFormField
          v-else-if="field.fieldType === 'signature'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <div class="flex items-center justify-center w-full h-24 border-2 border-dashed border-default rounded-lg bg-muted/30">
            <div class="text-center">
              <UIcon name="i-lucide-pen-tool" class="w-8 h-8 text-muted mx-auto mb-1" />
              <p class="text-sm text-muted">Signature capture coming soon</p>
            </div>
          </div>
        </UFormField>

        <!-- Location (simplified placeholder) -->
        <UFormField
          v-else-if="field.fieldType === 'location'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <div class="flex items-center justify-center w-full h-24 border-2 border-dashed border-default rounded-lg bg-muted/30">
            <div class="text-center">
              <UIcon name="i-lucide-map-pin" class="w-8 h-8 text-muted mx-auto mb-1" />
              <p class="text-sm text-muted">Location capture coming soon</p>
            </div>
          </div>
        </UFormField>

        <!-- Barcode (simplified placeholder) -->
        <UFormField
          v-else-if="field.fieldType === 'barcode'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            :placeholder="field.placeholder || 'Enter or scan barcode'"
            :disabled="readonly"
          >
            <template #trailing>
              <UButton
                icon="i-lucide-scan"
                color="neutral"
                variant="ghost"
                size="xs"
                disabled
              />
            </template>
          </UInput>
        </UFormField>

        <!-- Calculated (display only) -->
        <UFormField
          v-else-if="field.fieldType === 'calculated'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :help="field.helpText"
        >
          <div class="p-2 bg-muted/30 rounded border border-default text-muted">
            Calculated value
          </div>
        </UFormField>

        <!-- Lookup (simplified placeholder) -->
        <UFormField
          v-else-if="field.fieldType === 'lookup'"
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            :placeholder="field.placeholder || 'Search...'"
            :disabled="readonly"
          >
            <template #trailing>
              <UIcon name="i-lucide-search" class="text-muted" />
            </template>
          </UInput>
        </UFormField>

        <!-- Fallback for unknown field types -->
        <UFormField
          v-else
          :class="getFieldWidth(field)"
          :label="field.label"
          :required="field.required"
          :error="errors[field.id]"
          :help="field.helpText"
        >
          <UInput
            v-model="responses[field.id]"
            :placeholder="field.placeholder"
            :disabled="readonly"
          />
        </UFormField>
      </template>
    </div>

    <!-- Form Actions -->
    <div v-if="!readonly" class="flex items-center justify-end gap-3 pt-4 border-t border-default">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        label="Cancel"
        @click="emit('cancel')"
      />
      <UButton
        v-if="settings?.allowDraft"
        type="button"
        color="neutral"
        variant="soft"
        label="Save Draft"
        :loading="submitting"
        @click="handleSubmit(true)"
      />
      <UButton
        type="submit"
        color="primary"
        :label="settings?.submitButtonText || 'Submit'"
        :loading="submitting"
      />
    </div>

    <!-- Readonly notice -->
    <div v-else class="flex items-center justify-end gap-3 pt-4 border-t border-default">
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        label="Close"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
