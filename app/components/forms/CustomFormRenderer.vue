<script setup lang="ts">
/**
 * Custom Form Renderer Component (US-13.4)
 * Renders a custom form with all 16+ field types, validation,
 * conditional logic, auto-save, and offline support.
 */

import type { CustomFormField, CustomFormSettings } from '~/types/custom-forms'

// Extended field type with conditional logic (same as base CustomFormField, which includes these already)
type CustomFormFieldExt = CustomFormField

// Alias for backwards compatibility
type FormSettings = CustomFormSettings

const props = defineProps<{
  formId: string
  versionId?: string
  fields: CustomFormFieldExt[]
  settings?: FormSettings
  contextType?: 'asset' | 'work_order' | 'inspection' | 'operator'
  contextId?: string
  initialValues?: Record<string, unknown>
  readonly?: boolean
}>()

const emit = defineEmits<{
  submitted: [submissionId: string | undefined]
  cancel: []
  'update:values': [values: Record<string, unknown>]
}>()

// Use the custom form composable
const {
  formValues,
  errors,
  isSubmitting,
  isDirty,
  lastSavedAt,
  fieldVisibility,
  fieldRequiredState,
  visibleFields,
  updateFieldValue,
  validateForm,
  submitForm,
  resetForm,
  saveDraft,
} = useCustomForm(
  toRef(() => props.formId),
  {
    versionId: toRef(() => props.versionId),
    contextType: toRef(() => props.contextType),
    contextId: toRef(() => props.contextId),
    fields: toRef(() => props.fields),
    settings: toRef(() => props.settings ?? {}),
    initialValues: toRef(() => props.initialValues ?? {}),
  },
)

// Emit values on change
watch(
  formValues,
  (values) => {
    emit('update:values', { ...values })
  },
  { deep: true },
)

// Get width class for field layout
function getWidthClass(width?: 'full' | 'half' | 'third'): string {
  switch (width) {
    case 'half':
      return 'col-span-6'
    case 'third':
      return 'col-span-4'
    default:
      return 'col-span-12'
  }
}

// Track collapsed sections
const collapsedSections = ref<Set<string>>(new Set())

// Check if a field should be shown based on section collapse
function isFieldInCollapsedSection(field: CustomFormFieldExt): boolean {
  // Find the section this field belongs to
  const fieldIndex = props.fields.findIndex((f) => f.id === field.id)
  if (fieldIndex === -1) return false

  // Look backwards for the nearest section
  for (let i = fieldIndex - 1; i >= 0; i--) {
    const prevField = props.fields[i]
    if (prevField && prevField.fieldType === 'section') {
      return collapsedSections.value.has(prevField.id)
    }
  }

  return false
}

function toggleSection(sectionId: string) {
  if (collapsedSections.value.has(sectionId)) {
    collapsedSections.value.delete(sectionId)
  } else {
    collapsedSections.value.add(sectionId)
  }
}

// Handle form submission
async function handleSubmit(asDraft = false) {
  if (props.readonly) return

  const result = await submitForm(asDraft)
  if (result.success) {
    emit('submitted', result.submissionId)
  }
}

// Handle cancel
function handleCancel() {
  emit('cancel')
}

// Format last saved time
const lastSavedText = computed(() => {
  if (!lastSavedAt.value) return null
  const now = new Date()
  const diff = now.getTime() - lastSavedAt.value.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Saved just now'
  if (minutes === 1) return 'Saved 1 minute ago'
  if (minutes < 60) return `Saved ${minutes} minutes ago`

  return `Saved at ${lastSavedAt.value.toLocaleTimeString()}`
})

// Count of visible fields (excluding sections)
const visibleFieldCount = computed(() => {
  return visibleFields.value.filter((f) => f.fieldType !== 'section').length
})

const totalFieldCount = computed(() => {
  return props.fields.filter((f) => f.fieldType !== 'section').length
})
</script>

