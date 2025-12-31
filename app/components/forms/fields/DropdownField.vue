<script setup lang="ts">
/**
 * Dropdown (select) field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'dropdown'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    options?: Array<{ label: string; value: string; color?: string }>
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const items = computed(() => {
  return (
    props.field.options?.map((opt) => ({
      label: opt.label,
      value: opt.value,
    })) || []
  )
})
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <USelect
      :items="items"
      :placeholder="field.placeholder || 'Select...'"
      :model-value="modelValue"
      :disabled="disabled"
      :color="error ? 'error' : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
