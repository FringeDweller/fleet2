<script setup lang="ts">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

interface TrendDataPoint {
  periodKey?: string
  period?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    data: TrendDataPoint[]
    title: string
    loading?: boolean
    valueKey: string
    formatValue?: (value: number) => string
  }>(),
  {
    loading: false,
    formatValue: (v: number) => v.toFixed(2),
  },
)

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const chartData = computed(() => {
  return props.data.map((d, index) => ({
    index,
    period: d.periodKey || d.period || '',
    value: (d[props.valueKey] as number) || 0,
  }))
})

const x = (_: { index: number }, i: number) => i
const y = (d: { value: number }) => d.value

const total = computed(() => {
  if (chartData.value.length === 0) return 0
  const sum = chartData.value.reduce((acc, d) => acc + d.value, 0)
  return sum / chartData.value.length
})

const xTicks = (i: number) => {
  if (i === 0 || i === chartData.value.length - 1 || !chartData.value[i]) {
    return ''
  }
  // Show fewer labels for readability
  const step = Math.ceil(chartData.value.length / 6)
  if (i % step !== 0) return ''
  return chartData.value[i].period
}

const template = (d: { period: string; value: number }) =>
  `${d.period}: ${props.formatValue(d.value)}`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          {{ title }}
        </p>
        <p class="text-2xl text-highlighted font-semibold">
          {{ loading ? '---' : formatValue(total) }}
        </p>
        <p class="text-xs text-muted">Average over period</p>
      </div>
    </template>

    <div v-if="loading" class="h-64 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <div v-else-if="chartData.length === 0" class="h-64 flex items-center justify-center">
      <p class="text-muted">No data available</p>
    </div>

    <VisXYContainer
      v-else
      :data="chartData"
      :padding="{ top: 40 }"
      class="h-64"
      :width="width"
    >
      <VisLine :x="x" :y="y" color="var(--ui-primary)" />
      <VisArea
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :opacity="0.1"
      />

      <VisAxis type="x" :x="x" :tick-format="xTicks" />

      <VisCrosshair color="var(--ui-primary)" :template="template" />

      <VisTooltip />
    </VisXYContainer>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
