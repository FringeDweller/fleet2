<script setup lang="ts">
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isPast,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'

definePageMeta({
  middleware: 'auth',
})

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'in_progress' | 'pending_parts' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate: string | null
  startedAt: string | null
  completedAt: string | null
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
  }
  assignedTo: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  } | null
}

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

interface AssetCategory {
  id: string
  name: string
}

interface Technician {
  id: string
  firstName: string
  lastName: string
}

const router = useRouter()
const toast = useToast()

// View state: 'week' or 'month'
const viewMode = ref<'week' | 'month'>('month')
const currentDate = ref(new Date())

// Filter state
const assetFilter = ref<string>('all')
const categoryFilter = ref<string>('all')
const technicianFilter = ref<string>('all')

// Fetch filter options
const { data: assets } = await useFetch<Asset[]>('/api/assets', {
  lazy: true,
  query: { limit: 1000 },
})
const { data: categories } = await useFetch<AssetCategory[]>('/api/asset-categories', {
  lazy: true,
})
const { data: technicians } = await useFetch<Technician[]>('/api/technicians', { lazy: true })

// Computed date range based on view mode
const dateRange = computed(() => {
  if (viewMode.value === 'month') {
    const monthStart = startOfMonth(currentDate.value)
    const monthEnd = endOfMonth(currentDate.value)
    // Extend to include full weeks (for calendar grid)
    const start = startOfWeek(monthStart, { weekStartsOn: 0 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return { start, end }
  }
  // Week view
  const start = startOfWeek(currentDate.value, { weekStartsOn: 0 })
  const end = endOfWeek(currentDate.value, { weekStartsOn: 0 })
  return { start, end }
})

// Computed query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {
    start: dateRange.value.start.toISOString(),
    end: dateRange.value.end.toISOString(),
  }
  if (assetFilter.value !== 'all') params.asset_id = assetFilter.value
  if (categoryFilter.value !== 'all') params.category_id = categoryFilter.value
  if (technicianFilter.value !== 'all') params.technician_id = technicianFilter.value
  return params
})

// Fetch work orders for calendar
const {
  data: workOrders,
  status,
  refresh,
} = await useFetch<WorkOrder[]>('/api/work-orders/calendar', {
  lazy: true,
  query: queryParams,
})

// Navigation functions
function goToPreviousPeriod() {
  if (viewMode.value === 'month') {
    currentDate.value = subMonths(currentDate.value, 1)
  } else {
    currentDate.value = subWeeks(currentDate.value, 1)
  }
}

function goToNextPeriod() {
  if (viewMode.value === 'month') {
    currentDate.value = addMonths(currentDate.value, 1)
  } else {
    currentDate.value = addWeeks(currentDate.value, 1)
  }
}

function goToToday() {
  currentDate.value = new Date()
}

// Generate calendar days
const calendarDays = computed(() => {
  const days: Date[] = []
  let day = dateRange.value.start
  while (day <= dateRange.value.end) {
    days.push(day)
    day = addDays(day, 1)
  }
  return days
})

// Group work orders by date
const workOrdersByDate = computed(() => {
  const map = new Map<string, WorkOrder[]>()
  for (const wo of workOrders.value || []) {
    if (!wo.dueDate) continue
    const dateKey = format(parseISO(wo.dueDate), 'yyyy-MM-dd')
    const existing = map.get(dateKey) || []
    existing.push(wo)
    map.set(dateKey, existing)
  }
  return map
})

function getWorkOrdersForDate(date: Date): WorkOrder[] {
  const dateKey = format(date, 'yyyy-MM-dd')
  return workOrdersByDate.value.get(dateKey) || []
}

// For mobile list view - days with work orders
const daysWithWorkOrders = computed(() => {
  const days: { date: string; dateObj: Date; workOrders: WorkOrder[] }[] = []
  for (const day of calendarDays.value) {
    const wos = getWorkOrdersForDate(day)
    if (wos.length > 0) {
      days.push({
        date: format(day, 'yyyy-MM-dd'),
        dateObj: day,
        workOrders: wos,
      })
    }
  }
  return days
})

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function isCurrentMonth(date: Date): boolean {
  return isSameMonth(date, currentDate.value)
}

function getStatusColor(
  status: WorkOrder['status'],
): 'neutral' | 'primary' | 'success' | 'warning' | 'error' {
  const colors = {
    draft: 'neutral',
    open: 'primary',
    in_progress: 'warning',
    pending_parts: 'warning',
    completed: 'success',
    closed: 'neutral',
  } as const
  return colors[status]
}

function getStatusLabel(status: WorkOrder['status']): string {
  const labels = {
    draft: 'Draft',
    open: 'Scheduled',
    in_progress: 'In Progress',
    pending_parts: 'Pending Parts',
    completed: 'Completed',
    closed: 'Closed',
  } as const
  return labels[status]
}

function getPriorityColor(
  priority: WorkOrder['priority'],
): 'neutral' | 'primary' | 'warning' | 'error' {
  const colors = {
    low: 'neutral',
    medium: 'primary',
    high: 'warning',
    critical: 'error',
  } as const
  return colors[priority]
}

