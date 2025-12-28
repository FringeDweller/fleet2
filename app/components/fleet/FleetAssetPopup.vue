<script setup lang="ts">
import type { FleetPosition, MapAsset } from '~/composables/useFleetMap'

const props = defineProps<{
  asset: FleetPosition | MapAsset | null
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const { getStatusColor, formatLastUpdate } = useFleetMap()

function viewDetails() {
  if (props.asset) {
    router.push(`/assets/${props.asset.assetId}`)
  }
}

// Check if asset has full position data (FleetPosition type)
const hasPositionData = computed(() => {
  if (!props.asset) return false
  return 'mileage' in props.asset && 'operationalHours' in props.asset
})
</script>

<template>
  <div v-if="asset" class="bg-elevated border border-default rounded-lg shadow-lg w-80 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 bg-elevated/50 border-b border-default">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-truck" class="w-5 h-5 text-primary" />
          <div>
            <h3 class="font-semibold text-highlighted">
              {{ asset.assetNumber }}
            </h3>
            <p class="text-xs text-muted">
              {{ asset.assetName }}
            </p>
          </div>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="emit('close')"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="px-4 py-3 space-y-3">
      <!-- Status and Category -->
      <div class="flex items-center gap-2">
        <UBadge
          :color="getStatusColor(asset.status)"
          variant="subtle"
          class="capitalize"
        >
          {{ asset.status }}
        </UBadge>
        <UBadge v-if="asset.categoryName" color="neutral" variant="outline">
          {{ asset.categoryName }}
        </UBadge>
      </div>

      <!-- Vehicle Info -->
      <div v-if="asset.make || asset.model || asset.year" class="space-y-1">
        <p class="text-xs font-medium text-muted uppercase tracking-wide">
          Vehicle
        </p>
        <p class="text-sm text-highlighted">
          {{ [asset.year, asset.make, asset.model].filter(Boolean).join(' ') }}
        </p>
        <p v-if="asset.licensePlate" class="text-xs text-muted">
          License: {{ asset.licensePlate }}
        </p>
      </div>

      <!-- Location -->
      <div v-if="asset.locationName || asset.latitude" class="space-y-1">
        <p class="text-xs font-medium text-muted uppercase tracking-wide">
          Location
        </p>
        <p v-if="asset.locationName" class="text-sm text-highlighted flex items-center gap-1">
          <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5 flex-shrink-0" />
          {{ asset.locationName }}
        </p>
        <p v-if="asset.locationAddress" class="text-xs text-muted pl-4.5">
          {{ asset.locationAddress }}
        </p>
        <p v-if="asset.latitude && asset.longitude" class="text-xs text-muted font-mono pl-4.5">
          {{ typeof asset.latitude === 'number' ? asset.latitude.toFixed(6) : asset.latitude }},
          {{ typeof asset.longitude === 'number' ? asset.longitude.toFixed(6) : asset.longitude }}
        </p>
      </div>

      <!-- Metrics (only for FleetPosition) -->
      <div v-if="hasPositionData" class="grid grid-cols-2 gap-2">
        <div v-if="(asset as FleetPosition).mileage" class="bg-elevated/50 rounded-md px-2 py-1.5">
          <p class="text-xs text-muted">Mileage</p>
          <p class="text-sm font-medium text-highlighted">
            {{ Number((asset as FleetPosition).mileage).toLocaleString() }} km
          </p>
        </div>
        <div v-if="(asset as FleetPosition).operationalHours" class="bg-elevated/50 rounded-md px-2 py-1.5">
          <p class="text-xs text-muted">Hours</p>
          <p class="text-sm font-medium text-highlighted">
            {{ Number((asset as FleetPosition).operationalHours).toLocaleString() }} hrs
          </p>
        </div>
      </div>

      <!-- Last Update -->
      <div v-if="asset.lastLocationUpdate" class="flex items-center gap-1 text-xs text-muted">
        <UIcon name="i-lucide-clock" class="w-3 h-3" />
        Last updated {{ formatLastUpdate(asset.lastLocationUpdate) }}
      </div>
    </div>

    <!-- Footer -->
    <div class="px-4 py-3 bg-elevated/50 border-t border-default">
      <UButton
        label="View Asset Details"
        icon="i-lucide-external-link"
        color="primary"
        variant="soft"
        size="sm"
        block
        @click="viewDetails"
      />
    </div>
  </div>
</template>