<template>
  <div class="custom-form-renderer">
    <!-- Form header with status -->
    <div v-if="!readonly" class="flex items-center justify-between mb-4 pb-4 border-b border-default">
      <div class="flex items-center gap-2">
        <UBadge v-if="isDirty" color="warning" variant="subtle" size="xs">
          Unsaved changes
        </UBadge>
        <span v-if="lastSavedText" class="text-xs text-muted">
          {{ lastSavedText }}
        </span>
      </div>
      <div class="text-xs text-muted">
        {{ visibleFieldCount }} of {{ totalFieldCount }} fields visible
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="fields.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-form-input" class="w-12 h-12 mx-auto mb-4 text-muted" />
      <p class="text-muted">This form has no fields</p>
    </div>

    <!-- Form fields grid -->
    <div v-else class="grid grid-cols-12 gap-4">
      <template v-for="(field, index) in fields" :key="field.id">
        <!-- Field wrapper -->
        <div
          v-show="fieldVisibility[field.id] && !isFieldInCollapsedSection(field)"
          :class="[
            getWidthClass(field.width),
            'transition-all duration-200',
          ]"
        >
          <!-- Section header -->
          <SectionField
            v-if="field.fieldType === 'section'"
            :field="field"
            :is-first="index === 0 || !fields.slice(0, index).some(f => fieldVisibility[f.id])"
            @click="toggleSection(field.id)"
          />

          <!-- Text, Email, Phone, URL fields -->
          <TextField
            v-else-if="['text', 'email', 'phone', 'url'].includes(field.fieldType)"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Number field -->
          <NumberField
            v-else-if="field.fieldType === 'number'"
            :field="field as never"
            :model-value="formValues[field.id] as number"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Textarea field -->
          <TextareaField
            v-else-if="field.fieldType === 'textarea'"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Date, Time, DateTime fields -->
          <DateField
            v-else-if="['date', 'time', 'datetime'].includes(field.fieldType)"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Dropdown field -->
          <DropdownField
            v-else-if="field.fieldType === 'dropdown'"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Multi-select field -->
          <MultiSelectField
            v-else-if="field.fieldType === 'multi_select'"
            :field="field as never"
            :model-value="formValues[field.id] as string[]"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Checkbox field -->
          <CheckboxField
            v-else-if="field.fieldType === 'checkbox'"
            :field="field as never"
            :model-value="formValues[field.id] as boolean"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Radio field -->
          <RadioField
            v-else-if="field.fieldType === 'radio'"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Photo field -->
          <PhotoField
            v-else-if="field.fieldType === 'photo'"
            :field="field as never"
            :model-value="formValues[field.id] as never"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- File field -->
          <FileField
            v-else-if="field.fieldType === 'file'"
            :field="field as never"
            :model-value="formValues[field.id] as never"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Signature field -->
          <SignatureField
            v-else-if="field.fieldType === 'signature'"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Location field -->
          <LocationField
            v-else-if="field.fieldType === 'location'"
            :field="field as never"
            :model-value="formValues[field.id] as never"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Barcode field -->
          <BarcodeField
            v-else-if="field.fieldType === 'barcode'"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Calculated field -->
          <CalculatedField
            v-else-if="field.fieldType === 'calculated'"
            :field="field as never"
            :model-value="formValues[field.id] as never"
            :error="errors[field.id]"
          />

          <!-- Lookup field -->
          <LookupField
            v-else-if="field.fieldType === 'lookup'"
            :field="field as never"
            :model-value="formValues[field.id] as string"
            :error="errors[field.id]"
            :disabled="readonly"
            @update:model-value="updateFieldValue(field.id, $event)"
          />

          <!-- Unknown field type fallback -->
          <div v-else class="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p class="text-sm text-warning">
              Unknown field type: {{ field.fieldType }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- Hidden fields notice -->
    <div
      v-if="visibleFieldCount < totalFieldCount"
      class="mt-4 p-3 bg-muted/50 border border-default rounded-lg"
    >
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-eye-off" class="w-4 h-4" />
        <span>
          {{ totalFieldCount - visibleFieldCount }} field{{
            totalFieldCount - visibleFieldCount === 1 ? ' is' : 's are'
          }} hidden due to conditional logic
        </span>
      </div>
    </div>

    <!-- Form actions -->
    <div v-if="!readonly && fields.length > 0" class="flex items-center justify-between mt-6 pt-6 border-t border-default">
      <div class="flex gap-2">
        <UButton
          label="Cancel"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          @click="handleCancel"
        />
        <UButton
          v-if="settings?.allowDraft !== false"
          label="Save Draft"
          icon="i-lucide-save"
          color="neutral"
          variant="outline"
          :loading="isSubmitting"
          @click="handleSubmit(true)"
        />
      </div>
      <UButton
        :label="settings?.submitButtonText || 'Submit'"
        icon="i-lucide-check"
        color="primary"
        :loading="isSubmitting"
        @click="handleSubmit(false)"
      />
    </div>
  </div>
</template>

<style scoped>
.custom-form-renderer {
  @apply space-y-4;
}
</style>
