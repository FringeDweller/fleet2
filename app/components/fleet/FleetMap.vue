<script setup lang="ts">
import type { FleetPosition } from '~/composables/useFleetMap'

const props = defineProps<{
  positions: FleetPosition[]
  selectedAssetId: string | null
  mapCenter: { lat: number; lng: number }
  mapBounds: { north: number; south: number; east: number; west: number } | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  'select-asset': [assetId: string]
  'clear-selection': []
}>()

const { getStatusColor, formatLastUpdate } = useFleetMap()

// Map container ref
const mapContainer = ref<HTMLDivElement | null>(null)

// Calculate position on the map canvas (simple projection for demo)
function getMarkerPosition(position: FleetPosition) {
  if (!props.mapBounds || !mapContainer.value) {
    return { left: '50%', top: '50%' }
  }

  const bounds = props.mapBounds
  const latRange = bounds.north - bounds.south || 0.01
  const lngRange = bounds.east - bounds.west || 0.01

  // Add padding to bounds
  const padding = 0.1
  const paddedLatRange = latRange * (1 + padding * 2)
  const paddedLngRange = lngRange * (1 + padding * 2)
  const paddedSouth = bounds.south - latRange * padding
  const paddedWest = bounds.west - lngRange * padding

  // Calculate percentage position
  const xPercent = ((position.longitude - paddedWest) / paddedLngRange) * 100
  const yPercent = ((bounds.north + latRange * padding - position.latitude) / paddedLatRange) * 100

  return {
    left: `${Math.max(2, Math.min(98, xPercent))}%`,
    top: `${Math.max(2, Math.min(98, yPercent))}%`,
  }
}

// Status colors for markers
const statusMarkerColors = {
  active: 'bg-green-500 ring-green-500/30',
  inactive: 'bg-gray-400 ring-gray-400/30',
  maintenance: 'bg-amber-500 ring-amber-500/30',
  disposed: 'bg-red-500 ring-red-500/30',
} as const

function handleMarkerClick(position: FleetPosition) {
  emit('select-asset', position.assetId)
}

function handleMapClick(e: MouseEvent) {
  // Only clear if clicking on the map background, not a marker
  if ((e.target as HTMLElement).classList.contains('fleet-map-bg')) {
    emit('clear-selection')
  }
}
</script>

<template>
  <div class="relative w-full h-full bg-elevated rounded-lg overflow-hidden border border-default">
    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-elevated/80 z-20"
    >
      <div class="flex flex-col items-center gap-2">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-sm text-muted">Loading fleet positions...</p>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="positions.length === 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center">
        <UIcon name="i-lucide-map-pin-off" class="w-16 h-16 mx-auto mb-4 text-muted opacity-50" />
        <h3 class="text-lg font-medium text-highlighted mb-2">
          No Fleet Positions Available
        </h3>
        <p class="text-muted text-sm max-w-sm mx-auto">
          Assets with GPS location data will appear on this map.
          Update asset locations to see them here.
        </p>
      </div>
    </div>

    <!-- Map container -->
    <div
      v-else
      ref="mapContainer"
      class="fleet-map-bg absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800"
      @click="handleMapClick"
    >
      <!-- Map grid overlay for visual effect -->
      <div class="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-width="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" class="text-gray-500" />
        </svg>
      </div>

      <!-- Asset markers -->
      <div
        v-for="position in positions"
        :key="position.assetId"
        class="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
        :style="getMarkerPosition(position)"
        @click.stop="handleMarkerClick(position)"
      >
        <!-- Marker dot -->
        <div
          class="relative flex items-center justify-center"
          :class="{ 'z-20': selectedAssetId === position.assetId }"
        >
          <!-- Pulse animation for active assets -->
          <span
            v-if="position.status === 'active'"
            class="absolute w-6 h-6 rounded-full animate-ping opacity-75"
            :class="statusMarkerColors[position.status]"
          />

          <!-- Main marker -->
          <div
            class="relative w-4 h-4 rounded-full ring-4 transition-all duration-200"
            :class="[
              statusMarkerColors[position.status],
              selectedAssetId === position.assetId ? 'w-6 h-6 ring-8' : 'group-hover:w-5 group-hover:h-5 group-hover:ring-6',
            ]"
          >
            <!-- Inner dot -->
            <div class="absolute inset-1 rounded-full bg-white/90" />
          </div>

          <!-- Hover tooltip -->
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-elevated border border-default rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30"
          >
            <p class="text-xs font-medium text-highlighted">
              {{ position.assetNumber }}
            </p>
            <p class="text-xs text-muted">
              {{ position.assetName }}
            </p>
          </div>
        </div>
      </div>

      <!-- Map legend -->
      <div class="absolute bottom-4 left-4 bg-elevated/95 border border-default rounded-lg p-3 shadow-lg z-10">
        <p class="text-xs font-medium text-highlighted mb-2">
          Asset Status
        </p>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-green-500" />
            <span class="text-xs text-muted">Active</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-amber-500" />
            <span class="text-xs text-muted">Maintenance</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-gray-400" />
            <span class="text-xs text-muted">Inactive</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-red-500" />
            <span class="text-xs text-muted">Disposed</span>
          </div>
        </div>
      </div>

      <!-- Map stats -->
      <div class="absolute bottom-4 right-4 bg-elevated/95 border border-default rounded-lg px-3 py-2 shadow-lg z-10">
        <div class="flex items-center gap-4">
          <div>
            <p class="text-xs text-muted">Assets on Map</p>
            <p class="text-lg font-semibold text-highlighted">
              {{ positions.length }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted">Active</p>
            <p class="text-lg font-semibold text-green-600 dark:text-green-400">
              {{ positions.filter(p => p.status === 'active').length }}
            </p>
          </div>
        </div>
      </div>

      <!-- Map controls hint -->
      <div class="absolute top-4 right-4 bg-elevated/95 border border-default rounded-lg px-3 py-2 shadow-lg z-10">
        <p class="text-xs text-muted">
          Click markers for details
        </p>
      </div>
    </div>
  </div>
</template>
