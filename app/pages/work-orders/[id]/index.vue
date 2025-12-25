<script setup lang="ts">
import { formatDistanceToNow, format, parseISO, isPast } from 'date-fns'

definePageMeta({
  middleware: 'auth'
})

interface ChecklistItem {
  id: string
  title: string
  description: string | null
  isRequired: boolean
  isCompleted: boolean
  completedAt: string | null
  completedBy: { id: string, firstName: string, lastName: string } | null
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
}

interface Photo {
  id: string
  photoUrl: string
  thumbnailUrl: string | null
  photoType: 'before' | 'during' | 'after' | 'issue' | 'other'
  caption: string | null
  createdAt: string
}

interface StatusHistoryItem {
  id: string
  fromStatus: string | null
  toStatus: string
  notes: string | null
  createdAt: string
  changedBy: { id: string, firstName: string, lastName: string, avatarUrl: string | null }
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

const { data: workOrder, status, error, refresh } = await useFetch<WorkOrder>(`/api/work-orders/${route.params.id}`, {
  lazy: true
})

const statusColors = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'orange',
  completed: 'success',
  closed: 'neutral'
} as const

const priorityColors = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error'
} as const

const statusLabels = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  closed: 'Closed'
} as const

const validTransitions: Record<string, { label: string, value: string }[]> = {
  draft: [{ label: 'Open', value: 'open' }],
  open: [
    { label: 'Start Work', value: 'in_progress' },
    { label: 'Close', value: 'closed' }
  ],
  in_progress: [
    { label: 'Pending Parts', value: 'pending_parts' },
    { label: 'Complete', value: 'completed' },
    { label: 'Re-open', value: 'open' }
  ],
  pending_parts: [
    { label: 'Resume Work', value: 'in_progress' },
    { label: 'Re-open', value: 'open' }
  ],
  completed: [
    { label: 'Close', value: 'closed' },
    { label: 'Revert to In Progress', value: 'in_progress' }
  ],
  closed: []
}

const activeTab = ref('details')
const statusChangeLoading = ref(false)

async function changeStatus(newStatus: string) {
  statusChangeLoading.value = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}/status`, {
      method: 'POST',
      body: { status: newStatus }
    })
    toast.add({
      title: 'Status updated',
      description: `Work order status changed to ${statusLabels[newStatus as keyof typeof statusLabels]}.`
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update status.',
      color: 'error'
    })
  } finally {
    statusChangeLoading.value = false
  }
}

async function archiveWorkOrder() {
  try {
    await $fetch(`/api/work-orders/${route.params.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Work order archived',
      description: 'The work order has been archived successfully.'
    })
    router.push('/work-orders')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive work order.',
      color: 'error'
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
  const completed = workOrder.value.checklistItems.filter(i => i.isCompleted).length
  const total = workOrder.value.checklistItems.length
  return { completed, total, percentage: Math.round((completed / total) * 100) }
})

const totalPartsCost = computed(() => {
  if (!workOrder.value?.parts.length) return null
  const total = workOrder.value.parts.reduce((sum, p) => {
    return sum + (p.totalCost ? parseFloat(p.totalCost) : 0)
  }, 0)
  return total.toFixed(2)
})