function isOverdue(wo: WorkOrder): boolean {
  if (!wo.dueDate) return false
  if (['completed', 'closed'].includes(wo.status)) return false
  return isPast(parseISO(wo.dueDate))
}

function viewWorkOrder(id: string) {
  router.push(`/work-orders/${id}`)
}

// Filter options
const assetOptions = computed(() => {
  const options = [{ label: 'All Assets', value: 'all' }]
  if (assets.value) {
    for (const asset of assets.value) {
      const label = `${asset.assetNumber} - ${asset.make || ''} ${asset.model || ''}`.trim()
      options.push({ label, value: asset.id })
    }
  }
  return options
})

const categoryOptions = computed(() => {
  const options = [{ label: 'All Categories', value: 'all' }]
  if (categories.value) {
    for (const cat of categories.value) {
      options.push({ label: cat.name, value: cat.id })
    }
  }
  return options
})

const technicianOptions = computed(() => {
  const options = [{ label: 'All Technicians', value: 'all' }]
  if (technicians.value) {
    for (const tech of technicians.value) {
      options.push({ label: `${tech.firstName} ${tech.lastName}`, value: tech.id })
    }
  }
  return options
})

// Week days for header
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
</script>

<template>
  <UDashboardPanel id="maintenance-calendar">
    <template #header>
      <UDashboardNavbar title="Maintenance Calendar">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Work Orders"
            icon="i-lucide-list"
            color="neutral"
            variant="outline"
            class="mr-2 hidden sm:inline-flex"
            @click="router.push('/work-orders')"
          />
          <UButton
            icon="i-lucide-list"
            color="neutral"
            variant="outline"
            class="mr-2 sm:hidden"
            @click="router.push('/work-orders')"
          />
          <UButton
            label="New Work Order"
            icon="i-lucide-plus"
            color="primary"
            class="hidden sm:inline-flex"
            @click="router.push('/work-orders/new')"
          />
          <UButton
            icon="i-lucide-plus"
            color="primary"
            class="sm:hidden"
            @click="router.push('/work-orders/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters and controls -->
      <div class="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 mb-4">
        <!-- Date navigation -->
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            class="sm:size-auto"
            @click="goToPreviousPeriod"
          />
          <UButton
            label="Today"
            color="neutral"
            variant="outline"
            size="sm"
            class="sm:size-auto"
            @click="goToToday"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            class="sm:size-auto"
            @click="goToNextPeriod"
          />
          <span class="ml-2 sm:ml-4 text-base sm:text-lg font-semibold truncate">
            {{ format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM dd, yyyy') }}
          </span>
        </div>

        <!-- View toggle -->
        <div class="flex items-center gap-2">
          <UButton
            :label="viewMode === 'month' ? 'Week' : 'Month'"
            :icon="viewMode === 'month' ? 'i-lucide-calendar-days' : 'i-lucide-calendar'"
            color="neutral"
            variant="outline"
            size="sm"
            class="sm:size-auto"
            @click="viewMode = viewMode === 'month' ? 'week' : 'month'"
          />
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 mb-4">
        <USelect
          v-model="assetFilter"
          :items="assetOptions"
          placeholder="Filter by asset"
          class="w-full sm:w-auto sm:min-w-48"
        />
        <USelect
          v-model="categoryFilter"
          :items="categoryOptions"
          placeholder="Filter by category"
          class="w-full sm:w-auto sm:min-w-40"
        />
        <USelect
          v-model="technicianFilter"
          :items="technicianOptions"
          placeholder="Filter by technician"
          class="w-full sm:w-auto sm:min-w-44"
        />
        <UBadge v-if="workOrders" color="neutral" variant="subtle" class="self-start sm:self-center">
          {{ workOrders.length }} work order{{ workOrders.length !== 1 ? 's' : '' }}
        </UBadge>
      </div>

      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="animate-spin size-8 text-muted" />
      </div>

      <!-- Desktop Calendar grid (hidden on mobile) -->
      <div v-else class="hidden md:block border border-default rounded-lg overflow-hidden">
        <!-- Week day headers -->
        <div class="grid grid-cols-7 bg-elevated border-b border-default">
          <div
            v-for="day in weekDays"
            :key="day"
            class="p-2 text-center text-sm font-medium text-muted"
          >
            {{ day }}
          </div>
        </div>

        <!-- Calendar days -->
        <div class="grid grid-cols-7">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            :class="[
              'min-h-24 p-2 border-r border-b border-default',
              !isCurrentMonth(day) && viewMode === 'month' ? 'bg-muted/20' : '',
              isToday(day) ? 'bg-primary/5' : '',
              index % 7 === 6 ? '!border-r-0' : '',
              index >= calendarDays.length - 7 ? '!border-b-0' : ''
            ]"
          >
            <!-- Date number -->
            <div class="flex items-center justify-between mb-1">
              <span
                :class="[
                  'text-sm',
                  isToday(day) ? 'font-bold text-primary' : '',
                  !isCurrentMonth(day) && viewMode === 'month' ? 'text-muted' : 'text-highlighted'
                ]"
              >
                {{ format(day, 'd') }}
              </span>
            </div>

            <!-- Work orders for this day -->
            <div class="space-y-1">
              <div
                v-for="wo in getWorkOrdersForDate(day)"
                :key="wo.id"
                class="group cursor-pointer"
                @click="viewWorkOrder(wo.id)"
              >
                <div
                  :class="[
                    'px-1.5 py-1 rounded text-xs',
                    'transition-all duration-150',
                    'hover:shadow-sm',
                    isOverdue(wo) ? 'bg-error/10 border border-error/30' : '',
                    !isOverdue(wo) && wo.status === 'open' ? 'bg-primary/10 border border-primary/30' : '',
                    !isOverdue(wo) && wo.status === 'in_progress' ? 'bg-warning/10 border border-warning/30' : '',
                    !isOverdue(wo) && wo.status === 'pending_parts' ? 'bg-warning/10 border border-warning/30' : '',
                    !isOverdue(wo) && wo.status === 'completed' ? 'bg-success/10 border border-success/30' : '',
                    !isOverdue(wo) && (wo.status === 'draft' || wo.status === 'closed') ? 'bg-neutral/10 border border-neutral/30' : ''
                  ]"
                >
                  <div class="font-medium truncate">{{ wo.workOrderNumber }}</div>
                  <div class="text-muted truncate">{{ wo.title }}</div>
                  <div v-if="wo.assignedTo" class="text-muted truncate text-[10px]">
                    {{ wo.assignedTo.firstName }} {{ wo.assignedTo.lastName }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile list view (hidden on desktop) -->
      <div v-if="status !== 'pending'" class="md:hidden space-y-3">
        <div
          v-for="day in daysWithWorkOrders"
          :key="day.date"
          class="border border-default rounded-lg overflow-hidden"
        >
          <!-- Day header -->
          <div
            :class="[
              'px-3 py-2 bg-elevated border-b border-default flex items-center justify-between',
              isToday(day.dateObj) ? 'bg-primary/5' : ''
            ]"
          >
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'text-sm font-medium',
                  isToday(day.dateObj) ? 'text-primary font-bold' : 'text-highlighted'
                ]"
              >
                {{ format(day.dateObj, 'EEE, MMM d') }}
              </span>
              <span v-if="isToday(day.dateObj)" class="text-xs text-primary">(Today)</span>
            </div>
            <UBadge color="neutral" variant="subtle" size="xs">
              {{ day.workOrders.length }}
            </UBadge>
          </div>

          <!-- Work orders list -->
          <div class="divide-y divide-default">
            <div
              v-for="wo in day.workOrders"
              :key="wo.id"
              class="p-3 cursor-pointer hover:bg-muted/10 transition-colors"
              @click="viewWorkOrder(wo.id)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-sm">{{ wo.workOrderNumber }}</span>
                    <UBadge
                      :color="isOverdue(wo) ? 'error' : getStatusColor(wo.status)"
                      variant="subtle"
                      size="xs"
                    >
                      {{ isOverdue(wo) ? 'Overdue' : getStatusLabel(wo.status) }}
                    </UBadge>
                  </div>
                  <p class="text-sm text-highlighted truncate">{{ wo.title }}</p>
                  <p class="text-xs text-muted truncate mt-0.5">
                    {{ wo.asset.assetNumber }} - {{ wo.asset.make || '' }} {{ wo.asset.model || '' }}
                  </p>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <UBadge :color="getPriorityColor(wo.priority)" variant="outline" size="xs">
                    {{ wo.priority }}
                  </UBadge>
                  <span v-if="wo.assignedTo" class="text-xs text-muted">
                    {{ wo.assignedTo.firstName }} {{ wo.assignedTo.lastName[0] }}.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state for mobile -->
        <div
          v-if="daysWithWorkOrders.length === 0"
          class="text-center py-12 text-muted"
        >
          <UIcon name="i-lucide-calendar-x" class="size-12 mb-3 opacity-50" />
          <p class="text-sm">No work orders scheduled for this period</p>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-4 flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
        <div class="flex items-center gap-1.5 md:gap-2">
          <div class="w-3 h-3 md:w-4 md:h-4 rounded bg-primary/10 border border-primary/30" />
          <span class="text-muted">Open</span>
        </div>
        <div class="flex items-center gap-1.5 md:gap-2">
          <div class="w-3 h-3 md:w-4 md:h-4 rounded bg-warning/10 border border-warning/30" />
          <span class="text-muted">In Progress</span>
        </div>
        <div class="flex items-center gap-1.5 md:gap-2">
          <div class="w-3 h-3 md:w-4 md:h-4 rounded bg-success/10 border border-success/30" />
          <span class="text-muted">Completed</span>
        </div>
        <div class="flex items-center gap-1.5 md:gap-2">
          <div class="w-3 h-3 md:w-4 md:h-4 rounded bg-error/10 border border-error/30" />
          <span class="text-muted">Overdue</span>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
