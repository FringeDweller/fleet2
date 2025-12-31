/**
 * US-18.1.2 & US-18.1.4: Frontend Performance Monitoring
 *
 * Provides utilities for:
 * - Page load performance tracking
 * - Component render timing
 * - Memory usage monitoring
 * - Resource cleanup tracking
 */

import { onMounted, onUnmounted, type Ref, ref } from 'vue'

// Performance thresholds
const THRESHOLDS = {
  PAGE_LOAD_MS: 2000, // US-18.1.2: Target page load time
  COMPONENT_RENDER_MS: 100, // Component render warning threshold
  MEMORY_WARNING_MB: 100, // Memory usage warning threshold
}

// Types
interface PerformanceMetrics {
  pageLoadTime: number | null
  domContentLoaded: number | null
  firstContentfulPaint: number | null
  largestContentfulPaint: number | null
  timeToInteractive: number | null
}

interface MemoryMetrics {
  usedJSHeapSize: number | null
  totalJSHeapSize: number | null
  jsHeapSizeLimit: number | null
}

/**
 * Get page load performance metrics
 */
export function getPageLoadMetrics(): PerformanceMetrics {
  if (typeof window === 'undefined' || !window.performance) {
    return {
      pageLoadTime: null,
      domContentLoaded: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      timeToInteractive: null,
    }
  }

  const timing = performance.timing || {}
  const navigationStart = timing.navigationStart || 0

  // Get paint timings
  let firstContentfulPaint: number | null = null
  let largestContentfulPaint: number | null = null

  const paintEntries = performance.getEntriesByType?.('paint') || []
  for (const entry of paintEntries) {
    if (entry.name === 'first-contentful-paint') {
      firstContentfulPaint = Math.round(entry.startTime)
    }
  }

  // Try to get LCP from PerformanceObserver entries
  const lcpEntries = performance.getEntriesByType?.('largest-contentful-paint') || []
  if (lcpEntries.length > 0) {
    const lastLcp = lcpEntries[lcpEntries.length - 1] as PerformanceEntry & { startTime: number }
    largestContentfulPaint = Math.round(lastLcp.startTime)
  }

  return {
    pageLoadTime: timing.loadEventEnd ? Math.round(timing.loadEventEnd - navigationStart) : null,
    domContentLoaded: timing.domContentLoadedEventEnd
      ? Math.round(timing.domContentLoadedEventEnd - navigationStart)
      : null,
    firstContentfulPaint,
    largestContentfulPaint,
    timeToInteractive: timing.domInteractive
      ? Math.round(timing.domInteractive - navigationStart)
      : null,
  }
}

/**
 * Get memory usage metrics (Chrome only)
 */
export function getMemoryMetrics(): MemoryMetrics {
  if (typeof window === 'undefined') {
    return {
      usedJSHeapSize: null,
      totalJSHeapSize: null,
      jsHeapSizeLimit: null,
    }
  }

  // @ts-expect-error - memory is a Chrome-specific API
  const memory = performance.memory as
    | {
        usedJSHeapSize?: number
        totalJSHeapSize?: number
        jsHeapSizeLimit?: number
      }
    | undefined

  if (!memory) {
    return {
      usedJSHeapSize: null,
      totalJSHeapSize: null,
      jsHeapSizeLimit: null,
    }
  }

  return {
    usedJSHeapSize: memory.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
    totalJSHeapSize: memory.totalJSHeapSize
      ? Math.round(memory.totalJSHeapSize / 1024 / 1024)
      : null,
    jsHeapSizeLimit: memory.jsHeapSizeLimit
      ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      : null,
  }
}

/**
 * Composable for monitoring page load performance
 */
export function usePageLoadMonitor() {
  const metrics = ref<PerformanceMetrics>({
    pageLoadTime: null,
    domContentLoaded: null,
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    timeToInteractive: null,
  })

  const isSlowLoad = ref(false)

  onMounted(() => {
    // Wait for page to fully load
    if (document.readyState === 'complete') {
      collectMetrics()
    } else {
      window.addEventListener('load', collectMetrics, { once: true })
    }
  })

  function collectMetrics() {
    // Small delay to ensure all metrics are available
    setTimeout(() => {
      metrics.value = getPageLoadMetrics()

      // Check if page load was slow
      if (metrics.value.pageLoadTime && metrics.value.pageLoadTime > THRESHOLDS.PAGE_LOAD_MS) {
        isSlowLoad.value = true
        console.warn(
          `[PERF:SLOW] Page load took ${metrics.value.pageLoadTime}ms (target: ${THRESHOLDS.PAGE_LOAD_MS}ms)`,
        )
      }
    }, 100)
  }

  return {
    metrics,
    isSlowLoad,
  }
}

/**
 * Composable for component render timing
 */
