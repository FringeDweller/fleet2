<script setup lang="ts">
/**
 * Date, Time, and DateTime field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'date' | 'time' | 'datetime'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    dateFormat?: string
    timeFormat?: string
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputType = computed(() => {
  switch (props.field.fieldType) {
    case 'date':
      return 'date'
    case 'time':
      return 'time'
    case 'datetime':
      return 'datetime-local'
    default:
      return 'date'
  }
})

const inputIcon = computed(() => {
  switch (props.field.fieldType) {
    case 'date':
      return 'i-lucide-calendar'
    case 'time':
      return 'i-lucide-clock'
    case 'datetime':
      return 'i-lucide-calendar-clock'
    default:
      return 'i-lucide-calendar'
  }
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
      :type="inputType"
      :placeholder="field.placeholder"
      :model-value="modelValue ?? ''"
      :disabled="disabled"
      :leading-icon="inputIcon"
      :color="error ? 'error' : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