const tabs = computed(() => [
  { label: 'Details', value: 'details', icon: 'i-lucide-file-text' },
  {
    label: `Checklist${checklistProgress.value ? ` (${checklistProgress.value.completed}/${checklistProgress.value.total})` : ''}`,
    value: 'checklist',
    icon: 'i-lucide-check-square'
  },
  { label: `Parts (${workOrder.value?.parts.length || 0})`, value: 'parts', icon: 'i-lucide-wrench' },
  { label: `Photos (${workOrder.value?.photos.length || 0})`, value: 'photos', icon: 'i-lucide-image' },
  { label: 'History', value: 'history', icon: 'i-lucide-history' }
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
              :items="validTransitions[workOrder.status].map(t => ({
                label: t.label,
                onSelect: () => changeStatus(t.value)
              }))"
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
            {{ workOrder.asset.assetNumber }} - {{ workOrder.asset.make }} {{ workOrder.asset.model }}
          </NuxtLink>
        </div>

        <!-- Tabs -->
        <UTabs v-model="activeTab" :items="tabs" class="w-full" />

        <!-- Tab Content -->
        <div v-if="activeTab === 'details'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <dd :class="isOverdue(workOrder.dueDate, workOrder.status) ? 'text-error font-medium' : 'font-medium'">
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
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium">
                  Checklist Items
                </h3>
                <span v-if="checklistProgress" class="text-sm text-muted">
                  {{ checklistProgress.percentage }}% complete
                </span>
              </div>
            </template>

            <div v-if="workOrder.checklistItems.length === 0" class="text-center py-8 text-muted">
              <UIcon name="i-lucide-check-square" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No checklist items</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="item in workOrder.checklistItems"
                :key="item.id"
                class="flex items-start gap-3 p-3 rounded-lg"
                :class="item.isCompleted ? 'bg-success/10' : 'bg-muted/50'"
              >
                <UIcon
                  :name="item.isCompleted ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                  :class="item.isCompleted ? 'text-success' : 'text-muted'"
                  class="w-5 h-5 mt-0.5"
                />
                <div class="flex-1">
                  <p :class="item.isCompleted ? 'line-through text-muted' : 'font-medium'">
                    {{ item.title }}
                    <span v-if="item.isRequired" class="text-error">*</span>
                  </p>
                  <p v-if="item.description" class="text-sm text-muted mt-1">
                    {{ item.description }}
                  </p>
                  <p v-if="item.completedBy" class="text-xs text-muted mt-2">
                    Completed by {{ item.completedBy.firstName }} {{ item.completedBy.lastName }}
                    {{ formatDistanceToNow(parseISO(item.completedAt!), { addSuffix: true }) }}
                  </p>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Parts Tab -->
        <div v-else-if="activeTab === 'parts'">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium">
                  Parts Used
                </h3>
                <span v-if="totalPartsCost" class="text-sm font-medium">
                  Total: ${{ totalPartsCost }}
                </span>
              </div>
            </template>

            <div v-if="workOrder.parts.length === 0" class="text-center py-8 text-muted">
              <UIcon name="i-lucide-wrench" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No parts recorded</p>
            </div>

            <div v-else class="divide-y divide-default">
              <div
                v-for="part in workOrder.parts"
                :key="part.id"
                class="py-3 first:pt-0 last:pb-0"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-medium">
                      {{ part.partName }}
                    </p>
                    <p v-if="part.partNumber" class="text-sm text-muted">
                      Part #: {{ part.partNumber }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="font-medium">
                      x{{ part.quantity }}
                    </p>
                    <p v-if="part.totalCost" class="text-sm text-muted">
                      ${{ part.totalCost }}
                    </p>
                  </div>
                </div>
                <p v-if="part.notes" class="text-sm text-muted mt-2">
                  {{ part.notes }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Photos Tab -->
        <div v-else-if="activeTab === 'photos'">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Photos
              </h3>
            </template>

            <div v-if="workOrder.photos.length === 0" class="text-center py-8 text-muted">
              <UIcon name="i-lucide-image" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No photos uploaded</p>
            </div>

            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div
                v-for="photo in workOrder.photos"
                :key="photo.id"
                class="relative group"
              >
                <img
                  :src="photo.thumbnailUrl || photo.photoUrl"
                  :alt="photo.caption || 'Work order photo'"
                  class="w-full h-32 object-cover rounded-lg"
                >
                <div class="absolute top-2 right-2">
                  <UBadge
                    color="neutral"
                    variant="solid"
                    class="capitalize text-xs"
                  >
                    {{ photo.photoType }}
                  </UBadge>
                </div>
                <p v-if="photo.caption" class="text-xs text-muted mt-1 truncate">
                  {{ photo.caption }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- History Tab -->
        <div v-else-if="activeTab === 'history'">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Status History
              </h3>
            </template>

            <div class="space-y-4">
              <div
                v-for="(entry, index) in workOrder.statusHistory"
                :key="entry.id"
                class="flex gap-4"
              >
                <div class="flex flex-col items-center">
                  <UAvatar
                    :src="entry.changedBy.avatarUrl || undefined"
                    :alt="`${entry.changedBy.firstName} ${entry.changedBy.lastName}`"
                    size="sm"
                  />
                  <div
                    v-if="index < workOrder.statusHistory.length - 1"
                    class="w-0.5 flex-1 bg-default mt-2"
                  />
                </div>
                <div class="flex-1 pb-4">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium">{{ entry.changedBy.firstName }} {{ entry.changedBy.lastName }}</span>
                    <span class="text-muted">changed status</span>
                    <template v-if="entry.fromStatus">
                      <UBadge :color="statusColors[entry.fromStatus as keyof typeof statusColors]" variant="subtle" size="xs">
                        {{ statusLabels[entry.fromStatus as keyof typeof statusLabels] }}
                      </UBadge>
                      <UIcon name="i-lucide-arrow-right" class="w-4 h-4 text-muted" />
                    </template>
                    <UBadge :color="statusColors[entry.toStatus as keyof typeof statusColors]" variant="subtle" size="xs">
                      {{ statusLabels[entry.toStatus as keyof typeof statusLabels] }}
                    </UBadge>
                  </div>
                  <p class="text-sm text-muted mt-1">
                    {{ formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true }) }}
                  </p>
                  <p v-if="entry.notes" class="text-sm mt-2 p-2 bg-muted/50 rounded">
                    {{ entry.notes }}
                  </p>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
