<script setup lang="ts">
import { format, isPast, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth',
})

interface ChecklistItem {
  id: string
  title: string
  description: string | null
  isRequired: boolean
  isCompleted: boolean
  completedAt: string | null
  completedBy: { id: string; firstName: string; lastName: string } | null
  notes: string | null
  order: number
}

interface Part {
  id: string
  partName: string
  partNumber: string | null
  quantity: number
  unitCost: string | null
  totalCost: string | null
  notes: string | null
  createdAt: string
  addedBy?: { id: string; firstName: string; lastName: string }
}

interface Photo {
  id: string
  photoUrl: string
  thumbnailUrl: string | null
  photoType: 'before' | 'during' | 'after' | 'issue' | 'other'
  caption: string | null
  createdAt: string
  uploadedBy?: { id: string; firstName: string; lastName: string }
}

interface StatusHistoryItem {
  id: string
  fromStatus: string | null
  toStatus: string
  notes: string | null
  createdAt: string
  changedBy: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
}

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
  closedAt: string | null
  estimatedDuration: number | null
  actualDuration: number | null
  notes: string | null
  completionNotes: string | null
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
    phone: string | null
  } | null
  createdBy: {
    id: string
    firstName: string
    lastName: string
  }
  checklistItems: ChecklistItem[]
  parts: Part[]
  photos: Photo[]
  statusHistory: StatusHistoryItem[]
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const {
  data: workOrder,
  status,
  error,
  refresh,
} = await useFetch<WorkOrder>(`/api/work-orders/${route.params.id}`, {
  lazy: true,
})

const statusColors: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral',
}

const priorityColors = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
} as const

const statusLabels = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  closed: 'Closed',
} as const

const validTransitions: Record<string, { label: string; value: string }[]> = {
  draft: [{ label: 'Open', value: 'open' }],
  open: [
    { label: 'Start Work', value: 'in_progress' },
    { label: 'Close', value: 'closed' },
  ],
  in_progress: [
    { label: 'Pending Parts', value: 'pending_parts' },
    { label: 'Complete', value: 'completed' },
    { label: 'Re-open', value: 'open' },
  ],
  pending_parts: [
    { label: 'Resume Work', value: 'in_progress' },
    { label: 'Re-open', value: 'open' },
  ],
  completed: [
    { label: 'Close', value: 'closed' },
    { label: 'Revert to In Progress', value: 'in_progress' },
  ],
  closed: [],
}

const activeTab = ref('details')
const statusChangeLoading = ref(false)

async function changeStatus(newStatus: string) {
  statusChangeLoading.value = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}/status`, {
      method: 'POST',
      body: { status: newStatus },
    })
    toast.add({
      title: 'Status updated',
      description: `Work order status changed to ${statusLabels[newStatus as keyof typeof statusLabels]}.`,
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update status.',
      color: 'error',
    })
  } finally {
    statusChangeLoading.value = false
  }
}

async function archiveWorkOrder() {
  try {
    // @ts-expect-error - Nuxt route typing issue with DELETE method
    await $fetch(`/api/work-orders/${route.params.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Work order archived',
      description: 'The work order has been archived successfully.',
    })
    router.push('/work-orders')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive work order.',
      color: 'error',
    })
  }
}

function formatDate(date: string) {
  return format(parseISO(date), 'PPpp')
}

function formatShortDate(date: string) {
  return format(parseISO(date), 'PP')
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate) return false
  if (['completed', 'closed'].includes(status)) return false
  return isPast(parseISO(dueDate))
}

const checklistProgress = computed(() => {
  if (!workOrder.value?.checklistItems.length) return null
  const completed = workOrder.value.checklistItems.filter((i) => i.isCompleted).length
  const total = workOrder.value.checklistItems.length
  return { completed, total, percentage: Math.round((completed / total) * 100) }
})

const tabs = computed(() => [
  { label: 'Details', value: 'details', icon: 'i-lucide-file-text' },
  {
    label: `Checklist${checklistProgress.value ? ` (${checklistProgress.value.completed}/${checklistProgress.value.total})` : ''}`,
    value: 'checklist',
    icon: 'i-lucide-check-square',
  },
  {
    label: `Parts (${workOrder.value?.parts.length || 0})`,
    value: 'parts',
    icon: 'i-lucide-wrench',
  },
  {
    label: `Photos (${workOrder.value?.photos.length || 0})`,
    value: 'photos',
    icon: 'i-lucide-image',
  },
  { label: 'History', value: 'history', icon: 'i-lucide-history' },
])
</script>

