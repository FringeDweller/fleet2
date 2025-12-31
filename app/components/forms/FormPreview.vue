<script setup lang="ts">
import type { ConditionalLogic } from '~/composables/useConditionalLogic'
import { useConditionalLogic } from '~/composables/useConditionalLogic'

interface FormField {
  id: string
  fieldType: string
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  position: number
  options?: Array<{ label: string; value: string; color?: string }>
  width?: 'full' | 'half' | 'third'
  conditionalVisibilityAdvanced?: ConditionalLogic
  conditionalRequired?: ConditionalLogic
}

const props = defineProps<{
  fields: FormField[]
  previewMode?: boolean
}>()

// Form values for preview
const formValues = ref<Record<string, unknown>>({})

// Convert fields to the format expected by the composable
const fieldsForCondition = computed(() => {
  return props.fields.map((f) => ({
    id: f.id,
    fieldType: f.fieldType,
    label: f.label,
    options: f.options,
    conditionalVisibilityAdvanced: f.conditionalVisibilityAdvanced,
    conditionalRequired: f.conditionalRequired,
    required: f.required,
  }))
})

// Use the conditional logic composable
const { fieldVisibility, fieldRequired, visibleFields } = useConditionalLogic(
  fieldsForCondition,
  formValues,
)

// Get width class
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

// Get field type icon
function getFieldTypeIcon(fieldType: string): string {
  const icons: Record<string, string> = {
    text: 'i-lucide-type',
    textarea: 'i-lucide-align-left',
    number: 'i-lucide-hash',
    email: 'i-lucide-mail',
    phone: 'i-lucide-phone',
    date: 'i-lucide-calendar',
    time: 'i-lucide-clock',
    datetime: 'i-lucide-calendar-clock',
    dropdown: 'i-lucide-list',
    multi_select: 'i-lucide-list-checks',
    checkbox: 'i-lucide-check-square',
    radio: 'i-lucide-circle-dot',
    file: 'i-lucide-file',
    photo: 'i-lucide-camera',
    signature: 'i-lucide-pen-line',
    location: 'i-lucide-map-pin',
    barcode: 'i-lucide-scan-barcode',
    section: 'i-lucide-heading',
  }
  return icons[fieldType] || 'i-lucide-form-input'
}

// Update form value
function updateValue(fieldId: string, value: unknown) {
  formValues.value = {
    ...formValues.value,
    [fieldId]: value,
  }
}
</script>

