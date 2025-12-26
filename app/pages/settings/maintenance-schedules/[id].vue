<script setup lang="ts">
import { format, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth'
})

interface MaintenanceSchedule {
  id: string
  name: string
  description: string | null
  intervalType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'
  intervalValue: number
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfYear: number | null
  startDate: string
  endDate: string | null
  nextDueDate: string | null
  leadTimeDays: number
  defaultPriority: 'low' | 'medium' | 'high' | 'critical'
  isActive: boolean
  asset: { id: string, assetNumber: string, make: string | null, model: string | null } | null
  category: { id: string, name: string } | null
  template: { id: string, name: string, description: string | null } | null
  defaultAssignee: { id: string, firstName: string, lastName: string } | null
  createdAt: string
  updatedAt: string
}

interface SchedulePreview {
  occurrenceDate: string
  dueDate: string
  workOrderCreateDate: string
}

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  status: 'draft' | 'open' | 'in_progress' | 'pending_parts' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate: string | null
  createdAt: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const scheduleId = route.params.id as string
const activeTab = ref((route.query.tab as string) || 'details')

const { data: schedule, status, refresh } = await useFetch<MaintenanceSchedule>(
  `/api/maintenance-schedules/${scheduleId}`,
  { lazy: true }
)

const { data: preview } = await useFetch<SchedulePreview[]>(
  `/api/maintenance-schedules/${scheduleId}/preview`,
  { lazy: true, query: { limit: 10 } }
)

const { data: workOrders } = await useFetch<WorkOrder[]>(
  `/api/work-orders`,
  { lazy: true, query: { scheduleId } }
)

const intervalTypeLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
  custom: 'Custom'
} as const

const dayOfWeekLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const monthLabels = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const priorityColors = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error'
} as const

const statusColors = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral'
} as const

const statusLabels = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  closed: 'Closed'
} as const

function getIntervalDescription(sched: MaintenanceSchedule): string {
  if (sched.intervalType === 'custom') {
    return `Every ${sched.intervalValue} day(s)`
  }
  if (sched.intervalType === 'daily') {
    return 'Every day'
  }
  if (sched.intervalType === 'weekly' && sched.dayOfWeek !== null) {
    return `Every ${dayOfWeekLabels[sched.dayOfWeek]}`
  }
  if (sched.intervalType === 'monthly' && sched.dayOfMonth !== null) {
    return `Day ${sched.dayOfMonth} of every month`
  }
  if (sched.intervalType === 'quarterly' && sched.dayOfMonth !== null) {
    return `Day ${sched.dayOfMonth} of every quarter`
  }
  if (sched.intervalType === 'annually' && sched.dayOfMonth !== null && sched.monthOfYear !== null) {
    return `${monthLabels[sched.monthOfYear - 1]} ${sched.dayOfMonth}`
  }
  return intervalTypeLabels[sched.intervalType]
}

async function toggleActive() {
  if (!schedule.value) return
  try {
    await $fetch(`/api/maintenance-schedules/${scheduleId}`, {
      method: 'PUT',
      body: { isActive: !schedule.value.isActive }
    })
    toast.add({
      title: schedule.value.isActive ? 'Schedule paused' : 'Schedule activated',
      description: `The maintenance schedule has been ${schedule.value.isActive ? 'paused' : 'activated'}.`
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update schedule status.',
      color: 'error'
    })
  }
}

async function archiveSchedule() {
  try {
    await $fetch(`/api/maintenance-schedules/${scheduleId}`, { method: 'DELETE' })
    toast.add({
      title: 'Schedule archived',
      description: 'The maintenance schedule has been archived successfully.'
    })
    router.push('/settings/maintenance-schedules')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive schedule.',
      color: 'error'
    })
  }
}

const tabs = [
  { label: 'Details', value: 'details' },
  { label: 'Preview (Next 10)', value: 'preview' },
  { label: 'Work Order History', value: 'history' }
]

watch(activeTab, (newTab) => {
  router.replace({ query: { tab: newTab } })
})
</script>