<template>
  <UDashboardPanel id="work-order-detail">
    <template #header>
      <UDashboardNavbar :title="workOrder?.workOrderNumber || 'Work Order'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/work-orders')"
          />
        </template>

        <template #right>
          <div class="flex gap-2">
            <UDropdownMenu
              v-if="workOrder && validTransitions[workOrder.status]?.length"
              :items="
                (validTransitions[workOrder!.status] ?? []).map(t => ({
                  label: t.label,
                  onSelect: () => changeStatus(t.value)
                }))
              "
            >
              <UButton
                label="Change Status"
                icon="i-lucide-arrow-right-circle"
                color="primary"
                variant="outline"
                :loading="statusChangeLoading"
              />
            </UDropdownMenu>
            <UButton
              label="Edit"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              @click="router.push(`/work-orders/${route.params.id}/edit`)"
            />
            <UButton
              label="Archive"
              icon="i-lucide-archive"
              color="error"
              variant="subtle"
              @click="archiveWorkOrder"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="error" class="text-center py-12">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-error mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          Work order not found
        </h3>
        <p class="text-muted mb-4">
          The work order you're looking for doesn't exist or has been removed.
        </p>
        <UButton label="Back to Work Orders" @click="router.push('/work-orders')" />
      </div>

      <div v-else-if="workOrder" class="space-y-6">
        <!-- Header with status badges -->
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-bold">
            {{ workOrder.title }}
          </h1>
          <UBadge :color="statusColors[workOrder.status]" variant="subtle">
            {{ statusLabels[workOrder.status] }}
          </UBadge>
          <UBadge :color="priorityColors[workOrder.priority]" variant="subtle" class="capitalize">
            {{ workOrder.priority }}
          </UBadge>
          <UBadge
            v-if="isOverdue(workOrder.dueDate, workOrder.status)"
            color="error"
            variant="solid"
          >
            Overdue
          </UBadge>
        </div>

        <!-- Asset info -->
        <div class="flex items-center gap-2 text-muted">
          <UIcon name="i-lucide-truck" class="w-4 h-4" />
          <NuxtLink
            :to="`/assets/${workOrder.asset.id}`"
            class="hover:text-primary hover:underline"
          >
            {{ workOrder.asset.assetNumber }} - {{ workOrder.asset.make }}
            {{ workOrder.asset.model }}
          </NuxtLink>
        </div>

        <!-- Tabs -->
        <UTabs v-model="activeTab" :items="tabs" class="w-full" />

        <!-- Tab Content -->
        <div
          v-if="activeTab === 'details'"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Assignment
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  Assigned To
                </dt>
                <dd v-if="workOrder.assignedTo" class="flex items-center gap-2 mt-1">
                  <UAvatar
                    :src="workOrder.assignedTo.avatarUrl || undefined"
                    :alt="`${workOrder.assignedTo.firstName} ${workOrder.assignedTo.lastName}`"
                    size="xs"
                  />
                  <span class="font-medium">{{ workOrder.assignedTo.firstName }} {{ workOrder.assignedTo.lastName }}</span>
                </dd>
                <dd v-else class="text-muted">
                  Unassigned
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Created By
                </dt>
                <dd class="font-medium">
                  {{ workOrder.createdBy.firstName }} {{ workOrder.createdBy.lastName }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Schedule
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  Due Date
                </dt>
                <dd
                  :class="
                    isOverdue(workOrder.dueDate, workOrder.status)
                      ? 'text-error font-medium'
                      : 'font-medium'
                  "
                >
                  {{ workOrder.dueDate ? formatShortDate(workOrder.dueDate) : '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Estimated Duration
                </dt>
                <dd class="font-medium">
                  {{ workOrder.estimatedDuration ? `${workOrder.estimatedDuration} minutes` : '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Actual Duration
                </dt>
                <dd class="font-medium">
                  {{ workOrder.actualDuration ? `${workOrder.actualDuration} minutes` : '-' }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Timeline
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  Created
                </dt>
                <dd class="font-medium">
                  {{ formatDate(workOrder.createdAt) }}
                </dd>
              </div>
              <div v-if="workOrder.startedAt">
                <dt class="text-sm text-muted">
                  Started
                </dt>
                <dd class="font-medium">
                  {{ formatDate(workOrder.startedAt) }}
                </dd>
              </div>
              <div v-if="workOrder.completedAt">
                <dt class="text-sm text-muted">
                  Completed
                </dt>
                <dd class="font-medium">
                  {{ formatDate(workOrder.completedAt) }}
                </dd>
              </div>
              <div v-if="workOrder.closedAt">
                <dt class="text-sm text-muted">
                  Closed
                </dt>
                <dd class="font-medium">
                  {{ formatDate(workOrder.closedAt) }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard v-if="workOrder.description" class="md:col-span-2 lg:col-span-3">
            <template #header>
              <h3 class="font-medium">
                Description
              </h3>
            </template>
            <p class="text-muted whitespace-pre-wrap">
              {{ workOrder.description }}
            </p>
          </UCard>

          <UCard v-if="workOrder.notes" class="md:col-span-2 lg:col-span-3">
            <template #header>
              <h3 class="font-medium">
                Notes
              </h3>
            </template>
            <p class="text-muted whitespace-pre-wrap">
              {{ workOrder.notes }}
            </p>
          </UCard>

          <UCard v-if="workOrder.completionNotes" class="md:col-span-2 lg:col-span-3">
            <template #header>
              <h3 class="font-medium">
                Completion Notes
              </h3>
            </template>
            <p class="text-muted whitespace-pre-wrap">
              {{ workOrder.completionNotes }}
            </p>
          </UCard>
        </div>

        <!-- Checklist Tab -->
        <div v-else-if="activeTab === 'checklist'">
          <WorkOrderChecklist
            :work-order-id="workOrder.id"
            :items="workOrder.checklistItems"
            :readonly="workOrder.status === 'closed'"
            @refresh="refresh"
          />
        </div>

        <!-- Parts Tab -->
        <div v-else-if="activeTab === 'parts'">
          <WorkOrderParts
            :work-order-id="workOrder.id"
            :parts="workOrder.parts"
            :readonly="workOrder.status === 'closed'"
            @refresh="refresh"
          />
        </div>

        <!-- Photos Tab -->
        <div v-else-if="activeTab === 'photos'">
          <WorkOrderPhotos
            :work-order-id="workOrder.id"
            :photos="workOrder.photos"
            :readonly="workOrder.status === 'closed'"
            @refresh="refresh"
          />
        </div>

        <!-- History Tab -->
        <div v-else-if="activeTab === 'history'">
          <WorkOrderStatusHistory :history="workOrder.statusHistory" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