<template>
  <div class="bg-default rounded-lg border border-default p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="font-medium">Form Preview</h3>
      <UBadge color="info" variant="subtle" size="xs">
        {{ visibleFields.length }} of {{ fields.length }} fields visible
      </UBadge>
    </div>

    <div v-if="fields.length === 0" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-form-input" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No fields to preview</p>
    </div>

    <div v-else class="grid grid-cols-12 gap-4">
      <template v-for="field in fields" :key="field.id">
        <!-- Field wrapper with visibility transition -->
        <div
          v-show="fieldVisibility[field.id]"
          :class="[
            getWidthClass(field.width),
            'transition-all duration-200',
            !fieldVisibility[field.id] && 'opacity-0 scale-95',
          ]"
        >
          <!-- Section Header -->
          <div v-if="field.fieldType === 'section'" class="py-2">
            <h4 class="text-sm font-semibold uppercase tracking-wide text-muted">
              {{ field.label }}
            </h4>
            <p v-if="field.helpText" class="text-xs text-muted mt-1">
              {{ field.helpText }}
            </p>
          </div>

          <!-- Regular field -->
          <div v-else>
            <label class="block text-sm font-medium mb-1.5">
              {{ field.label }}
              <span v-if="fieldRequired[field.id]" class="text-error">*</span>
              <UBadge
                v-if="field.conditionalRequired?.enabled && fieldRequired[field.id]"
                color="error"
                variant="subtle"
                size="xs"
                class="ml-2"
              >
                conditionally required
              </UBadge>
            </label>

            <!-- Text input -->
            <UInput
              v-if="['text', 'email', 'phone', 'url'].includes(field.fieldType)"
              :type="field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'"
              :placeholder="field.placeholder"
              :model-value="formValues[field.id] as string"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Number input -->
            <UInput
              v-else-if="field.fieldType === 'number'"
              type="number"
              :placeholder="field.placeholder"
              :model-value="formValues[field.id] as number"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Textarea -->
            <UTextarea
              v-else-if="field.fieldType === 'textarea'"
              :placeholder="field.placeholder"
              :model-value="formValues[field.id] as string"
              :rows="3"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Date -->
            <UInput
              v-else-if="field.fieldType === 'date'"
              type="date"
              :model-value="formValues[field.id] as string"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Time -->
            <UInput
              v-else-if="field.fieldType === 'time'"
              type="time"
              :model-value="formValues[field.id] as string"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- DateTime -->
            <UInput
              v-else-if="field.fieldType === 'datetime'"
              type="datetime-local"
              :model-value="formValues[field.id] as string"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Dropdown -->
            <USelect
              v-else-if="field.fieldType === 'dropdown'"
              :items="field.options?.map((o) => ({ label: o.label, value: o.value })) || []"
              :placeholder="field.placeholder || 'Select...'"
              :model-value="formValues[field.id] as string"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Multi-select -->
            <USelect
              v-else-if="field.fieldType === 'multi_select'"
              :items="field.options?.map((o) => ({ label: o.label, value: o.value })) || []"
              :placeholder="field.placeholder || 'Select multiple...'"
              :model-value="(formValues[field.id] as string) || ''"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- Radio -->
            <div v-else-if="field.fieldType === 'radio'" class="space-y-2">
              <div
                v-for="option in field.options"
                :key="option.value"
                class="flex items-center gap-2"
              >
                <input
                  :id="`${field.id}-${option.value}`"
                  type="radio"
                  :name="field.id"
                  :value="option.value"
                  :checked="formValues[field.id] === option.value"
                  class="h-4 w-4 text-primary focus:ring-primary border-default"
                  @change="updateValue(field.id, option.value)"
                />
                <label :for="`${field.id}-${option.value}`" class="text-sm">
                  {{ option.label }}
                </label>
              </div>
            </div>

            <!-- Checkbox -->
            <UCheckbox
              v-else-if="field.fieldType === 'checkbox'"
              :label="field.label"
              :model-value="formValues[field.id] as boolean"
              @update:model-value="updateValue(field.id, $event)"
            />

            <!-- File/Photo placeholder -->
            <div
              v-else-if="['file', 'photo'].includes(field.fieldType)"
              class="border-2 border-dashed border-default rounded-lg p-4 text-center"
            >
              <UIcon :name="getFieldTypeIcon(field.fieldType)" class="w-8 h-8 mx-auto mb-2 text-muted" />
              <p class="text-sm text-muted">{{ field.fieldType === 'photo' ? 'Photo upload' : 'File upload' }}</p>
            </div>

            <!-- Signature placeholder -->
            <div
              v-else-if="field.fieldType === 'signature'"
              class="border-2 border-dashed border-default rounded-lg p-6 text-center"
            >
              <UIcon name="i-lucide-pen-line" class="w-8 h-8 mx-auto mb-2 text-muted" />
              <p class="text-sm text-muted">Signature capture area</p>
            </div>

            <!-- Location placeholder -->
            <div
              v-else-if="field.fieldType === 'location'"
              class="border border-default rounded-lg p-4 flex items-center gap-2"
            >
              <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-muted" />
              <span class="text-sm text-muted">Location capture</span>
            </div>

            <!-- Barcode placeholder -->
            <div
              v-else-if="field.fieldType === 'barcode'"
              class="border border-default rounded-lg p-4 flex items-center gap-2"
            >
              <UIcon name="i-lucide-scan-barcode" class="w-5 h-5 text-muted" />
              <span class="text-sm text-muted">Barcode/QR scanner</span>
            </div>

            <!-- Help text -->
            <p v-if="field.helpText && field.fieldType !== 'section'" class="text-xs text-muted mt-1">
              {{ field.helpText }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- Hidden fields notice -->
    <div
      v-if="visibleFields.length < fields.length"
      class="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg"
    >
      <div class="flex items-center gap-2 text-sm">
        <UIcon name="i-lucide-eye-off" class="w-4 h-4 text-warning" />
        <span>
          {{ fields.length - visibleFields.length }} field{{ fields.length - visibleFields.length === 1 ? ' is' : 's are' }} hidden due to conditional logic.
          Change field values to see them.
        </span>
      </div>
    </div>
  </div>
</template>
