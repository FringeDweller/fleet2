<script setup lang="ts">
interface ThresholdAlert {
  id: string
  name: string
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
  }
  template: {
    id: string
    name: string
  } | null
  mileage: {
    current: number
    lastTriggered: number
    interval: number
    nextTrigger: number
    progress: number
    remaining: number
  } | null
  hours: {
    current: number
    lastTriggered: number
    interval: number
    nextTrigger: number
    progress: number
    remaining: number
  } | null
  urgency: 'approaching' | 'due' | 'overdue'
}

const { data: alerts, status } = await useFetch<ThresholdAlert[]>(
  '/api/maintenance-schedules/approaching-thresholds',
  { lazy: true },
)

const urgencyConfig = {
  approaching: { color: 'warning', icon: 'i-lucide-alert-triangle', label: 'Approaching' },
  due: { color: 'error', icon: 'i-lucide-alert-circle', label: 'Due Soon' },
  overdue: { color: 'error', icon: 'i-lucide-x-circle', label: 'Overdue' },
} as const

function getAssetLabel(asset: ThresholdAlert['asset']) {
  const parts = [asset.assetNumber]
  if (asset.make) parts.push(asset.make)
  if (asset.model) parts.push(asset.model)
  return parts.join(' - ')
}
</script>

<template>
  <div v-if="status === 'pending'" class="flex items-center justify-center py-4">
    <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-muted" />
  </div>

  <div v-else-if="alerts && alerts.length > 0" class="space-y-3">
    <div
      v-for="alert in alerts"
      :key="alert.id"
      class="rounded-lg border p-4"
      :class="{
        'border-warning bg-warning/5': alert.urgency === 'approaching',
        'border-error bg-error/5': alert.urgency === 'due' || alert.urgency === 'overdue'
      }"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <UIcon
            :name="urgencyConfig[alert.urgency].icon"
            class="size-5 mt-0.5 shrink-0"
            :class="{
              'text-warning': alert.urgency === 'approaching',
              'text-error': alert.urgency === 'due' || alert.urgency === 'overdue'
            }"
          />
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ alert.name }}</span>
              <UBadge :color="urgencyConfig[alert.urgency].color" variant="subtle" size="xs">
                {{ urgencyConfig[alert.urgency].label }}
              </UBadge>
            </div>
            <p class="text-sm text-muted mt-1">
              {{ getAssetLabel(alert.asset) }}
            </p>

            <div class="mt-2 flex flex-wrap gap-4 text-sm">
              <div v-if="alert.mileage" class="flex items-center gap-2">
                <UIcon name="i-lucide-gauge" class="size-4 text-muted" />
                <span>
                  {{ alert.mileage.current.toLocaleString() }} /
                  {{ alert.mileage.nextTrigger.toLocaleString() }} km
                  <span class="text-muted">({{ alert.mileage.remaining.toLocaleString() }} remaining)</span>
                </span>
              </div>
              <div v-if="alert.hours" class="flex items-center gap-2">
                <UIcon name="i-lucide-clock" class="size-4 text-muted" />
                <span>
                  {{ alert.hours.current.toLocaleString() }} /
                  {{ alert.hours.nextTrigger.toLocaleString() }} hrs
                  <span class="text-muted">({{ alert.hours.remaining.toLocaleString() }} remaining)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <NuxtLink :to="`/settings/maintenance-schedules/${alert.id}`">
          <UButton
            icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
            size="xs"
          />
        </NuxtLink>
      </div>
    </div>
  </div>

  <div v-else class="text-center py-4 text-muted">
    <UIcon name="i-lucide-check-circle" class="size-8 mx-auto mb-2 text-success" />
    <p>No maintenance schedules approaching threshold</p>
  </div>
</template>
