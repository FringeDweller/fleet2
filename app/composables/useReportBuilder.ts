/**
 * Report Builder State Management Composable
 *
 * Provides state management for the custom report builder UI.
 * Tracks selected entity type, fields, filters, grouping, sorting,
 * and provides methods to build query payloads for the custom report API.
 */

// Entity types supported by the custom report API
export type ReportEntityType =
  | 'assets'
  | 'work_orders'
  | 'maintenance_schedules'
  | 'fuel_transactions'
  | 'inspections'
  | 'parts'
  | 'defects'

// Filter operators matching the API schema
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull'

// Field types for display and validation
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'uuid'

// Aggregation types
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max'

// Filter definition
export interface ReportFilter {
  id: string
  field: string
  operator: FilterOperator
  value?: string | number | boolean | string[] | number[] | null
}

// Date range configuration
export interface ReportDateRange {
  field: string
  startDate?: string
  endDate?: string
}

// Aggregation configuration
export interface ReportAggregation {
  id: string
  field: string
  type: AggregationType
  alias?: string
}

// Sorting configuration
export interface ReportSorting {
  field: string
  direction: 'asc' | 'desc'
}

// Field metadata
export interface FieldDefinition {
  key: string
  label: string
  type: FieldType
  description?: string
}

// Query payload matching the API schema
export interface CustomReportPayload {
  entityType: ReportEntityType
  fields: string[]
  filters?: Array<{
    field: string
    operator: FilterOperator
    value?: string | number | boolean | string[] | number[] | null
  }>
  dateRange?: ReportDateRange
  groupBy?: string[]
  aggregations?: Array<{
    field: string
    type: AggregationType
    alias?: string
  }>
  sorting?: ReportSorting
  page?: number
  pageSize?: number
}

