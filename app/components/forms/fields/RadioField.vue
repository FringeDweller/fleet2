<script setup lang="ts">
/**
 * Radio field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'radio'
    label: string
    helpText?: string
    required: boolean
    options?: Array<{ label: string; value: string; color?: string }>
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <div
      class="space-y-2"
      :class="{ 'opacity-50': disabled }"
    >
      <div v-if="!field.options?.length" class="text-sm text-muted">
        No options available
      </div>
      <div
        v-for="option in field.options"
        :key="option.value"
        class="flex items-center gap-2"
      >
        <URadio
          :id="`${field.id}-${option.value}`"
          :model-value="modelValue"
          :value="option.value"
          :disabled="disabled"
          :label="option.label"
          :name="field.id"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </div>
    </div>
  </UFormField>
</template>
