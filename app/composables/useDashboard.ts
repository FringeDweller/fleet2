import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
  const route = useRoute()
  const router = useRouter()
  const isNotificationsSlideoverOpen = ref(false)

  // Fetch unread notification count
  const { data: unreadCountData, refresh: refreshUnreadCount } = useFetch<{ count: number }>(
    '/api/notifications/unread-count',
    {
      default: () => ({ count: 0 }),
      lazy: true,
      server: false,
    },
  )

  const unreadNotificationCount = computed(() => unreadCountData.value?.count ?? 0)

  defineShortcuts({
    'g-h': () => router.push('/'),
    'g-i': () => router.push('/inbox'),
    'g-c': () => router.push('/customers'),
    'g-s': () => router.push('/settings'),
    n: () => (isNotificationsSlideoverOpen.value = !isNotificationsSlideoverOpen.value),
  })

  watch(
    () => route.fullPath,
    () => {
      isNotificationsSlideoverOpen.value = false
    },
  )

  // Refresh unread count when slideover closes (user may have read notifications)
  watch(isNotificationsSlideoverOpen, (isOpen, wasOpen) => {
    if (wasOpen && !isOpen) {
      refreshUnreadCount()
    }
  })

  return {
    isNotificationsSlideoverOpen,
    unreadNotificationCount,
    refreshUnreadCount,
  }
}

export const useDashboard = createSharedComposable(_useDashboard)