// API response type
export interface CustomReportResponse {
  data: Record<string, unknown>[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  fields: Array<{
    field: string
    type: string
  }>
  entityType: ReportEntityType
}

// Available fields per entity type
const ENTITY_FIELDS: Record<ReportEntityType, FieldDefinition[]> = {
  assets: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'assetNumber', label: 'Asset Number', type: 'string' },
    { key: 'make', label: 'Make', type: 'string' },
    { key: 'model', label: 'Model', type: 'string' },
    { key: 'year', label: 'Year', type: 'number' },
    { key: 'licensePlate', label: 'License Plate', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'mileage', label: 'Mileage', type: 'number' },
    { key: 'operationalHours', label: 'Operational Hours', type: 'number' },
    { key: 'vin', label: 'VIN', type: 'string' },
    { key: 'categoryId', label: 'Category ID', type: 'uuid' },
    { key: 'isArchived', label: 'Is Archived', type: 'boolean' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
  work_orders: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'workOrderNumber', label: 'Work Order Number', type: 'string' },
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'priority', label: 'Priority', type: 'string' },
    { key: 'assetId', label: 'Asset ID', type: 'uuid' },
    { key: 'assignedToId', label: 'Assigned To ID', type: 'uuid' },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'completedAt', label: 'Completed At', type: 'date' },
    { key: 'laborCost', label: 'Labor Cost', type: 'number' },
    { key: 'partsCost', label: 'Parts Cost', type: 'number' },
    { key: 'totalCost', label: 'Total Cost', type: 'number' },
    { key: 'estimatedDuration', label: 'Estimated Duration', type: 'number' },
    { key: 'actualDuration', label: 'Actual Duration', type: 'number' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
  maintenance_schedules: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'scheduleType', label: 'Schedule Type', type: 'string' },
    { key: 'assetId', label: 'Asset ID', type: 'uuid' },
    { key: 'categoryId', label: 'Category ID', type: 'uuid' },
    { key: 'intervalType', label: 'Interval Type', type: 'string' },
    { key: 'intervalValue', label: 'Interval Value', type: 'number' },
    { key: 'intervalMileage', label: 'Interval Mileage', type: 'number' },
    { key: 'intervalHours', label: 'Interval Hours', type: 'number' },
    { key: 'nextDueDate', label: 'Next Due Date', type: 'date' },
    { key: 'lastGeneratedAt', label: 'Last Generated At', type: 'date' },
    { key: 'isActive', label: 'Is Active', type: 'boolean' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
  fuel_transactions: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'assetId', label: 'Asset ID', type: 'uuid' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unitCost', label: 'Unit Cost', type: 'number' },
    { key: 'totalCost', label: 'Total Cost', type: 'number' },
    { key: 'fuelType', label: 'Fuel Type', type: 'string' },
    { key: 'odometer', label: 'Odometer', type: 'number' },
    { key: 'engineHours', label: 'Engine Hours', type: 'number' },
    { key: 'vendor', label: 'Vendor', type: 'string' },
    { key: 'transactionDate', label: 'Transaction Date', type: 'date' },
    { key: 'hasDiscrepancy', label: 'Has Discrepancy', type: 'boolean' },
    { key: 'source', label: 'Source', type: 'string' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
  inspections: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'assetId', label: 'Asset ID', type: 'uuid' },
    { key: 'templateId', label: 'Template ID', type: 'uuid' },
    { key: 'operatorId', label: 'Operator ID', type: 'uuid' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'initiationMethod', label: 'Initiation Method', type: 'string' },
    { key: 'overallResult', label: 'Overall Result', type: 'string' },
    { key: 'startedAt', label: 'Started At', type: 'date' },
    { key: 'completedAt', label: 'Completed At', type: 'date' },
    { key: 'syncStatus', label: 'Sync Status', type: 'string' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
  parts: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'sku', label: 'SKU', type: 'string' },
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'description', label: 'Description', type: 'string' },
    { key: 'categoryId', label: 'Category ID', type: 'uuid' },
    { key: 'unit', label: 'Unit', type: 'string' },
    { key: 'quantityInStock', label: 'Quantity In Stock', type: 'number' },
    { key: 'minimumStock', label: 'Minimum Stock', type: 'number' },
    { key: 'reorderThreshold', label: 'Reorder Threshold', type: 'number' },
    { key: 'reorderQuantity', label: 'Reorder Quantity', type: 'number' },
    { key: 'unitCost', label: 'Unit Cost', type: 'number' },
    { key: 'supplier', label: 'Supplier', type: 'string' },
    { key: 'supplierPartNumber', label: 'Supplier Part Number', type: 'string' },
    { key: 'location', label: 'Location', type: 'string' },
    { key: 'onOrderQuantity', label: 'On Order Quantity', type: 'number' },
    { key: 'onOrderDate', label: 'On Order Date', type: 'date' },
    { key: 'isActive', label: 'Is Active', type: 'boolean' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
  defects: [
    { key: 'id', label: 'ID', type: 'uuid' },
    { key: 'assetId', label: 'Asset ID', type: 'uuid' },
    { key: 'inspectionId', label: 'Inspection ID', type: 'uuid' },
    { key: 'inspectionItemId', label: 'Inspection Item ID', type: 'uuid' },
    { key: 'workOrderId', label: 'Work Order ID', type: 'uuid' },
    { key: 'reportedById', label: 'Reported By ID', type: 'uuid' },
    { key: 'title', label: 'Title', type: 'string' },
    { key: 'description', label: 'Description', type: 'string' },
    { key: 'category', label: 'Category', type: 'string' },
    { key: 'severity', label: 'Severity', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'location', label: 'Location', type: 'string' },
    { key: 'resolvedById', label: 'Resolved By ID', type: 'uuid' },
    { key: 'resolvedAt', label: 'Resolved At', type: 'date' },
    { key: 'resolutionNotes', label: 'Resolution Notes', type: 'string' },
    { key: 'reportedAt', label: 'Reported At', type: 'date' },
    { key: 'updatedAt', label: 'Updated At', type: 'date' },
  ],
}

