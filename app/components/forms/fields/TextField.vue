<script setup lang="ts">
/**
 * Text, Email, Phone, URL field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'text' | 'email' | 'phone' | 'url'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    validation?: {
      minLength?: number
      maxLength?: number
      pattern?: string
      patternMessage?: string
    }
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
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    case 'url':
      return 'url'
    default:
      return 'text'
  }
})

const inputIcon = computed(() => {
  switch (props.field.fieldType) {
    case 'email':
      return 'i-lucide-mail'
    case 'phone':
      return 'i-lucide-phone'
    case 'url':
      return 'i-lucide-link'
    default:
      return undefined
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
      :maxlength="field.validation?.maxLength"
      :color="error ? 'error' : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
