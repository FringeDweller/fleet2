<script setup lang="ts">
/**
 * SyncIndicator Component (fleet2-rwec)
 * A compact status indicator for connectivity and sync status.
 * Shows connectivity status (online/offline).
 * Shows pending changes count.
 * Shows sync status with visual indicator (dot/badge).
 * Compact design for header/navbar use.
 * Uses useNetworkStatus and useOfflineQueue composables.
 */

interface Props {
  /** Size of the indicator (default: 'sm') */
  size?: 'xs' | 'sm' | 'md'
  /** Show connectivity text label (default: false) */
  showLabel?: boolean
  /** Show pending count as badge (default: true) */
  showPendingCount?: boolean
  /** Variant: 'dot' shows status dot, 'badge' shows badge, 'full' shows both (default: 'dot') */
  variant?: 'dot' | 'badge' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  showLabel: false,
  showPendingCount: true,
  variant: 'dot',
})

const networkStatus = useNetworkStatus()
const offlineQueue = useOfflineQueue()

const { isOnline, connectionType, isSlowConnection } = networkStatus
const { queueCount, syncInProgress } = offlineQueue

// Compute overall status
type OverallStatus = 'online' | 'offline' | 'syncing' | 'pending' | 'slow'

const status = computed<OverallStatus>(() => {
  if (!isOnline.value) return 'offline'
  if (syncInProgress.value) return 'syncing'
  if (queueCount.value > 0) return 'pending'
  if (isSlowConnection.value) return 'slow'
  return 'online'
})

// Compute status dot color
const dotColor = computed(() => {
  switch (status.value) {
    case 'offline':
      return 'bg-neutral-400 dark:bg-neutral-500'
    case 'syncing':
      return 'bg-info-500'
    case 'pending':
      return 'bg-warning-500'
    case 'slow':
      return 'bg-warning-400'
    default:
      return 'bg-success-500'
  }
})

// Compute size classes for the dot
const dotSizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'h-1.5 w-1.5'
    case 'md':
      return 'h-3 w-3'
    default:
      return 'h-2 w-2'
  }
})

// Compute badge color
const badgeColor = computed(() => {
  switch (status.value) {
    case 'offline':
      return 'neutral'
    case 'syncing':
      return 'info'
    case 'pending':
      return 'warning'
    case 'slow':
      return 'warning'
    default:
      return 'success'
  }
})

// Compute icon for badge variant
const statusIcon = computed(() => {
  switch (status.value) {
    case 'offline':
      return 'i-lucide-wifi-off'
    case 'syncing':
      return 'i-lucide-loader-2'
    case 'pending':
      return 'i-lucide-cloud-upload'
    case 'slow':
      return 'i-lucide-signal-low'
    default:
      return 'i-lucide-wifi'
  }
})

// Compute status label
const statusLabel = computed(() => {
  switch (status.value) {
    case 'offline':
      return 'Offline'
    case 'syncing':
      return 'Syncing'
    case 'pending':
      return `${queueCount.value} pending`
    case 'slow':
      return 'Slow connection'
    default:
      return 'Online'
  }
})

// Compute aria-label for accessibility
const ariaLabel = computed(() => {
  const connText = isOnline.value ? 'Online' : 'Offline'
  const pendingText =
    queueCount.value > 0
      ? `, ${queueCount.value} pending change${queueCount.value !== 1 ? 's' : ''}`
      : ''
  const syncText = syncInProgress.value ? ', syncing' : ''
  const slowText = isSlowConnection.value && isOnline.value ? ', slow connection' : ''

  return `${connText}${pendingText}${syncText}${slowText}`
})

// Compute tooltip text
const tooltipText = computed(() => {
  const parts: string[] = []

  if (isOnline.value) {
    parts.push(connectionType.value ? `Connected (${connectionType.value})` : 'Connected')
  } else {
    parts.push('Offline')
  }

  if (queueCount.value > 0) {
    parts.push(`${queueCount.value} change${queueCount.value !== 1 ? 's' : ''} pending`)
  }

  if (syncInProgress.value) {
    parts.push('Syncing...')
  }

  if (isSlowConnection.value && isOnline.value) {
    parts.push('Slow connection detected')
  }

  return parts.join(' - ')
})
</script>

<template>
  <UTooltip
    :text="tooltipText"
    :popper="{ placement: 'bottom' }"
  >
    <div
      class="inline-flex items-center gap-1.5"
      role="status"
      :aria-label="ariaLabel"
    >
      <!-- Dot variant -->
      <template v-if="variant === 'dot' || variant === 'full'">
        <span class="relative flex items-center justify-center">
          <!-- Main dot -->
          <span
            class="rounded-full transition-colors duration-200"
            :class="[dotSizeClasses, dotColor]"
          />

          <!-- Pulse animation when syncing -->
          <span
            v-if="syncInProgress"
            class="absolute rounded-full animate-ping opacity-75"
            :class="[dotSizeClasses, dotColor]"
          />

          <!-- Pending count mini badge -->
          <span
            v-if="showPendingCount && queueCount > 0 && !syncInProgress && variant === 'dot'"
            class="absolute -right-2 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-warning-500 px-0.5 text-[10px] font-medium text-white"
          >
            {{ queueCount > 9 ? '9+' : queueCount }}
          </span>
        </span>
      </template>

      <!-- Badge variant -->
      <template v-if="variant === 'badge' || variant === 'full'">
        <UBadge
          :color="badgeColor"
          :size="size"
          :ui="{ base: 'inline-flex items-center gap-1' }"
        >
          <UIcon
            :name="statusIcon"
            :class="[
              syncInProgress ? 'animate-spin' : '',
              size === 'xs' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5',
            ]"
          />

          <!-- Optional label -->
          <span v-if="showLabel">
            {{ statusLabel }}
          </span>

          <!-- Pending count in badge -->
          <span
            v-else-if="showPendingCount && queueCount > 0"
            class="font-medium"
          >
            {{ queueCount > 99 ? '99+' : queueCount }}
          </span>
        </UBadge>
      </template>

      <!-- Label only (when not using badge) -->
      <span
        v-if="showLabel && variant === 'dot'"
        class="text-xs text-muted"
      >
        {{ statusLabel }}
      </span>
    </div>
  </UTooltip>
</template>
