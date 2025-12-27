<script setup lang="ts">
import { formatDistanceToNow, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth',
  layout: 'minimal'
})

interface ChecklistItem {
  id: string
  title: string
  description: string | null
  isRequired: boolean
  isCompleted: boolean
  completedAt: string | null
  notes: string | null
  order: number
}

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'in_progress' | 'pending_parts' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate: string | null
  notes: string | null
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
  }
  checklistItems: ChecklistItem[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const {
  data: workOrder,
  status,
  error,
  refresh
} = await useFetch<WorkOrder>(`/api/work-orders/${route.params.id}`, {
  lazy: true
})

const loading = ref<Record<string, boolean>>({})
const statusLoading = ref(false)
const completionNotes = ref('')
const showCompletionModal = ref(false)

const statusColors: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral'
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  closed: 'Closed'
}

const priorityColors: Record<string, 'neutral' | 'info' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error'
}

const checklistProgress = computed(() => {
  if (!workOrder.value?.checklistItems.length) return null
  const completed = workOrder.value.checklistItems.filter(i => i.isCompleted).length
  const total = workOrder.value.checklistItems.length
  const requiredCompleted = workOrder.value.checklistItems.filter(
    i => i.isRequired && i.isCompleted
  ).length
  const requiredTotal = workOrder.value.checklistItems.filter(i => i.isRequired).length
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    requiredCompleted,
    requiredTotal,
    allRequiredDone: requiredCompleted === requiredTotal
  }
})

const canStart = computed(() => {
  return workOrder.value?.status === 'open'
})

const canComplete = computed(() => {
  if (!workOrder.value) return false
  if (workOrder.value.status !== 'in_progress') return false
  if (!checklistProgress.value) return true
  return checklistProgress.value.allRequiredDone
})

async function toggleChecklistItem(item: ChecklistItem) {
  loading.value[item.id] = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}/checklist/${item.id}`, {
      method: 'PUT',
      body: { isCompleted: !item.isCompleted }
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update checklist item.',
      color: 'error'
    })
  } finally {
    loading.value[item.id] = false
  }
}

async function startWork() {
  statusLoading.value = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}/status`, {
      method: 'POST',
      body: { status: 'in_progress' }
    })
    toast.add({
      title: 'Work started',
      description: 'Work order is now in progress.'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to start work.',
      color: 'error'
    })
  } finally {
    statusLoading.value = false
  }
}