<template>
  <UDashboardPanel id="maintenance-schedule-view">
    <template #header>
      <UDashboardNavbar :title="schedule?.name || 'Loading...'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/settings/maintenance-schedules')"
          />
        </template>

        <template #right>
          <UButton
            :label="schedule?.isActive ? 'Pause' : 'Activate'"
            :icon="schedule?.isActive ? 'i-lucide-pause' : 'i-lucide-play'"
            color="neutral"
            variant="outline"
            class="mr-2"
            @click="toggleActive"
          />
          <UDropdownMenu
            :items="[
              [
                {
                  label: 'Edit schedule',
                  icon: 'i-lucide-pencil',
                  onSelect: () => router.push(`/settings/maintenance-schedules/${scheduleId}/edit`)
                },
                {
                  label: 'View preview',
                  icon: 'i-lucide-calendar',
                  onSelect: () => activeTab = 'preview'
                }
              ],
              [
                {
                  label: 'Archive',
                  icon: 'i-lucide-archive',
                  color: 'error' as const,
                  onSelect: archiveSchedule
                }
              ]
            ]"
          >
            <UButton
              icon="i-lucide-more-horizontal"
              color="neutral"
              variant="ghost"
            />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="!schedule" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Schedule not found</p>
      </div>

      <div v-else class="space-y-6">
        <!-- Status Banner -->
        <div
          v-if="!schedule.isActive"
          class="flex items-center gap-2 p-4 bg-warning/10 border border-warning rounded-lg"
        >
          <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning" />
          <span class="text-sm">This schedule is currently paused and will not generate work orders.</span>
        </div>

        <!-- Tabs -->
        <div class="border-b border-default">
          <div class="flex gap-4">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              type="button"
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              :class="activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-highlighted hover:border-default'
              "
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Details Tab -->
        <div v-if="activeTab === 'details'" class="space-y-6">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Schedule Information
              </h3>
            </template>

            <div class="space-y-4">
              <div>
                <label class="text-sm text-muted">Name</label>
                <p class="font-medium">
                  {{ schedule.name }}
                </p>
              </div>

              <div v-if="schedule.description">
                <label class="text-sm text-muted">Description</label>
                <p>{{ schedule.description }}</p>
              </div>

              <div>
                <label class="text-sm text-muted">Interval</label>
                <p>{{ getIntervalDescription(schedule) }}</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-sm text-muted">Start Date</label>
                  <p>{{ format(parseISO(schedule.startDate), 'MMM d, yyyy') }}</p>
                </div>

                <div v-if="schedule.endDate">
                  <label class="text-sm text-muted">End Date</label>
                  <p>{{ format(parseISO(schedule.endDate), 'MMM d, yyyy') }}</p>
                </div>
              </div>

              <div v-if="schedule.nextDueDate">
                <label class="text-sm text-muted">Next Due Date</label>
                <p class="font-medium text-primary">
                  {{ format(parseISO(schedule.nextDueDate), 'MMM d, yyyy') }}
                </p>
              </div>

              <div>
                <label class="text-sm text-muted">Status</label>
                <div class="mt-1">
                  <UBadge
                    :variant="'subtle'"
                    :color="schedule.isActive ? 'success' : 'neutral'"
                  >
                    {{ schedule.isActive ? 'Active' : 'Paused' }}
                  </UBadge>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Assignment
              </h3>
            </template>

            <div class="space-y-4">
              <div v-if="schedule.asset">
                <label class="text-sm text-muted">Assigned Asset</label>
                <p class="font-medium">
                  {{ schedule.asset.assetNumber }}
                </p>
                <p class="text-sm text-muted">
                  {{ schedule.asset.make }} {{ schedule.asset.model }}
                </p>
              </div>

              <div v-if="schedule.category">
                <label class="text-sm text-muted">Assigned Category</label>
                <p class="font-medium">
                  {{ schedule.category.name }}
                </p>
              </div>

              <div v-if="schedule.template">
                <label class="text-sm text-muted">Task Template</label>
                <p class="font-medium">
                  {{ schedule.template.name }}
                </p>
                <p v-if="schedule.template.description" class="text-sm text-muted">
                  {{ schedule.template.description }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Work Order Settings
              </h3>
            </template>

            <div class="space-y-4">
              <div>
                <label class="text-sm text-muted">Lead Time</label>
                <p>{{ schedule.leadTimeDays }} day(s) before due date</p>
              </div>

              <div>
                <label class="text-sm text-muted">Default Priority</label>
                <div class="mt-1">
                  <UBadge
                    variant="subtle"
                    :color="priorityColors[schedule.defaultPriority]"
                    class="capitalize"
                  >
                    {{ schedule.defaultPriority }}
                  </UBadge>
                </div>
              </div>

              <div v-if="schedule.defaultAssignee">
                <label class="text-sm text-muted">Default Assignee</label>
                <p>{{ schedule.defaultAssignee.firstName }} {{ schedule.defaultAssignee.lastName }}</p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Preview Tab -->
        <div v-if="activeTab === 'preview'">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Next 10 Scheduled Occurrences
              </h3>
            </template>

            <div v-if="!preview || preview.length === 0" class="text-center py-8 text-muted">
              <p>No upcoming occurrences</p>
            </div>

            <div v-else class="divide-y divide-default">
              <div
                v-for="(occurrence, index) in preview"
                :key="index"
                class="py-4"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-medium">
                      {{ format(parseISO(occurrence.occurrenceDate), 'EEEE, MMMM d, yyyy') }}
                    </p>
                    <p class="text-sm text-muted mt-1">
                      Work order will be created on {{ format(parseISO(occurrence.workOrderCreateDate), 'MMM d, yyyy') }}
                    </p>
                  </div>
                  <UBadge variant="subtle" color="info" size="sm">
                    Occurrence {{ index + 1 }}
                  </UBadge>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- History Tab -->
        <div v-if="activeTab === 'history'">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Generated Work Orders
              </h3>
            </template>

            <div v-if="!workOrders || workOrders.length === 0" class="text-center py-8 text-muted">
              <UIcon name="i-lucide-clipboard-list" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No work orders generated yet</p>
            </div>

            <div v-else class="divide-y divide-default">
              <div
                v-for="wo in workOrders"
                :key="wo.id"
                class="py-4 hover:bg-elevated/50 cursor-pointer transition-colors"
                @click="router.push(`/work-orders/${wo.id}`)"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-medium text-highlighted">{{ wo.workOrderNumber }}</span>
                      <UBadge
                        variant="subtle"
                        :color="statusColors[wo.status]"
                        size="xs"
                      >
                        {{ statusLabels[wo.status] }}
                      </UBadge>
                      <UBadge
                        variant="subtle"
                        :color="priorityColors[wo.priority]"
                        size="xs"
                        class="capitalize"
                      >
                        {{ wo.priority }}
                      </UBadge>
                    </div>
                    <p class="text-sm mt-1">
                      {{ wo.title }}
                    </p>
                    <div class="flex items-center gap-4 mt-2 text-xs text-muted">
                      <span>Created {{ format(parseISO(wo.createdAt), 'MMM d, yyyy') }}</span>
                      <span v-if="wo.dueDate">
                        Due {{ format(parseISO(wo.dueDate), 'MMM d, yyyy') }}
                      </span>
                    </div>
                  </div>
                  <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-muted" />
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