// Entity type display labels
const ENTITY_LABELS: Record<ReportEntityType, string> = {
  assets: 'Assets',
  work_orders: 'Work Orders',
  maintenance_schedules: 'Maintenance Schedules',
  fuel_transactions: 'Fuel Transactions',
  inspections: 'Inspections',
  parts: 'Parts',
  defects: 'Defects',
}

// Generate unique ID for filters and aggregations
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Report Builder Composable
 *
 * Manages state for building custom reports with fields, filters,
 * grouping, aggregations, and sorting.
 */
export function useReportBuilder() {
  // State
  const entityType = ref<ReportEntityType>('assets')
  const selectedFields = ref<string[]>([])
  const filters = ref<ReportFilter[]>([])
  const dateRange = ref<ReportDateRange | null>(null)
  const groupByFields = ref<string[]>([])
  const aggregations = ref<ReportAggregation[]>([])
  const sorting = ref<ReportSorting | null>(null)

  // Pagination state
  const page = ref(1)
  const pageSize = ref(50)

  // Loading state
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed: available fields for current entity type
  const availableFields = computed(() => {
    return ENTITY_FIELDS[entityType.value] || []
  })

  // Computed: entity type label
  const entityTypeLabel = computed(() => {
    return ENTITY_LABELS[entityType.value] || entityType.value
  })

  // Computed: selected field definitions
  const selectedFieldDefinitions = computed(() => {
    return selectedFields.value
      .map((key) => availableFields.value.find((f) => f.key === key))
      .filter((f): f is FieldDefinition => f !== undefined)
  })

  // Computed: date fields for date range picker
  const dateFields = computed(() => {
    return availableFields.value.filter((f) => f.type === 'date')
  })

  // Computed: numeric fields for aggregations
  const numericFields = computed(() => {
    return availableFields.value.filter((f) => f.type === 'number')
  })

  // Computed: whether the report has aggregations
  const hasAggregations = computed(() => {
    return aggregations.value.length > 0
  })

  // Computed: whether the report has grouping
  const hasGroupBy = computed(() => {
    return groupByFields.value.length > 0
  })

  // Computed: validation state
  const isValid = computed(() => {
    // Must have at least one field selected (unless using aggregations)
    if (!hasAggregations.value && selectedFields.value.length === 0) {
      return false
    }

    // If using aggregations without groupBy, must have at least one aggregation
    if (hasAggregations.value && aggregations.value.length === 0) {
      return false
    }

    // Validate all filters have required properties
    for (const filter of filters.value) {
      if (!filter.field || !filter.operator) {
        return false
      }
      // isNull and isNotNull don't need values
      const needsValue = !['isNull', 'isNotNull'].includes(filter.operator)
      if (needsValue && filter.value === undefined) {
        return false
      }
    }

    return true
  })

  // Change entity type (resets related state)
  function setEntityType(type: ReportEntityType) {
    entityType.value = type
    // Reset all selections when entity type changes
    selectedFields.value = []
    filters.value = []
    dateRange.value = null
    groupByFields.value = []
    aggregations.value = []
    sorting.value = null
    page.value = 1
    error.value = null
  }

  // Add a field to selection
  function addField(fieldKey: string) {
    if (!selectedFields.value.includes(fieldKey)) {
      selectedFields.value = [...selectedFields.value, fieldKey]
    }
  }

  // Remove a field from selection
  function removeField(fieldKey: string) {
    selectedFields.value = selectedFields.value.filter((f) => f !== fieldKey)

    // Also remove from groupBy if present
    if (groupByFields.value.includes(fieldKey)) {
      groupByFields.value = groupByFields.value.filter((f) => f !== fieldKey)
    }

    // Also update sorting if this field was used
    if (sorting.value?.field === fieldKey) {
      sorting.value = null
    }
  }

  // Reorder fields
  function reorderFields(fromIndex: number, toIndex: number) {
    const fields = [...selectedFields.value]
    const [removed] = fields.splice(fromIndex, 1)
    if (removed) {
      fields.splice(toIndex, 0, removed)
      selectedFields.value = fields
    }
  }

  // Clear all selected fields
  function clearFields() {
    selectedFields.value = []
    groupByFields.value = []
    sorting.value = null
  }

  // Add a filter
  function addFilter(filter?: Partial<ReportFilter>): string {
    const id = generateId()
    const newFilter: ReportFilter = {
      id,
      field: filter?.field || '',
      operator: filter?.operator || 'eq',
      value: filter?.value,
    }
    filters.value = [...filters.value, newFilter]
    return id
  }

  // Update a filter
  function updateFilter(id: string, updates: Partial<Omit<ReportFilter, 'id'>>) {
    filters.value = filters.value.map((f) => (f.id === id ? { ...f, ...updates } : f))
  }

  // Remove a filter
  function removeFilter(id: string) {
    filters.value = filters.value.filter((f) => f.id !== id)
  }

  // Clear all filters
  function clearFilters() {
    filters.value = []
    dateRange.value = null
  }

  // Set date range
  function setDateRange(range: ReportDateRange | null) {
    dateRange.value = range
  }

  // Add a field to groupBy
  function addGroupByField(fieldKey: string) {
    if (!groupByFields.value.includes(fieldKey)) {
      groupByFields.value = [...groupByFields.value, fieldKey]
    }
  }

  // Remove a field from groupBy
  function removeGroupByField(fieldKey: string) {
    groupByFields.value = groupByFields.value.filter((f) => f !== fieldKey)
  }

  // Clear all groupBy fields
  function clearGroupBy() {
    groupByFields.value = []
  }

  // Add an aggregation
  function addAggregation(aggregation?: Partial<ReportAggregation>): string {
    const id = generateId()
    const newAggregation: ReportAggregation = {
      id,
      field: aggregation?.field || '',
      type: aggregation?.type || 'count',
      alias: aggregation?.alias,
    }
    aggregations.value = [...aggregations.value, newAggregation]
    return id
  }

  // Update an aggregation
  function updateAggregation(id: string, updates: Partial<Omit<ReportAggregation, 'id'>>) {
    aggregations.value = aggregations.value.map((a) => (a.id === id ? { ...a, ...updates } : a))
  }

  // Remove an aggregation
  function removeAggregation(id: string) {
    aggregations.value = aggregations.value.filter((a) => a.id !== id)
  }

  // Clear all aggregations
  function clearAggregations() {
    aggregations.value = []
  }

  // Set sorting
  function setSorting(field: string, direction: 'asc' | 'desc') {
    sorting.value = { field, direction }
  }

  // Clear sorting
  function clearSorting() {
    sorting.value = null
  }

  // Toggle sorting (cycle through: asc -> desc -> none)
  function toggleSorting(field: string) {
    if (!sorting.value || sorting.value.field !== field) {
      sorting.value = { field, direction: 'asc' }
    } else if (sorting.value.direction === 'asc') {
      sorting.value = { field, direction: 'desc' }
    } else {
      sorting.value = null
    }
  }

  // Set pagination
  function setPage(newPage: number) {
    page.value = newPage
  }

  function setPageSize(newPageSize: number) {
    pageSize.value = newPageSize
    page.value = 1 // Reset to first page when changing page size
  }

  // Build the query payload for the API
  function buildQueryPayload(): CustomReportPayload {
    const payload: CustomReportPayload = {
      entityType: entityType.value,
      fields:
        hasAggregations.value && hasGroupBy.value ? groupByFields.value : selectedFields.value,
      page: page.value,
      pageSize: pageSize.value,
    }

    // Add filters if any
    if (filters.value.length > 0) {
      payload.filters = filters.value
        .filter((f) => f.field && f.operator)
        .map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        }))
    }

    // Add date range if set
    if (dateRange.value?.field) {
      payload.dateRange = {
        field: dateRange.value.field,
        startDate: dateRange.value.startDate,
        endDate: dateRange.value.endDate,
      }
    }

    // Add groupBy if any
    if (groupByFields.value.length > 0) {
      payload.groupBy = [...groupByFields.value]
    }

    // Add aggregations if any
    if (aggregations.value.length > 0) {
      payload.aggregations = aggregations.value
        .filter((a) => a.field && a.type)
        .map((a) => ({
          field: a.field,
          type: a.type,
          alias: a.alias,
        }))
    }

    // Add sorting if set
    if (sorting.value) {
      payload.sorting = { ...sorting.value }
    }

    return payload
  }

  // Execute the report query
  async function executeReport(): Promise<CustomReportResponse | null> {
    if (!isValid.value) {
      error.value = 'Please configure the report before running'
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const payload = buildQueryPayload()
      const response = await $fetch<CustomReportResponse>('/api/reports/custom', {
        method: 'POST',
        body: payload,
      })
      return response
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute report'
      error.value = message
      console.error('Report execution failed:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Reset all state
  function resetBuilder() {
    entityType.value = 'assets'
    selectedFields.value = []
    filters.value = []
    dateRange.value = null
    groupByFields.value = []
    aggregations.value = []
    sorting.value = null
    page.value = 1
    pageSize.value = 50
    error.value = null
  }

  // Export configuration (for saving report templates)
  function exportConfiguration() {
    return {
      entityType: entityType.value,
      fields: [...selectedFields.value],
      filters: filters.value.map((f) => ({ ...f })),
      dateRange: dateRange.value ? { ...dateRange.value } : null,
      groupBy: [...groupByFields.value],
      aggregations: aggregations.value.map((a) => ({ ...a })),
      sorting: sorting.value ? { ...sorting.value } : null,
    }
  }

  // Import configuration (for loading report templates)
  function importConfiguration(config: ReturnType<typeof exportConfiguration>) {
    if (config.entityType && ENTITY_LABELS[config.entityType]) {
      entityType.value = config.entityType
    }

    if (Array.isArray(config.fields)) {
      selectedFields.value = config.fields.filter((f) =>
        availableFields.value.some((af) => af.key === f),
      )
    }

    if (Array.isArray(config.filters)) {
      filters.value = config.filters.map((f) => ({
        id: generateId(),
        field: f.field || '',
        operator: f.operator || 'eq',
        value: f.value,
      }))
    }

    if (config.dateRange) {
      dateRange.value = { ...config.dateRange }
    }

    if (Array.isArray(config.groupBy)) {
      groupByFields.value = config.groupBy.filter((f) =>
        availableFields.value.some((af) => af.key === f),
      )
    }

    if (Array.isArray(config.aggregations)) {
      aggregations.value = config.aggregations.map((a) => ({
        id: generateId(),
        field: a.field || '',
        type: a.type || 'count',
        alias: a.alias,
      }))
    }

    if (config.sorting) {
      sorting.value = { ...config.sorting }
    }

    page.value = 1
    error.value = null
  }

  return {
    // State (readonly where appropriate)
    entityType: readonly(entityType),
    selectedFields: readonly(selectedFields),
    filters: readonly(filters),
    dateRange: readonly(dateRange),
    groupByFields: readonly(groupByFields),
    aggregations: readonly(aggregations),
    sorting: readonly(sorting),
    page: readonly(page),
    pageSize: readonly(pageSize),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Computed
    availableFields,
    entityTypeLabel,
    selectedFieldDefinitions,
    dateFields,
    numericFields,
    hasAggregations,
    hasGroupBy,
    isValid,

    // Entity type methods
    setEntityType,

    // Field methods
    addField,
    removeField,
    reorderFields,
    clearFields,

    // Filter methods
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,

    // Date range methods
    setDateRange,

    // GroupBy methods
    addGroupByField,
    removeGroupByField,
    clearGroupBy,

    // Aggregation methods
    addAggregation,
    updateAggregation,
    removeAggregation,
    clearAggregations,

    // Sorting methods
    setSorting,
    clearSorting,
    toggleSorting,

    // Pagination methods
    setPage,
    setPageSize,

    // Query methods
    buildQueryPayload,
    executeReport,

    // Reset/export/import
    resetBuilder,
    exportConfiguration,
    importConfiguration,

    // Static data
    ENTITY_FIELDS,
    ENTITY_LABELS,
  }
}
