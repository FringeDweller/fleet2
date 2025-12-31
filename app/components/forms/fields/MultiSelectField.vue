<script setup lang="ts">
/**
 * Multi-select field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'multi_select'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    options?: Array<{ label: string; value: string; color?: string }>
  }
  modelValue: string[] | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const items = computed(() => {
  return (
    props.field.options?.map((opt) => ({
      label: opt.label,
      value: opt.value,
    })) || []
  )
})

const selectedItems = computed({
  get: () => props.modelValue ?? [],
  set: (val) => emit('update:modelValue', val),
})

function toggleItem(value: string) {
  const current = selectedItems.value
  if (current.includes(value)) {
    emit(
      'update:modelValue',
      current.filter((v) => v !== value),
    )
  } else {
    emit('update:modelValue', [...current, value])
  }
}
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <div
      class="border border-default rounded-md p-3 space-y-2"
      :class="{ 'border-error': error, 'opacity-50': disabled }"
    >
      <div v-if="items.length === 0" class="text-sm text-muted">
        No options available
      </div>
      <div
        v-for="item in items"
        :key="item.value"
        class="flex items-center gap-2"
      >
        <UCheckbox
          :id="`${field.id}-${item.value}`"
          :model-value="selectedItems.includes(item.value)"
          :disabled="disabled"
          :label="item.label"
          @update:model-value="toggleItem(item.value)"
        />
      </div>
    </div>
    <p v-if="selectedItems.length > 0" class="text-xs text-muted mt-1">
      {{ selectedItems.length }} selected
    </p>
  </UFormField>
</template>
