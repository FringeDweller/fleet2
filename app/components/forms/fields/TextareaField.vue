<script setup lang="ts">
/**
 * Textarea field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'textarea'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    validation?: {
      minLength?: number
      maxLength?: number
    }
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const charCount = computed(() => (props.modelValue ?? '').length)
const maxLength = computed(() => props.field.validation?.maxLength)
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :error="error"
  >
    <UTextarea
      :placeholder="field.placeholder"
      :model-value="modelValue ?? ''"
      :disabled="disabled"
      :maxlength="maxLength"
      :rows="4"
      :color="error ? 'error' : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <template #hint>
      <div class="flex justify-between text-xs text-muted">
        <span v-if="field.helpText">{{ field.helpText }}</span>
        <span v-else />
        <span v-if="maxLength">{{ charCount }} / {{ maxLength }}</span>
      </div>
    </template>
  </UFormField>
</template>