async function completeWork() {
  statusLoading.value = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}/status`, {
      method: 'POST',
      body: {
        status: 'completed',
        notes: completionNotes.value.trim() || undefined
      }
    })
    toast.add({
      title: 'Work completed',
      description: 'Work order has been marked as complete.'
    })
    showCompletionModal.value = false
    router.push('/work-orders')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to complete work order.',
      color: 'error'
    })
  } finally {
    statusLoading.value = false
  }
}

async function markPendingParts() {
  statusLoading.value = true
  try {
    await $fetch(`/api/work-orders/${route.params.id}/status`, {
      method: 'POST',
      body: { status: 'pending_parts' }
    })
    toast.add({
      title: 'Status updated',
      description: 'Work order is now pending parts.'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update status.',
      color: 'error'
    })
  } finally {
    statusLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <header class="sticky top-0 z-10 bg-elevated border-b border-default">
      <div class="flex items-center justify-between p-4">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/work-orders')"
          />
          <div>
            <div class="font-mono text-sm text-muted">
              {{ workOrder?.workOrderNumber }}
            </div>
            <h1 class="font-medium line-clamp-1">
              {{ workOrder?.title }}
            </h1>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge v-if="workOrder" :color="statusColors[workOrder.status]" variant="subtle">
            {{ statusLabels[workOrder.status] }}
          </UBadge>
          <UBadge
            v-if="workOrder"
            :color="priorityColors[workOrder.priority]"
            variant="subtle"
            class="capitalize"
          >
            {{ workOrder.priority }}
          </UBadge>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="checklistProgress" class="px-4 pb-3">
        <div class="flex items-center justify-between text-sm mb-1">
          <span class="text-muted">Progress</span>
          <span>{{ checklistProgress.completed }}/{{ checklistProgress.total }}</span>
        </div>
        <div class="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            class="h-full bg-primary transition-all duration-300"
            :style="{ width: `${checklistProgress.percentage}%` }"
          />
        </div>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12 px-4">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-error mx-auto mb-4" />
      <h3 class="text-lg font-medium mb-2">
        Work order not found
      </h3>
      <UButton label="Back to Work Orders" @click="router.push('/work-orders')" />
    </div>

    <!-- Content -->
    <main v-else-if="workOrder" class="p-4 pb-32 space-y-6">
      <!-- Asset info -->
      <div class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-truck" class="w-4 h-4" />
        <span>{{ workOrder.asset.assetNumber }} - {{ workOrder.asset.make }}
          {{ workOrder.asset.model }}</span>
      </div>

      <!-- Description -->
      <div v-if="workOrder.description" class="p-4 bg-muted/30 rounded-lg">
        <p class="text-sm whitespace-pre-wrap">
          {{ workOrder.description }}
        </p>
      </div>

      <!-- Notes -->
      <div v-if="workOrder.notes" class="p-4 bg-warning/10 rounded-lg">
        <div class="flex items-center gap-2 text-warning font-medium text-sm mb-1">
          <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
          Notes
        </div>
        <p class="text-sm whitespace-pre-wrap">
          {{ workOrder.notes }}
        </p>
      </div>

      <!-- Checklist -->
      <div>
        <h2 class="font-medium mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-check-square" class="w-5 h-5" />
          Checklist
        </h2>

        <div v-if="workOrder.checklistItems.length === 0" class="text-center py-8 text-muted">
          <p>No checklist items</p>
        </div>

        <div v-else class="space-y-2">
          <button
            v-for="item in workOrder.checklistItems"
            :key="item.id"
            :disabled="loading[item.id] || workOrder.status === 'closed'"
            class="w-full flex items-start gap-3 p-4 rounded-lg transition-colors text-left"
            :class="[
              item.isCompleted ? 'bg-success/10' : 'bg-muted/30',
              workOrder.status !== 'closed' ? 'active:bg-muted/50' : ''
            ]"
            @click="toggleChecklistItem(item)"
          >
            <div class="mt-0.5">
              <UIcon
                v-if="loading[item.id]"
                name="i-lucide-loader-2"
                class="w-5 h-5 animate-spin text-muted"
              />
              <UIcon
                v-else
                :name="item.isCompleted ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                :class="item.isCompleted ? 'text-success' : 'text-muted'"
                class="w-5 h-5"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p :class="item.isCompleted ? 'line-through text-muted' : 'font-medium'">
                {{ item.title }}
                <span v-if="item.isRequired" class="text-error">*</span>
              </p>
              <p v-if="item.description" class="text-sm text-muted mt-1">
                {{ item.description }}
              </p>
              <p v-if="item.isCompleted && item.completedAt" class="text-xs text-muted mt-2">
                Completed {{ formatDistanceToNow(parseISO(item.completedAt), { addSuffix: true }) }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </main>

    <!-- Fixed bottom action bar -->
    <footer
      v-if="workOrder && workOrder.status !== 'closed'"
      class="fixed bottom-0 left-0 right-0 p-4 bg-elevated border-t border-default safe-area-inset-bottom"
    >
      <div v-if="canStart" class="flex gap-3">
        <UButton
          label="Start Work"
          icon="i-lucide-play"
          color="primary"
          size="lg"
          block
          :loading="statusLoading"
          @click="startWork"
        />
      </div>

      <div v-else-if="workOrder.status === 'in_progress'" class="flex gap-3">
        <UButton
          label="Pending Parts"
          icon="i-lucide-package"
          color="warning"
          variant="soft"
          size="lg"
          class="flex-1"
          :loading="statusLoading"
          @click="markPendingParts"
        />
        <UButton
          label="Complete"
          icon="i-lucide-check-circle"
          color="success"
          size="lg"
          class="flex-1"
          :disabled="!canComplete"
          :loading="statusLoading"
          @click="showCompletionModal = true"
        />
      </div>

      <div v-else-if="workOrder.status === 'pending_parts'" class="flex gap-3">
        <UButton
          label="Resume Work"
          icon="i-lucide-play"
          color="primary"
          size="lg"
          block
          :loading="statusLoading"
          @click="startWork"
        />
      </div>
    </footer>

    <!-- Completion Modal -->
    <UModal v-model:open="showCompletionModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                Complete Work Order
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="showCompletionModal = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-muted">
              Add any completion notes before marking this work order as complete.
            </p>

            <UFormField label="Completion Notes (optional)">
              <UTextarea
                v-model="completionNotes"
                placeholder="Any notes about the completed work..."
                :rows="4"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="showCompletionModal = false" />
              <UButton
                label="Complete Work Order"
                color="success"
                icon="i-lucide-check-circle"
                :loading="statusLoading"
                @click="completeWork"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.safe-area-inset-bottom {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
</style>
