<script setup lang="ts">
import { format, sub } from 'date-fns'
import type { Range } from '~/types'

const range = defineModel<Range>({ required: true })

const presets = [
  { label: 'Last 7 days', value: { start: sub(new Date(), { days: 7 }), end: new Date() } },
  { label: 'Last 30 days', value: { start: sub(new Date(), { days: 30 }), end: new Date() } },
  { label: 'Last 90 days', value: { start: sub(new Date(), { days: 90 }), end: new Date() } },
  { label: 'Last 6 months', value: { start: sub(new Date(), { months: 6 }), end: new Date() } },
  {
    label: 'Year to date',
    value: { start: new Date(new Date().getFullYear(), 0, 1), end: new Date() },
  },
]

const displayValue = computed(() => {
  if (!range.value.start || !range.value.end) return 'Select date range'
  return `${format(range.value.start, 'dd MMM yyyy')} - ${format(range.value.end, 'dd MMM yyyy')}`
})

function selectPreset(preset: (typeof presets)[0]) {
  range.value = preset.value
}
</script>

<template>
  <UDropdownMenu
    :items="presets.map(p => ({
      label: p.label,
      onSelect: () => selectPreset(p),
    }))"
    :content="{ align: 'start' }"
  >
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      :label="displayValue"
    />
  </UDropdownMenu>
</template>
