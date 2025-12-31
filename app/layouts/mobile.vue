<script setup lang="ts">
import { useNetworkStatusNotifications } from '~/composables/useNetworkStatus'

const props = withDefaults(
  defineProps<{
    /** Page title shown in header */
    title?: string
    /** Show back button in header */
    showBack?: boolean
    /** Custom back route (default: router.back()) */
    backRoute?: string
    /** Enable pull-to-refresh (disabled by default) */
    pullToRefresh?: boolean
  }>(),
  {
    title: '',
    showBack: false,
    backRoute: undefined,
    pullToRefresh: false,
  },
)

const emit = defineEmits<(e: 'refresh') => void>()

const router = useRouter()

// Enable network status notifications (shows toast when online/offline changes)
useNetworkStatusNotifications()

// Pull-to-refresh state
const isRefreshing = ref(false)
const pullDistance = ref(0)
const isPulling = ref(false)
const contentRef = ref<HTMLElement | null>(null)

const PULL_THRESHOLD = 80 // Distance needed to trigger refresh
const MAX_PULL_DISTANCE = 120

// Touch tracking for pull-to-refresh
let startY = 0
let currentY = 0

function handleTouchStart(e: TouchEvent) {
  if (!props.pullToRefresh || isRefreshing.value) return

  const touch = e.touches[0]
  if (!touch) return

  // Only enable pull when scrolled to top
  const scrollElement = contentRef.value
  if (scrollElement && scrollElement.scrollTop <= 0) {
    startY = touch.clientY
    isPulling.value = true
  }
}

function handleTouchMove(e: TouchEvent) {
  if (!props.pullToRefresh || !isPulling.value || isRefreshing.value) return

  const touch = e.touches[0]
  if (!touch) return

  currentY = touch.clientY
  const distance = currentY - startY

  if (distance > 0) {
    // Apply resistance as user pulls down
    pullDistance.value = Math.min(distance * 0.5, MAX_PULL_DISTANCE)

    // Prevent default scrolling when pulling
    if (contentRef.value && contentRef.value.scrollTop <= 0) {
      e.preventDefault()
    }
  }
}

function handleTouchEnd() {
  if (!props.pullToRefresh || !isPulling.value || isRefreshing.value) return

  isPulling.value = false

  if (pullDistance.value >= PULL_THRESHOLD) {
    // Trigger refresh
    isRefreshing.value = true
    emit('refresh')

    // Auto-reset after timeout (component can reset earlier via exposed method)
    setTimeout(() => {
      isRefreshing.value = false
      pullDistance.value = 0
    }, 5000)
  } else {
    // Reset without refresh
    pullDistance.value = 0
  }
}

function handleBack() {
  if (props.backRoute) {
    router.push(props.backRoute)
  } else {
    router.back()
  }
}

// Expose method to complete refresh externally
function completeRefresh() {
  isRefreshing.value = false
  pullDistance.value = 0
}

defineExpose({ completeRefresh })
</script>

<template>
  <div class="min-h-screen bg-default flex flex-col safe-area-top safe-area-x">
    <!-- Compact mobile header -->
    <header
      class="sticky top-0 z-40 bg-default/95 backdrop-blur-sm border-b border-default"
    >
      <div class="flex items-center h-14 px-4">
        <!-- Back button -->
        <button
          v-if="showBack"
          type="button"
          class="mr-2 -ml-2 p-2 rounded-lg hover:bg-elevated/50 active:bg-elevated transition-colors"
          aria-label="Go back"
          @click="handleBack"
        >
          <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
        </button>

        <!-- Page title -->
        <h1 v-if="title" class="text-lg font-semibold text-highlighted truncate flex-1">
          {{ title }}
        </h1>

        <!-- Slot for header content when no title -->
        <div v-else class="flex-1 min-w-0">
          <slot name="header" />
        </div>

        <!-- Header right actions -->
        <div class="flex items-center gap-2 ml-auto">
          <slot name="header-right" />
        </div>
      </div>
    </header>

    <!-- Pull-to-refresh indicator -->
    <div
      v-if="pullToRefresh"
      class="flex items-center justify-center transition-all duration-200 overflow-hidden"
      :style="{ height: isRefreshing ? '48px' : `${pullDistance}px` }"
    >
      <div
        class="flex items-center gap-2 text-sm text-muted"
        :class="{ 'opacity-100': pullDistance > 0 || isRefreshing, 'opacity-0': pullDistance === 0 && !isRefreshing }"
      >
        <UIcon
          name="i-lucide-arrow-down"
          class="w-4 h-4 transition-transform duration-200"
          :class="{
            'rotate-180': pullDistance >= PULL_THRESHOLD,
            'animate-spin': isRefreshing,
          }"
          :style="{ transform: isRefreshing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 180}deg)` }"
        />
        <span>
          {{ isRefreshing ? 'Refreshing...' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh' }}
        </span>
      </div>
    </div>

    <!-- Main content area -->
    <main
      ref="contentRef"
      class="flex-1 overflow-y-auto overscroll-contain"
      :class="{ 'touch-none': isPulling && pullDistance > 0 }"
      @touchstart="handleTouchStart"
      @touchmove.passive="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <slot />
    </main>

    <!-- Bottom navigation slot -->
    <slot name="bottom-nav">
      <MobileBottomNav />
    </slot>
  </div>
</template>
