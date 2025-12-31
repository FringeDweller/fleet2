<script setup lang="ts">
/**
 * Vehicle Gauge Component (US-10.5)
 *
 * SVG-based circular gauge for displaying vehicle metrics.
 * Features animated needle/arc and configurable appearance.
 */

interface Props {
  /** Current value to display */
  value: number | null
  /** Minimum value */
  min: number
  /** Maximum value */
  max: number
  /** Unit of measurement */
  unit: string
  /** Label for the gauge */
  label: string
  /** Color theme (maps to Nuxt UI colors) */
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  /** Size of the gauge */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show numeric value */
  showValue?: boolean
  /** Custom format function for the value */
  formatValue?: (value: number) => string
  /** Whether this metric is loading */
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
  size: 'md',
  showValue: true,
  isLoading: false,
})

// Size configurations
const sizeConfig = {
  sm: { width: 120, strokeWidth: 8, fontSize: 18, labelSize: 10, unitSize: 10 },
  md: { width: 160, strokeWidth: 10, fontSize: 28, labelSize: 12, unitSize: 12 },
  lg: { width: 200, strokeWidth: 12, fontSize: 36, labelSize: 14, unitSize: 14 },
}

// Color mapping to CSS variables
const colorMap = {
  primary: 'var(--ui-color-primary-500)',
  success: 'var(--ui-color-success-500)',
  warning: 'var(--ui-color-warning-500)',
  error: 'var(--ui-color-error-500)',
  info: 'var(--ui-color-info-500)',
  neutral: 'var(--ui-color-neutral-400)',
}

const config = computed(() => sizeConfig[props.size])

// SVG calculations
const radius = computed(() => (config.value.width - config.value.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const center = computed(() => config.value.width / 2)

// Arc spans 270 degrees (from 135 to 405 degrees, or -135 to 135)
const arcLength = computed(() => (circumference.value * 270) / 360)
const arcOffset = computed(() => (circumference.value * 135) / 360)

// Calculate the filled portion of the arc based on value
const percentage = computed(() => {
  if (props.value === null) return 0
  const clamped = Math.max(props.min, Math.min(props.max, props.value))
  return ((clamped - props.min) / (props.max - props.min)) * 100
})

const filledLength = computed(() => (arcLength.value * percentage.value) / 100)
const emptyLength = computed(() => arcLength.value - filledLength.value)

// Format the displayed value
const displayValue = computed(() => {
  if (props.value === null) return '--'
  if (props.formatValue) return props.formatValue(props.value)
  return Math.round(props.value).toString()
})

// Calculate needle rotation (from -135 to 135 degrees)
const needleRotation = computed(() => {
  const range = 270 // Total arc degrees
  const startAngle = -135
  return startAngle + (percentage.value / 100) * range
})

// Get stroke color
const strokeColor = computed(() => colorMap[props.color])
const trackColor = 'var(--ui-color-neutral-200)'
</script>

<template>
  <div
    class="vehicle-gauge flex flex-col items-center"
    :class="{ 'opacity-50': isLoading }"
  >
    <svg
      :width="config.width"
      :height="config.width"
      :viewBox="`0 0 ${config.width} ${config.width}`"
      class="transform -rotate-90"
    >
      <!-- Background track -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="trackColor"
        :stroke-width="config.strokeWidth"
        :stroke-dasharray="`${arcLength} ${circumference - arcLength}`"
        :stroke-dashoffset="-arcOffset"
        stroke-linecap="round"
      />

      <!-- Filled arc (value indicator) -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="strokeColor"
        :stroke-width="config.strokeWidth"
        :stroke-dasharray="`${filledLength} ${circumference - filledLength}`"
        :stroke-dashoffset="-arcOffset"
        stroke-linecap="round"
        class="transition-all duration-300 ease-out"
      />

      <!-- Center content (rotated back to normal) -->
      <g :transform="`rotate(90 ${center} ${center})`">
        <!-- Value display -->
        <text
          v-if="showValue"
          :x="center"
          :y="center - 5"
          text-anchor="middle"
          dominant-baseline="middle"
          :font-size="config.fontSize"
          font-weight="600"
          class="fill-foreground"
        >
          {{ displayValue }}
        </text>

        <!-- Unit -->
        <text
          :x="center"
          :y="center + config.fontSize / 2 + 2"
          text-anchor="middle"
          dominant-baseline="middle"
          :font-size="config.unitSize"
          class="fill-muted-foreground"
        >
          {{ unit }}
        </text>
      </g>

      <!-- Tick marks -->
      <g :transform="`rotate(90 ${center} ${center})`">
        <!-- Min tick -->
        <line
          :x1="center"
          :y1="config.strokeWidth / 2 + 2"
          :x2="center"
          :y2="config.strokeWidth / 2 + 8"
          stroke="currentColor"
          stroke-width="2"
          class="text-muted-foreground"
          :transform="`rotate(-135 ${center} ${center})`"
        />
        <!-- Mid tick -->
        <line
          :x1="center"
          :y1="config.strokeWidth / 2 + 2"
          :x2="center"
          :y2="config.strokeWidth / 2 + 8"
          stroke="currentColor"
          stroke-width="2"
          class="text-muted-foreground"
          :transform="`rotate(0 ${center} ${center})`"
        />
        <!-- Max tick -->
        <line
          :x1="center"
          :y1="config.strokeWidth / 2 + 2"
          :x2="center"
          :y2="config.strokeWidth / 2 + 8"
          stroke="currentColor"
          stroke-width="2"
          class="text-muted-foreground"
          :transform="`rotate(135 ${center} ${center})`"
        />
      </g>

      <!-- Needle -->
      <g :transform="`rotate(90 ${center} ${center})`">
        <g
          :transform="`rotate(${needleRotation} ${center} ${center})`"
          class="transition-transform duration-200 ease-out"
        >
          <!-- Needle line -->
          <line
            :x1="center"
            :y1="center"
            :x2="center"
            :y2="config.strokeWidth + 12"
            :stroke="strokeColor"
            stroke-width="3"
            stroke-linecap="round"
          />
          <!-- Needle center dot -->
          <circle
            :cx="center"
            :cy="center"
            r="6"
            :fill="strokeColor"
          />
          <circle
            :cx="center"
            :cy="center"
            r="3"
            fill="var(--ui-color-neutral-100)"
          />
        </g>
      </g>
    </svg>

    <!-- Label -->
    <span
      class="mt-2 font-medium text-center"
      :class="{
        'text-xs': size === 'sm',
        'text-sm': size === 'md',
        'text-base': size === 'lg'
      }"
    >
      {{ label }}
    </span>

    <!-- Loading indicator -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-muted-foreground"
      />
    </div>
  </div>
</template>

<style scoped>
.vehicle-gauge {
  position: relative;
}
</style>