export function useRenderTiming(componentName: string) {
  const renderStart = ref<number>(0)
  const renderTime = ref<number | null>(null)

  onMounted(() => {
    renderStart.value = performance.now()

    // Use requestAnimationFrame to measure after render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderTime.value = Math.round(performance.now() - renderStart.value)

        if (renderTime.value > THRESHOLDS.COMPONENT_RENDER_MS) {
          console.warn(`[PERF:SLOW] Component "${componentName}" render took ${renderTime.value}ms`)
        }
      })
    })
  })

  return {
    renderTime,
  }
}

/**
 * US-18.1.4: Memory monitoring composable
 * Tracks memory usage and warns about potential leaks
 */
export function useMemoryMonitor(
  options: { interval?: number; onHighMemory?: (metrics: MemoryMetrics) => void } = {},
) {
  const { interval = 30000, onHighMemory } = options // Check every 30 seconds

  const memoryMetrics = ref<MemoryMetrics>({
    usedJSHeapSize: null,
    totalJSHeapSize: null,
    jsHeapSizeLimit: null,
  })

  const isHighMemory = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastMemoryUsage = 0
  let consecutiveIncreases = 0

  function checkMemory() {
    memoryMetrics.value = getMemoryMetrics()

    if (memoryMetrics.value.usedJSHeapSize !== null) {
      const currentUsage = memoryMetrics.value.usedJSHeapSize

      // Check for high memory usage
      if (currentUsage > THRESHOLDS.MEMORY_WARNING_MB) {
        isHighMemory.value = true
        console.warn(`[PERF:MEMORY] High memory usage: ${currentUsage}MB`)
        onHighMemory?.(memoryMetrics.value)
      } else {
        isHighMemory.value = false
      }

      // Check for potential memory leak (consecutive increases)
      if (currentUsage > lastMemoryUsage) {
        consecutiveIncreases++
        if (consecutiveIncreases >= 5) {
          console.warn(
            `[PERF:MEMORY] Potential memory leak detected: ${consecutiveIncreases} consecutive increases`,
          )
        }
      } else {
        consecutiveIncreases = 0
      }

      lastMemoryUsage = currentUsage
    }
  }

  onMounted(() => {
    // Initial check
    checkMemory()

    // Periodic checks
    intervalId = setInterval(checkMemory, interval)
  })

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  })

  return {
    memoryMetrics,
    isHighMemory,
    checkMemory,
  }
}

/**
 * US-18.1.4: Cleanup registry for tracking resources
 * Helps prevent memory leaks by ensuring cleanup of subscriptions, timers, etc.
 */
export function useCleanupRegistry() {
  const cleanupFns: Array<() => void> = []

  /**
   * Register a cleanup function to be called on unmount
   */
  function registerCleanup(fn: () => void): void {
    cleanupFns.push(fn)
  }

  /**
   * Register a subscription with automatic cleanup
   */
  function registerSubscription<T extends { unsubscribe?: () => void; close?: () => void }>(
    subscription: T,
  ): T {
    registerCleanup(() => {
      subscription.unsubscribe?.()
      subscription.close?.()
    })
    return subscription
  }

  /**
   * Register an interval with automatic cleanup
   */
  function registerInterval(id: ReturnType<typeof setInterval>): ReturnType<typeof setInterval> {
    registerCleanup(() => clearInterval(id))
    return id
  }

  /**
   * Register a timeout with automatic cleanup
   */
  function registerTimeout(id: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
    registerCleanup(() => clearTimeout(id))
    return id
  }

  /**
   * Register an event listener with automatic cleanup
   */
  function registerEventListener<K extends keyof WindowEventMap>(
    target: Window | Document | HTMLElement,
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener as EventListener, options)
    registerCleanup(() => target.removeEventListener(type, listener as EventListener, options))
  }

  /**
   * Register an AbortController with automatic cleanup
   */
  function registerAbortController(): AbortController {
    const controller = new AbortController()
    registerCleanup(() => controller.abort())
    return controller
  }

  // Execute all cleanup functions on unmount
  onUnmounted(() => {
    for (const cleanup of cleanupFns) {
      try {
        cleanup()
      } catch (err) {
        console.error('[CLEANUP] Error during cleanup:', err)
      }
    }
    cleanupFns.length = 0
  })

  return {
    registerCleanup,
    registerSubscription,
    registerInterval,
    registerTimeout,
    registerEventListener,
    registerAbortController,
  }
}

/**
 * Utility to measure function execution time
 */
export function measureExecution<T>(name: string, fn: () => T): T {
  const start = performance.now()
  try {
    const result = fn()
    const duration = performance.now() - start
    if (duration > 50) {
      console.warn(`[PERF:SLOW] "${name}" took ${Math.round(duration)}ms`)
    }
    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[PERF:ERROR] "${name}" failed after ${Math.round(duration)}ms`)
    throw error
  }
}

/**
 * Utility to measure async function execution time
 */
export async function measureAsyncExecution<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    if (duration > 100) {
      console.warn(`[PERF:SLOW] "${name}" took ${Math.round(duration)}ms`)
    }
    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[PERF:ERROR] "${name}" failed after ${Math.round(duration)}ms`)
    throw error
  }
}
