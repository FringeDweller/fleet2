<script setup lang="ts">
import type { MapAsset } from '~/composables/useFleetMap'

const props = defineProps<{
  assets: MapAsset[]
  selectedAssetId: string | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  'select-asset': [assetId: string]
  'clear-selection': []
}>()

const { getStatusColor, getStatusIcon, formatLastUpdate } = useFleetMap()

function handleAssetClick(asset: MapAsset) {
  if (asset.hasLocation) {
    emit('select-asset', asset.assetId)
  }
}

const statusColors = {
  active: 'bg-green-500',
  inactive: 'bg-gray-400',
  maintenance: 'bg-amber-500',
  disposed: 'bg-red-500',
} as const
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Asset List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
      </div>

      <div v-else-if="assets.length === 0" class="py-8 text-center text-muted">
        <UIcon name="i-lucide-map-pin-off" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No assets found</p>
      </div>

      <ul v-else class="divide-y divide-default">
        <li
          v-for="asset in assets"
          :key="asset.assetId"
          class="px-3 py-2 transition-colors cursor-pointer hover:bg-elevated/50"
          :class="{
            'bg-primary/10 border-l-2 border-primary': selectedAssetId === asset.assetId,
            'opacity-60': !asset.hasLocation,
          }"
          @click="handleAssetClick(asset)"
        >
          <div class="flex items-start gap-2">
            <!-- Status indicator -->
            <div class="flex-shrink-0 mt-1">
              <span
                class="block w-2.5 h-2.5 rounded-full"
                :class="statusColors[asset.status]"
              />
            </div>

            <!-- Asset info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-medium text-sm text-highlighted truncate">
                  {{ asset.assetNumber }}
                </span>
                <UBadge
                  v-if="!asset.hasLocation"
                  size="xs"
                  color="neutral"
                  variant="subtle"
                >
                  No GPS
                </UBadge>
              </div>
              <p class="text-xs text-muted truncate">
                {{ asset.assetName }}
              </p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <UBadge
                  size="xs"
                  :color="getStatusColor(asset.status)"
                  variant="subtle"
                  class="capitalize"
                >
                  {{ asset.status }}
                </UBadge>
                <span v-if="asset.categoryName" class="text-xs text-muted">
                  {{ asset.categoryName }}
                </span>
              </div>
              <p v-if="asset.locationName" class="text-xs text-muted mt-0.5 truncate flex items-center gap-1">
                <UIcon name="i-lucide-map-pin" class="w-3 h-3 flex-shrink-0" />
                {{ asset.locationName }}
              </p>
              <p v-if="asset.lastLocationUpdate" class="text-xs text-muted/70 mt-0.5">
                Updated {{ formatLastUpdate(asset.lastLocationUpdate) }}
              </p>
            </div>

            <!-- Arrow for clickable items with location -->
            <div v-if="asset.hasLocation" class="flex-shrink-0 mt-2">
              <UIcon
                name="i-lucide-chevron-right"
                class="w-4 h-4 text-muted"
              />
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
