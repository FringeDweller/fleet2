/**
 * Composable to fetch audit logs with filters and pagination
 *
 * Provides reactive state for fetching audit log entries from the admin API
 * with support for filtering by action, userId, entityType, and date range.
 */

export interface AuditLogUser {
  id: string
  firstName: string | null
  lastName: string | null
  name: string
  email: string | null
  avatar: { src: string | undefined }
}

export interface AuditLogEntry {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  oldValues: unknown
  newValues: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: AuditLogUser | null
}

export interface AuditLogPagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

export interface AuditLogResponse {
  data: AuditLogEntry[]
  pagination: AuditLogPagination
}

export interface AuditLogFilters {
  action?: string
  userId?: string
  entityType?: string
  startDate?: string
  endDate?: string
  sortBy?: 'createdAt' | 'action' | 'entityType'
  sortOrder?: 'asc' | 'desc'
}

export interface UseAuditLogOptions {
  /** Initial page number (default: 1) */
  page?: MaybeRef<number>
  /** Number of items per page (default: 20) */
  limit?: MaybeRef<number>
  /** Filter options */
  filters?: MaybeRef<AuditLogFilters>
  /** Whether to fetch immediately (default: true) */
  immediate?: boolean
}

/**
 * Fetch audit logs with filters and pagination
 *
 * @param options - Configuration options for the composable
 * @returns Reactive state for logs, loading, error, and pagination controls
 */
export function useAuditLog(options: UseAuditLogOptions = {}) {
  const {
    page: initialPage = 1,
    limit: initialLimit = 20,
    filters: initialFilters = {},
    immediate = true,
  } = options

  // Reactive state for pagination
  const page = ref(toValue(initialPage))
  const limit = ref(toValue(initialLimit))
  const filters = ref<AuditLogFilters>(toValue(initialFilters))

  // Build query params from reactive state
  const queryParams = computed(() => {
    const params: Record<string, string | number | undefined> = {
      page: page.value,
      limit: limit.value,
    }

    const currentFilters = filters.value
    if (currentFilters.action) {
      params.action = currentFilters.action
    }
    if (currentFilters.userId) {
      params.userId = currentFilters.userId
    }
    if (currentFilters.entityType) {
      params.entityType = currentFilters.entityType
    }
    if (currentFilters.startDate) {
      params.startDate = currentFilters.startDate
    }
    if (currentFilters.endDate) {
      params.endDate = currentFilters.endDate
    }
    if (currentFilters.sortBy) {
      params.sortBy = currentFilters.sortBy
    }
    if (currentFilters.sortOrder) {
      params.sortOrder = currentFilters.sortOrder
    }

    return params
  })

  // Fetch data from API
  const {
    data: response,
    status,
    error,
    refresh,
  } = useFetch<AuditLogResponse>('/api/admin/audit-log', {
    query: queryParams,
    lazy: !immediate,
    watch: [queryParams],
  })

  // Computed properties for easy access
  const logs = computed(() => response.value?.data || [])
  const pagination = computed(() => response.value?.pagination || null)
  const total = computed(() => pagination.value?.total || 0)
  const totalPages = computed(() => pagination.value?.totalPages || 0)
  const hasMore = computed(() => pagination.value?.hasMore || false)

  // Loading state
  const loading = computed(() => status.value === 'pending')

  /**
   * Go to a specific page
   */
  function goToPage(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages.value) {
      page.value = newPage
    }
  }

  /**
   * Go to the next page
   */
  function nextPage() {
    if (hasMore.value) {
      page.value++
    }
  }

  /**
   * Go to the previous page
   */
  function prevPage() {
    if (page.value > 1) {
      page.value--
    }
  }

  /**
   * Update the page size (limit)
   */
  function setLimit(newLimit: number) {
    if (newLimit >= 1 && newLimit <= 100) {
      limit.value = newLimit
      // Reset to first page when changing limit
      page.value = 1
    }
  }

  /**
   * Update filters and reset to first page
   */
  function setFilters(newFilters: AuditLogFilters) {
    filters.value = newFilters
    page.value = 1
  }

  /**
   * Update a single filter value
   */
  function setFilter<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    filters.value = { ...filters.value, [key]: value }
    page.value = 1
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    filters.value = {}
    page.value = 1
  }

  /**
   * Set date range filter
   */
  function setDateRange(startDate?: string, endDate?: string) {
    filters.value = {
      ...filters.value,
      startDate,
      endDate,
    }
    page.value = 1
  }

  return {
    // Data
    logs,
    pagination,
    total,
    totalPages,
    hasMore,

    // State
    loading,
    error,
    status,

    // Current values
    page: readonly(page),
    limit: readonly(limit),
    filters: readonly(filters),

    // Pagination controls
    goToPage,
    nextPage,
    prevPage,
    setLimit,

    // Filter controls
    setFilters,
    setFilter,
    clearFilters,
    setDateRange,

    // Refresh data
    refresh,
  }
}
