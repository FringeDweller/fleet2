<script setup lang="ts">
/**
 * Checkbox field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'checkbox'
    label: string
    helpText?: string
    required: boolean
  }
  modelValue: boolean | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div class="space-y-1">
    <UCheckbox
      :id="field.id"
      :model-value="modelValue ?? false"
      :disabled="disabled"
      :label="field.label"
      :required="field.required"
      @update:model-value="emit('update:modelValue', Boolean($event))"
    />
    <p v-if="field.helpText" class="text-xs text-muted ml-6">
      {{ field.helpText }}
    </p>
    <p v-if="error" class="text-xs text-error ml-6">
      {{ error }}
    </p>
  </div>
</template>
