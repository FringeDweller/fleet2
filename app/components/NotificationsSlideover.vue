<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'

/** Notification from API */
interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

const { isNotificationsSlideoverOpen } = useDashboard()
const router = useRouter()

const {
  data: notifications,
  refresh,
  status,
} = await useFetch<NotificationItem[]>('/api/notifications', {
  default: () => [],
})

// Computed counts
const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length)

// Get icon based on notification type
function getNotificationIcon(type: string): string {
  const iconMap: Record<string, string> = {
    work_order_assigned: 'i-lucide-user-plus',
    work_order_unassigned: 'i-lucide-user-minus',
    work_order_status_changed: 'i-lucide-refresh-cw',
    work_order_due_soon: 'i-lucide-clock',
    work_order_overdue: 'i-lucide-alert-triangle',
    work_order_approval_requested: 'i-lucide-check-circle',
    work_order_approved: 'i-lucide-check',
    work_order_rejected: 'i-lucide-x',
    defect_reported: 'i-lucide-alert-octagon',
    geofence_entry: 'i-lucide-map-pin',
    geofence_exit: 'i-lucide-map-pin-off',
    after_hours_movement: 'i-lucide-moon',
    shift_handover: 'i-lucide-arrow-right-left',
    fuel_anomaly: 'i-lucide-fuel',
    document_expiring: 'i-lucide-file-warning',
    system: 'i-lucide-settings',
  }
  return iconMap[type] || 'i-lucide-bell'
}

// Get color based on notification type
function getNotificationColor(type: string): string {
  if (type.includes('overdue') || type.includes('rejected') || type.includes('anomaly')) {
    return 'error'
  }
  if (type.includes('due_soon') || type.includes('expiring') || type.includes('after_hours')) {
    return 'warning'
  }
  if (type.includes('approved') || type.includes('assigned')) {
    return 'success'
  }
  return 'primary'
}

// Mark single notification as read
async function markAsRead(notification: NotificationItem) {
  if (notification.isRead) return

  try {
    await $fetch(`/api/notifications/${notification.id}`, {
      method: 'PUT',
      body: { isRead: true },
    })
    await refresh()
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
  }
}

// Mark all as read
async function markAllAsRead() {
  if (unreadCount.value === 0) return

  try {
    await $fetch('/api/notifications/mark-all-read', {
      method: 'POST',
    })
    await refresh()
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
  }
}

// Handle notification click
function handleNotificationClick(notification: NotificationItem) {
  markAsRead(notification)
  isNotificationsSlideoverOpen.value = false

  if (notification.link) {
    router.push(notification.link)
  }
}
</script>

<template>
  <USlideover v-model:open="isNotificationsSlideoverOpen" title="Notifications">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <span class="font-semibold">Notifications</span>
          <UBadge v-if="unreadCount > 0" color="error" variant="solid" size="xs">
            {{ unreadCount }}
          </UBadge>
        </div>
        <UButton
          v-if="unreadCount > 0"
          variant="ghost"
          color="primary"
          size="xs"
          @click="markAllAsRead"
        >
          Mark all as read
        </UButton>
      </div>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!notifications?.length"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon name="i-lucide-bell-off" class="size-12 text-muted mb-3" />
        <p class="text-sm text-muted">No notifications yet</p>
      </div>

      <!-- Notifications list -->
      <div v-else class="space-y-1 -mx-3">
        <button
          v-for="notification in notifications"
          :key="notification.id"
          type="button"
          class="w-full px-3 py-3 rounded-lg hover:bg-elevated/50 flex items-start gap-3 text-left transition-colors"
          :class="{ 'bg-primary/5': !notification.isRead }"
          @click="handleNotificationClick(notification)"
        >
          <!-- Icon with unread indicator -->
          <div class="relative shrink-0 mt-0.5">
            <div
              class="size-9 rounded-full flex items-center justify-center"
              :class="{
                'bg-error/10 text-error': getNotificationColor(notification.type) === 'error',
                'bg-warning/10 text-warning': getNotificationColor(notification.type) === 'warning',
                'bg-success/10 text-success': getNotificationColor(notification.type) === 'success',
                'bg-primary/10 text-primary': getNotificationColor(notification.type) === 'primary',
              }"
            >
              <UIcon :name="getNotificationIcon(notification.type)" class="size-4" />
            </div>
            <!-- Unread dot -->
            <span
              v-if="!notification.isRead"
              class="absolute -top-0.5 -right-0.5 size-2.5 bg-error rounded-full ring-2 ring-default"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <p
                class="text-sm font-medium truncate"
                :class="notification.isRead ? 'text-muted' : 'text-highlighted'"
              >
                {{ notification.title }}
              </p>
              <time
                :datetime="notification.createdAt"
                class="text-xs text-muted whitespace-nowrap shrink-0"
              >
                {{ formatTimeAgo(new Date(notification.createdAt)) }}
              </time>
            </div>
            <p class="text-sm text-dimmed line-clamp-2 mt-0.5">
              {{ notification.body }}
            </p>
            <!-- Link indicator -->
            <div v-if="notification.link" class="flex items-center gap-1 mt-1.5 text-xs text-primary">
              <UIcon name="i-lucide-external-link" class="size-3" />
              <span>View details</span>
            </div>
          </div>
        </button>
      </div>
    </template>
  </USlideover>
</template>
