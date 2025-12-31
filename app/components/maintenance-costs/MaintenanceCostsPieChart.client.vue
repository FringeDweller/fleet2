<script setup lang="ts">
import { VisDonut, VisSingleContainer, VisTooltip } from '@unovis/vue'

const props = withDefaults(
  defineProps<{
    laborCost: number
    partsCost: number
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const chartData = computed(() => [
  { label: 'Labor', value: props.laborCost, color: 'var(--ui-primary)' },
  { label: 'Parts', value: props.partsCost, color: 'var(--ui-info)' },
])

const total = computed(() => props.laborCost + props.partsCost)

const value = (d: { value: number }) => d.value
const color = (d: { color: string }) => d.color

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number): string {
  if (total.value === 0) return '0%'
  return `${((value / total.value) * 100).toFixed(1)}%`
}
</script>

<template>
  <UCard ref="cardRef">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          Labor vs Parts
        </p>
        <p class="text-2xl text-highlighted font-semibold">
          {{ loading ? '---' : formatCurrency(total) }}
        </p>
        <p class="text-xs text-muted">Total maintenance cost</p>
      </div>
    </template>

    <div v-if="loading" class="h-64 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <div v-else-if="total === 0" class="h-64 flex items-center justify-center">
      <p class="text-muted">No cost data available</p>
    </div>

    <div v-else class="flex flex-col items-center">
      <VisSingleContainer
        :data="chartData"
        :width="Math.min(width - 40, 250)"
        :height="200"
      >
        <VisDonut
          :value="value"
          :color="color"
          :arc-width="40"
          :pad-angle="0.02"
          :corner-radius="4"
        />
        <VisTooltip />
      </VisSingleContainer>

      <!-- Legend -->
      <div class="flex gap-6 mt-4">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded" style="background-color: var(--ui-primary)" />
          <div>
            <p class="text-sm font-medium">Labor</p>
            <p class="text-xs text-muted">
              {{ formatCurrency(laborCost) }} ({{ formatPercent(laborCost) }})
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded" style="background-color: var(--ui-info)" />
          <div>
            <p class="text-sm font-medium">Parts</p>
            <p class="text-xs text-muted">
              {{ formatCurrency(partsCost) }} ({{ formatPercent(partsCost) }})
            </p>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<style scoped>
.unovis-single-container {
  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
