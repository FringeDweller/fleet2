<script setup lang="ts">
/**
 * Calculated field component for custom forms
 * Displays a computed value based on a formula
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'calculated'
    label: string
    helpText?: string
    required: boolean
    calculatedConfig?: {
      formula: string
      dependencies: string[]
    }
    unit?: string
    decimalPlaces?: number
  }
  modelValue: number | string | undefined
  error?: string
}>()

// The actual calculation is handled by the parent component (CustomFormRenderer)
// This component just displays the result

const displayValue = computed(() => {
  if (props.modelValue === undefined || props.modelValue === null) {
    return '-'
  }
  if (typeof props.modelValue === 'number') {
    const decimals = props.field.decimalPlaces ?? 2
    return props.modelValue.toFixed(decimals)
  }
  return String(props.modelValue)
})
</script>

<template>
  <UFormField
    :label="field.label"
    :help="field.helpText"
  >
    <div
      class="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-default"
    >
      <UIcon name="i-lucide-calculator" class="w-4 h-4 text-muted" />
      <span class="font-mono text-lg font-medium">
        {{ displayValue }}
      </span>
      <span v-if="field.unit" class="text-sm text-muted">
        {{ field.unit }}
      </span>
    </div>
    <p v-if="field.calculatedConfig?.formula" class="text-xs text-muted mt-1">
      Formula: <code class="bg-muted px-1 rounded">{{ field.calculatedConfig.formula }}</code>
    </p>
  </UFormField>
</template>
