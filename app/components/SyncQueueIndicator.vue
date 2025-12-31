<script setup lang="ts">
/**
 * SyncQueueIndicator Component (US-7.3)
 * Shows pending changes count as a badge.
 * Shows sync status (syncing, error, synced).
 * Allows manual sync trigger.
 */
import { useSyncService } from '~/services/syncService'

const { syncStatus, syncProgress, queueCount, isOnline, isSyncing, triggerSync } = useSyncService()

// Determine the badge color based on status
const badgeColor = computed(() => {
  if (!isOnline.value) return 'neutral'
  if (syncStatus.value === 'syncing') return 'info'
  if (syncStatus.value === 'error') return 'error'
  if (syncStatus.value === 'synced') return 'success'
  if (queueCount.value > 0) return 'warning'
  return 'neutral'
})

// Determine the icon based on status
const statusIcon = computed(() => {
  if (!isOnline.value) return 'i-lucide-wifi-off'
  if (syncStatus.value === 'syncing') return 'i-lucide-loader-2'
  if (syncStatus.value === 'error') return 'i-lucide-alert-circle'
  if (syncStatus.value === 'synced') return 'i-lucide-check-circle'
  if (queueCount.value > 0) return 'i-lucide-cloud-upload'
  return 'i-lucide-cloud'
})

// Status label for tooltip/aria
const statusLabel = computed(() => {
  if (!isOnline.value) return 'Offline'
  if (syncStatus.value === 'syncing') {
    if (syncProgress.value) {
      return `Syncing ${syncProgress.value.completed + 1} of ${syncProgress.value.total}...`
    }
    return 'Syncing...'
  }
  if (syncStatus.value === 'error') return 'Sync failed - some items could not be synced'
  if (syncStatus.value === 'synced') return 'All changes synced'
  if (queueCount.value > 0)
    return `${queueCount.value} change${queueCount.value > 1 ? 's' : ''} pending sync`
  return 'All synced'
})

// Handle manual sync trigger
const handleSync = async () => {
  await triggerSync()
}

// Track if animation should play
const isSpinning = computed(() => syncStatus.value === 'syncing')
</script>

<template>
  <UPopover>
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      :icon="statusIcon"
      :class="[
        'relative',
        { 'animate-spin': isSpinning && statusIcon === 'i-lucide-loader-2' },
      ]"
      :aria-label="statusLabel"
    >
      <!-- Pending count badge -->
      <span
        v-if="queueCount > 0"
        class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-medium"
        :class="{
          'bg-yellow-500 text-white': badgeColor === 'warning',
          'bg-blue-500 text-white': badgeColor === 'info',
          'bg-red-500 text-white': badgeColor === 'error',
          'bg-green-500 text-white': badgeColor === 'success',
          'bg-gray-500 text-white': badgeColor === 'neutral',
        }"
      >
        {{ queueCount > 99 ? '99+' : queueCount }}
      </span>
    </UButton>

    <template #content>
      <div class="p-4 w-72">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">
            Sync Status
          </h3>
          <UBadge
            :color="isOnline ? 'success' : 'neutral'"
            size="xs"
          >
            {{ isOnline ? 'Online' : 'Offline' }}
          </UBadge>
        </div>

        <!-- Status message -->
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {{ statusLabel }}
        </p>

        <!-- Sync progress (when syncing) -->
        <div
          v-if="syncStatus === 'syncing' && syncProgress"
          class="mb-3"
        >
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>Syncing...</span>
            <span>{{ syncProgress.completed }}/{{ syncProgress.total }}</span>
          </div>
          <UProgress
            :value="(syncProgress.completed / syncProgress.total) * 100"
            color="primary"
            size="sm"
          />
          <p
            v-if="syncProgress.failed > 0"
            class="text-xs text-red-500 mt-1"
          >
            {{ syncProgress.failed }} item(s) failed
          </p>
        </div>

        <!-- Queue summary (when items pending) -->
        <div
          v-else-if="queueCount > 0"
          class="mb-3"
        >
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UIcon
              name="i-lucide-clock"
              class="w-4 h-4"
            />
            <span>{{ queueCount }} change{{ queueCount > 1 ? 's' : '' }} waiting to sync</span>
          </div>
        </div>

        <!-- All synced message -->
        <div
          v-else-if="syncStatus === 'synced' || (queueCount === 0 && isOnline)"
          class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-3"
        >
          <UIcon
            name="i-lucide-check-circle"
            class="w-4 h-4"
          />
          <span>All changes synced</span>
        </div>

        <!-- Error state -->
        <div
          v-if="syncStatus === 'error'"
          class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-3"
        >
          <UIcon
            name="i-lucide-alert-circle"
            class="w-4 h-4"
          />
          <span>Some items failed to sync</span>
        </div>

        <!-- Offline message -->
        <div
          v-if="!isOnline && queueCount > 0"
          class="text-xs text-gray-500 dark:text-gray-400 mb-3"
        >
          Changes will sync automatically when you are back online.
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <UButton
            v-if="isOnline && queueCount > 0"
            color="primary"
            size="xs"
            :loading="isSyncing"
            :disabled="isSyncing"
            icon="i-lucide-refresh-cw"
            @click="handleSync"
          >
            {{ isSyncing ? 'Syncing...' : 'Sync Now' }}
          </UButton>

          <UButton
            v-if="syncStatus === 'error' && isOnline"
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-refresh-cw"
            @click="handleSync"
          >
            Retry
          </UButton>
        </div>

        <!-- Hint text -->
        <p
          v-if="isOnline && queueCount === 0 && syncStatus !== 'syncing'"
          class="text-xs text-gray-400 dark:text-gray-500 mt-2"
        >
          Changes are synced automatically when online.
        </p>
      </div>
    </template>
  </UPopover>
</template>
