<script setup lang="ts">
/**
 * Number field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'number'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    decimalPlaces?: number
    unit?: string
    validation?: {
      min?: number
      max?: number
    }
  }
  modelValue: number | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | undefined]
}>()

function handleInput(value: string) {
  if (value === '' || value === undefined) {
    emit('update:modelValue', undefined)
    return
  }
  const num = Number.parseFloat(value)
  if (!Number.isNaN(num)) {
    emit('update:modelValue', num)
  }
}

const displayValue = computed(() => {
  if (props.modelValue === undefined || props.modelValue === null) return ''
  return String(props.modelValue)
})
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <UInput
      type="number"
      :placeholder="field.placeholder"
      :model-value="displayValue"
      :disabled="disabled"
      :min="field.validation?.min"
      :max="field.validation?.max"
      :step="field.decimalPlaces ? Math.pow(10, -field.decimalPlaces) : 1"
      :color="error ? 'error' : undefined"
      @update:model-value="handleInput"
    >
      <template v-if="field.unit" #trailing>
        <span class="text-muted text-sm">{{ field.unit }}</span>
      </template>
    </UInput>
  </UFormField>
</template>
