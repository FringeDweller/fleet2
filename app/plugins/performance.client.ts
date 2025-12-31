/**
 * US-18.1.2 & US-18.1.4: Performance Monitoring Plugin
 *
 * Client-side plugin that:
 * - Monitors page load performance
 * - Tracks memory usage
 * - Reports performance metrics to console in development
 */

export default defineNuxtPlugin((nuxtApp) => {
  // Only run in browser
  if (typeof window === 'undefined') return

  const isDev = process.env.NODE_ENV !== 'production'

  // Performance thresholds
  const THRESHOLDS = {
    PAGE_LOAD_MS: 2000,
    FCP_MS: 1800, // First Contentful Paint
    LCP_MS: 2500, // Largest Contentful Paint
    MEMORY_WARNING_MB: 150,
  }

  // Track page load metrics
  function observePageLoadMetrics() {
    // Use PerformanceObserver for modern metrics
    if (typeof PerformanceObserver === 'undefined') return

    // Observe Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
          startTime: number
        }
        if (lastEntry) {
          const lcpTime = Math.round(lastEntry.startTime)
          if (isDev && lcpTime > THRESHOLDS.LCP_MS) {
            console.warn(`[PERF] LCP: ${lcpTime}ms (target: ${THRESHOLDS.LCP_MS}ms)`)
          }
        }
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      // LCP not supported
    }

    // Observe First Input Delay
    try {
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries() as (PerformanceEntry & {
          processingStart: number
          startTime: number
        })[]
        for (const entry of entries) {
          const fid = Math.round(entry.processingStart - entry.startTime)
          if (isDev && fid > 100) {
            console.warn(`[PERF] FID: ${fid}ms (target: <100ms)`)
          }
        }
      })
      fidObserver.observe({ type: 'first-input', buffered: true })
    } catch {
      // FID not supported
    }

    // Observe Layout Shift
    try {
      let clsScore = 0
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries() as (PerformanceEntry & {
          hadRecentInput: boolean
          value: number
        })[]
        for (const entry of entries) {
          if (!entry.hadRecentInput) {
            clsScore += entry.value
          }
        }
        if (isDev && clsScore > 0.1) {
          console.warn(`[PERF] CLS: ${clsScore.toFixed(3)} (target: <0.1)`)
        }
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
    } catch {
      // CLS not supported
    }
  }

  // Check memory usage periodically (Chrome only)
  function monitorMemory() {
    // @ts-expect-error - memory is Chrome-specific
    const memory = performance.memory as
      | {
          usedJSHeapSize?: number
          totalJSHeapSize?: number
          jsHeapSizeLimit?: number
        }
      | undefined

    if (!memory) return

    const checkMemory = () => {
      const usedMB = Math.round((memory.usedJSHeapSize || 0) / 1024 / 1024)
      if (usedMB > THRESHOLDS.MEMORY_WARNING_MB) {
        console.warn(
          `[PERF:MEMORY] High usage: ${usedMB}MB (threshold: ${THRESHOLDS.MEMORY_WARNING_MB}MB)`,
        )
      }
    }

    // Check memory every 30 seconds
    setInterval(checkMemory, 30000)

    // Also check on visibility change (coming back to tab)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkMemory()
      }
    })
  }

  // Report metrics on page load
  function reportPageLoadMetrics() {
    // Wait for page to fully load
    window.addEventListener(
      'load',
      () => {
        // Small delay to ensure all metrics are captured
        setTimeout(() => {
          const timing = performance.timing || {}
          const navigationStart = timing.navigationStart || 0

          const pageLoadTime = timing.loadEventEnd
            ? Math.round(timing.loadEventEnd - navigationStart)
            : null

          const domContentLoaded = timing.domContentLoadedEventEnd
            ? Math.round(timing.domContentLoadedEventEnd - navigationStart)
            : null

          // Get paint timings
          const paintEntries = performance.getEntriesByType?.('paint') || []
          let fcp: number | null = null
          for (const entry of paintEntries) {
            if (entry.name === 'first-contentful-paint') {
              fcp = Math.round(entry.startTime)
            }
          }

          if (isDev) {
            console.group('[PERF] Page Load Metrics')
            console.log(`DOM Content Loaded: ${domContentLoaded}ms`)
            console.log(`Full Page Load: ${pageLoadTime}ms`)
            if (fcp) console.log(`First Contentful Paint: ${fcp}ms`)
            if (pageLoadTime && pageLoadTime > THRESHOLDS.PAGE_LOAD_MS) {
              console.warn(`Slow page load! Target: ${THRESHOLDS.PAGE_LOAD_MS}ms`)
            }
            console.groupEnd()
          }
        }, 100)
      },
      { once: true },
    )
  }

  // Track route changes
  function trackRoutePerformance() {
    const router = useRouter()
    let routeStartTime = 0

    router.beforeEach(() => {
      routeStartTime = performance.now()
    })

    router.afterEach((to) => {
      if (routeStartTime) {
        const duration = Math.round(performance.now() - routeStartTime)
        if (isDev && duration > 500) {
          console.warn(`[PERF] Route "${to.path}" took ${duration}ms`)
        }
      }
    })
  }

  // Initialize performance monitoring
  nuxtApp.hook('app:mounted', () => {
    observePageLoadMetrics()
    reportPageLoadMetrics()
    monitorMemory()
    trackRoutePerformance()
  })

  // Provide performance utilities globally
  return {
    provide: {
      performance: {
        getMemoryUsage: () => {
          // @ts-expect-error - memory is Chrome-specific
          const memory = performance.memory
          if (!memory) return null
          return {
            usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
            limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
          }
        },
        measureAsync: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
          const start = performance.now()
          const result = await fn()
          const duration = performance.now() - start
          if (isDev && duration > 100) {
            console.log(`[PERF] ${name}: ${Math.round(duration)}ms`)
          }
          return result
        },
      },
    },
  }
})
