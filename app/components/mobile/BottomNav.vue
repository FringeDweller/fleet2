<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

interface NavItem {
  label: string
  icon: string
  to: RouteLocationRaw
  /** Badge count (only shown if > 0) */
  badge?: number
  /** Match additional routes for active state */
  activeMatch?: string[]
}

const props = withDefaults(
  defineProps<{
    /** Custom navigation items (optional, uses defaults if not provided) */
    items?: NavItem[]
  }>(),
  {
    items: undefined,
  },
)

const route = useRoute()
const router = useRouter()

// Fetch unread notification count for badge
const { data: notificationData } = useFetch<{ count: number }>('/api/notifications/unread-count', {
  lazy: true,
  server: false,
  // Poll every 60 seconds to keep badge updated
  watch: false,
})

// Default navigation items
const defaultItems: NavItem[] = [
  {
    label: 'Home',
    icon: 'i-lucide-house',
    to: '/',
  },
  {
    label: 'Assets',
    icon: 'i-lucide-truck',
    to: '/assets',
    activeMatch: ['/assets'],
  },
  {
    label: 'Work Orders',
    icon: 'i-lucide-wrench',
    to: '/work-orders',
    activeMatch: ['/work-orders'],
  },
  {
    label: 'Inspections',
    icon: 'i-lucide-clipboard-check',
    to: '/inspections/history',
    activeMatch: ['/inspections'],
  },
  {
    label: 'Profile',
    icon: 'i-lucide-user',
    to: '/settings',
    activeMatch: ['/settings'],
  },
]

const navItems = computed(() => props.items || defaultItems)

// Enhanced badge data with notification count for Profile item
const itemsWithBadges = computed(() => {
  return navItems.value.map((item) => {
    // Add notification badge to Profile
    if (item.label === 'Profile' && notificationData.value?.count) {
      return { ...item, badge: notificationData.value.count }
    }
    return item
  })
})

// Check if a nav item is currently active
function isActive(item: NavItem): boolean {
  const currentPath = route.path

  // Exact match for home
  if (item.to === '/' && currentPath === '/') {
    return true
  }

  // Check primary route
  const itemPath = typeof item.to === 'string' ? item.to : (item.to as { path?: string }).path
  if (itemPath && itemPath !== '/' && currentPath.startsWith(itemPath)) {
    return true
  }

  // Check additional active matches
  if (item.activeMatch) {
    return item.activeMatch.some((match) => currentPath.startsWith(match))
  }

  return false
}

// Navigation with haptic feedback (for native apps)
function handleNavigation(item: NavItem) {
  // Trigger haptic feedback if available (Capacitor)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }

  router.push(item.to)
}

// Active item index for transition effects
const activeIndex = computed(() => {
  return itemsWithBadges.value.findIndex((item) => isActive(item))
})
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 bg-default/95 backdrop-blur-sm border-t border-default safe-area-bottom"
    role="navigation"
    aria-label="Main navigation"
  >
    <div class="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
      <button
        v-for="(item, index) in itemsWithBadges"
        :key="item.label"
        type="button"
        class="relative flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-all duration-200 group"
        :class="[
          isActive(item)
            ? 'text-primary'
            : 'text-muted hover:text-highlighted',
        ]"
        :aria-current="isActive(item) ? 'page' : undefined"
        :aria-label="item.label"
        @click="handleNavigation(item)"
      >
        <!-- Active indicator bar -->
        <div
          class="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary transition-all duration-200"
          :class="isActive(item) ? 'w-8 opacity-100' : 'w-0 opacity-0'"
        />

        <!-- Icon with badge -->
        <div class="relative">
          <UIcon
            :name="item.icon"
            class="w-6 h-6 transition-transform duration-200"
            :class="[
              isActive(item) ? 'scale-110' : 'group-active:scale-90',
            ]"
          />

          <!-- Notification badge -->
          <span
            v-if="item.badge && item.badge > 0"
            class="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-error rounded-full transition-transform duration-200"
            :class="[
              isActive(item) ? 'scale-100' : 'scale-90',
            ]"
          >
            {{ item.badge > 99 ? '99+' : item.badge }}
          </span>
        </div>

        <!-- Label -->
        <span
          class="mt-1 text-xs font-medium truncate max-w-full transition-colors duration-200"
          :class="[
            isActive(item) ? 'text-primary' : 'text-muted group-hover:text-highlighted',
          ]"
        >
          {{ item.label }}
        </span>
      </button>
    </div>

    <!-- Indicator bar for animation (positioned at active item) -->
    <div
      v-if="activeIndex >= 0"
      class="absolute bottom-0 h-0.5 bg-primary/20 transition-all duration-300 ease-out"
      :style="{
        left: `${(activeIndex / itemsWithBadges.length) * 100}%`,
        width: `${100 / itemsWithBadges.length}%`,
      }"
    />
  </nav>
</template>

<style scoped>
/* Ensure proper spacing for bottom nav on iOS Safari */
nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Touch feedback for native feel */
button:active {
  transform: scale(0.95);
}

/* Smooth background transition on touch */
button::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 12px;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease;
}

button:active::before {
  opacity: 0.1;
}
</style>
