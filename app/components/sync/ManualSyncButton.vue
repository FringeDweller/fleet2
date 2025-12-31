<script setup lang="ts">
/**
 * ManualSyncButton Component (fleet2-r91t)
 * A button component that shows sync status and triggers manual sync.
 * Shows sync status (idle, syncing, success, error).
 * Shows spinner/loading state during sync.
 * Displays last sync time.
 * Uses useSyncNotifications composable.
 * Uses Nuxt UI UButton component.
 */

interface Props {
  /** Button variant (default: 'outline') */
  variant?: 'solid' | 'outline' | 'soft' | 'ghost' | 'link'
  /** Button color (default: 'neutral') */
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  /** Button size (default: 'md') */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show last sync time (default: true) */
  showLastSync?: boolean
  /** Show pending count badge (default: true) */
  showPendingBadge?: boolean
  /** Show text label (default: true) */
  showLabel?: boolean
  /** Compact mode - icon only (default: false) */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'outline',
  color: 'neutral',
  size: 'md',
  showLastSync: true,
  showPendingBadge: true,
  showLabel: true,
  compact: false,
})

const {
  isSyncing,
  pendingCount,
  isOnline,
  lastSyncTime,
  lastSyncCount,
  lastFailCount,
  triggerSync,
  getTimeSinceLastSync,
} = useSyncNotifications()

// Compute sync status for visual feedback
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline' | 'pending'

const syncStatus = computed<SyncStatus>(() => {
  if (!isOnline.value) return 'offline'
  if (isSyncing.value) return 'syncing'
  if (lastFailCount.value > 0 && lastSyncCount.value === 0) return 'error'
  if (pendingCount.value > 0) return 'pending'
  if (lastSyncCount.value > 0) return 'success'
  return 'idle'
})

// Compute button icon based on status
const buttonIcon = computed(() => {
  switch (syncStatus.value) {
    case 'offline':
      return 'i-lucide-wifi-off'
    case 'syncing':
      return 'i-lucide-loader-2'
    case 'error':
      return 'i-lucide-alert-circle'
    case 'success':
      return 'i-lucide-check-circle'
    case 'pending':
      return 'i-lucide-cloud-upload'
    default:
      return 'i-lucide-refresh-cw'
  }
})

// Compute button color based on status
const buttonColor = computed(() => {
  switch (syncStatus.value) {
    case 'offline':
      return 'neutral'
    case 'syncing':
      return 'info'
    case 'error':
      return 'error'
    case 'success':
      return 'success'
    case 'pending':
      return 'warning'
    default:
      return props.color
  }
})

// Compute button label based on status
const buttonLabel = computed(() => {
  if (props.compact || !props.showLabel) return undefined

  switch (syncStatus.value) {
    case 'offline':
      return 'Offline'
    case 'syncing':
      return 'Syncing...'
    case 'error':
      return 'Retry Sync'
    case 'pending':
      return 'Sync Now'
    case 'success':
      return 'Synced'
    default:
      return 'Sync'
  }
})

// Compute aria-label for accessibility
const ariaLabel = computed(() => {
  const pendingText =
    pendingCount.value > 0
      ? `${pendingCount.value} pending change${pendingCount.value !== 1 ? 's' : ''}`
      : ''
  const lastSyncText = getTimeSinceLastSync()

  switch (syncStatus.value) {
    case 'offline':
      return `Offline. ${pendingText}`
    case 'syncing':
      return 'Syncing in progress'
    case 'error':
      return `Sync failed. ${pendingText}. Click to retry.`
    case 'pending':
      return `${pendingText} waiting to sync. Click to sync now.`
    case 'success':
      return lastSyncText ? `Last synced ${lastSyncText}` : 'All changes synced'
    default:
      return lastSyncText ? `Last synced ${lastSyncText}. Click to sync.` : 'Click to sync'
  }
})

// Compute whether button is disabled
const isDisabled = computed(() => {
  return isSyncing.value || (!isOnline.value && pendingCount.value === 0)
})

// Handle sync button click
const handleSync = async () => {
  if (isDisabled.value) return
  await triggerSync()
}

// Format last sync time display
const lastSyncDisplay = computed(() => {
  return getTimeSinceLastSync()
})
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <UButton
      :variant="variant"
      :color="buttonColor"
      :size="size"
      :icon="buttonIcon"
      :label="buttonLabel"
      :loading="isSyncing"
      :disabled="isDisabled"
      :aria-label="ariaLabel"
      :square="compact"
      :class="[
        { 'animate-spin': isSyncing && buttonIcon === 'i-lucide-loader-2' },
        'relative',
      ]"
      @click="handleSync"
    >
      <!-- Pending count badge -->
      <template v-if="showPendingBadge && pendingCount > 0 && !isSyncing">
        <span
          class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-500 px-1 text-xs font-medium text-white"
        >
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </span>
      </template>
    </UButton>

    <!-- Last sync time display -->
    <span
      v-if="showLastSync && lastSyncDisplay && !compact"
      class="text-xs text-muted"
    >
      {{ lastSyncDisplay }}
    </span>
  </div>
</template>
