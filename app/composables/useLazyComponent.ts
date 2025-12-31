/**
 * US-18.1.2: Lazy Loading Utilities
 *
 * Provides utilities for lazy loading components with loading states
 * and error handling to improve page load performance.
 */

import { type AsyncComponentLoader, type Component, defineAsyncComponent, h } from 'vue'

/**
 * Default loading component for async components
 */
const DefaultLoadingComponent = defineComponent({
  name: 'LazyLoadingPlaceholder',
  setup() {
    return () =>
      h(
        'div',
        {
          class: 'flex items-center justify-center p-4 text-muted',
        },
        [h('span', { class: 'animate-pulse' }, 'Loading...')],
      )
  },
})

/**
 * Default error component for async components
 */
const DefaultErrorComponent = defineComponent({
  name: 'LazyErrorPlaceholder',
  props: {
    error: {
      type: Error,
      default: null,
    },
    retry: {
      type: Function,
      default: null,
    },
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flex flex-col items-center justify-center p-4 text-error gap-2',
        },
        [
          h('span', {}, 'Failed to load component'),
          props.retry
            ? h(
                'button',
                {
                  class: 'text-sm underline',
                  onClick: props.retry,
                },
                'Retry',
              )
            : null,
        ],
      )
  },
})

/**
 * Create a lazy-loaded component with loading/error states
 */
export function createLazyComponent<T extends Component>(
  loader: AsyncComponentLoader<T>,
  options: {
    loadingComponent?: Component
    errorComponent?: Component
    delay?: number // Delay before showing loading component
    timeout?: number // Timeout before showing error
    suspensible?: boolean
  } = {},
) {
  const {
    loadingComponent = DefaultLoadingComponent,
    errorComponent = DefaultErrorComponent,
    delay = 200, // Show loading after 200ms to avoid flashing
    timeout = 30000, // 30 second timeout
    suspensible = false,
  } = options

  return defineAsyncComponent({
    loader,
    loadingComponent,
    errorComponent,
    delay,
    timeout,
    suspensible,
    onError(error, retry, fail, attempts) {
      // Log the error
      console.error(`[LAZY] Failed to load component (attempt ${attempts}):`, error)

      // Retry up to 3 times
      if (attempts < 3) {
        console.info(`[LAZY] Retrying component load...`)
        retry()
      } else {
        fail()
      }
    },
  })
}

/**
 * Lazy load a component only when it becomes visible
 */
export function useLazyWhenVisible<T extends Component>(
  loader: AsyncComponentLoader<T>,
  options: {
    rootMargin?: string
    threshold?: number
  } = {},
) {
  const { rootMargin = '100px', threshold = 0 } = options

  const isVisible = ref(false)
  const containerRef = ref<HTMLElement | null>(null)
  let observer: IntersectionObserver | null = null

  const component = computed(() => {
    if (!isVisible.value) return null
    return createLazyComponent(loader)
  })

  onMounted(() => {
    if (!containerRef.value) return

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          isVisible.value = true
          observer?.disconnect()
        }
      },
      {
        rootMargin,
        threshold,
      },
    )

    observer.observe(containerRef.value)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return {
    containerRef,
    isVisible,
    component,
  }
}

/**
 * Preload a lazy component on user interaction hint
 */
export function preloadComponent(loader: AsyncComponentLoader): Promise<void> {
  return new Promise((resolve, reject) => {
    loader()
      .then(() => resolve())
      .catch(reject)
  })
}

/**
 * Preload components on hover/focus for faster navigation
 */
export function usePreloadOnInteraction(loaders: Record<string, AsyncComponentLoader>) {
  const preloaded = new Set<string>()

  function preload(key: string) {
    if (preloaded.has(key) || !loaders[key]) return

    preloaded.add(key)
    preloadComponent(loaders[key]).catch((err) => {
      console.warn(`[PRELOAD] Failed to preload "${key}":`, err)
      preloaded.delete(key)
    })
  }

  return {
    preload,
    isPreloaded: (key: string) => preloaded.has(key),
  }
}
