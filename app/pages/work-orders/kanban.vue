<script setup lang="ts">
import { formatDistanceToNow, parseISO, isPast } from 'date-fns'

definePageMeta({
  middleware: 'auth'
})

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  status: 'draft' | 'open' | 'in_progress' | 'pending_parts' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate: string | null
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
    avatarUrl: string | null
  } | null
}

interface KanbanColumn {
  id: string
  title: string
  count: number
  workOrders: WorkOrder[]
}

interface KanbanData {
  columns: KanbanColumn[]
}

const router = useRouter()
const toast = useToast()

const { data, status, refresh } = await useFetch<KanbanData>('/api/work-orders/kanban', {
  lazy: true
})

const statusColors: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral'
}

const priorityColors: Record<string, 'neutral' | 'info' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error'
}

const columnBgColors: Record<string, string> = {
  draft: 'bg-neutral-100 dark:bg-neutral-900',
  open: 'bg-info-50 dark:bg-info-950',
  in_progress: 'bg-warning-50 dark:bg-warning-950',
  pending_parts: 'bg-amber-50 dark:bg-amber-950',
  completed: 'bg-success-50 dark:bg-success-950',
  closed: 'bg-neutral-100 dark:bg-neutral-900'
}

// Valid status transitions for drag-drop
const validTransitions: Record<string, string[]> = {
  draft: ['open'],
  open: ['in_progress', 'closed'],
  in_progress: ['pending_parts', 'completed', 'open'],
  pending_parts: ['in_progress', 'open'],
  completed: ['closed', 'in_progress'],
  closed: []
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate) return false
  if (['completed', 'closed'].includes(status)) return false
  return isPast(parseISO(dueDate))
}

function canDropTo(fromStatus: string, toStatus: string): boolean {
  return validTransitions[fromStatus]?.includes(toStatus) ?? false
}

// Drag and drop state
const draggedItem = ref<WorkOrder | null>(null)
const draggedFromColumn = ref<string | null>(null)

function onDragStart(event: DragEvent, workOrder: WorkOrder, fromColumn: string) {
  draggedItem.value = workOrder
  draggedFromColumn.value = fromColumn
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', workOrder.id)
  }
}

function onDragOver(event: DragEvent, toColumn: string) {
  if (!draggedItem.value || !draggedFromColumn.value) return
  if (canDropTo(draggedFromColumn.value, toColumn)) {
    event.preventDefault()
  }
}

async function onDrop(event: DragEvent, toColumn: string) {
  event.preventDefault()
  if (!draggedItem.value || !draggedFromColumn.value) return
  if (draggedFromColumn.value === toColumn) return

  if (!canDropTo(draggedFromColumn.value, toColumn)) {
    toast.add({
      title: 'Invalid status change',
      description: `Cannot move from ${draggedFromColumn.value} to ${toColumn}`,
      color: 'error'
    })
    return
  }

  try {
    await $fetch(`/api/work-orders/${draggedItem.value.id}/status`, {
      method: 'POST',
      body: { status: toColumn }
    })
    toast.add({
      title: 'Status updated',
      description: `Work order moved to ${toColumn.replace('_', ' ')}`
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update status',
      color: 'error'
    })
  } finally {
    draggedItem.value = null
    draggedFromColumn.value = null
  }
}

function onDragEnd() {
  draggedItem.value = null
  draggedFromColumn.value = null
}
</script>

<template>
  <UDashboardPanel id="work-orders-kanban">
    <template #header>
      <UDashboardNavbar title="Work Orders - Kanban">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="List View"
            icon="i-lucide-list"
            color="neutral"
            variant="outline"
            class="mr-2"
            @click="router.push('/work-orders')"
          />
          <UButton
            label="New Work Order"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/work-orders/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="data" class="flex gap-4 overflow-x-auto pb-4 h-full">
        <div v-for="column in data.columns" :key="column.id" class="flex-shrink-0 w-80">
          <div
            :class="[
              'rounded-lg p-3 h-full flex flex-col',
              columnBgColors[column.id as keyof typeof columnBgColors]
            ]"
            @dragover="e => onDragOver(e, column.id)"
            @drop="e => onDrop(e, column.id)"
          >
            <!-- Column Header -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h3 class="font-medium">
                  {{ column.title }}
                </h3>
                <UBadge
                  :color="statusColors[column.id as keyof typeof statusColors]"
                  variant="subtle"
                  size="xs"
                >
                  {{ column.count }}
                </UBadge>
              </div>
            </div>

            <!-- Cards -->
            <div class="flex-1 overflow-y-auto space-y-3">
              <div
                v-for="wo in column.workOrders"
                :key="wo.id"
                draggable="true"
                class="bg-default rounded-lg p-3 shadow-sm cursor-move hover:shadow-md transition-shadow border border-default"
                :class="{
                  'ring-2 ring-primary': draggedItem?.id === wo.id,
                  'ring-2 ring-error': isOverdue(wo.dueDate, wo.status)
                }"
                @dragstart="e => onDragStart(e, wo, column.id)"
                @dragend="onDragEnd"
                @click="router.push(`/work-orders/${wo.id}`)"
              >
                <!-- WO Number and Priority -->
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-mono text-muted">
                    {{ wo.workOrderNumber }}
                  </span>
                  <UBadge
                    :color="priorityColors[wo.priority]"
                    variant="subtle"
                    size="xs"
                    class="capitalize"
                  >
                    {{ wo.priority }}
                  </UBadge>
                </div>

                <!-- Title -->
                <h4 class="font-medium text-sm mb-2 line-clamp-2">
                  {{ wo.title }}
                </h4>

                <!-- Asset -->
                <p class="text-xs text-muted mb-2 truncate">
                  {{ wo.asset.assetNumber }} - {{ wo.asset.make }} {{ wo.asset.model }}
                </p>

                <!-- Footer -->
                <div class="flex items-center justify-between mt-3 pt-2 border-t border-default">
                  <!-- Assignee -->
                  <div v-if="wo.assignedTo" class="flex items-center gap-1">
                    <UAvatar
                      :src="wo.assignedTo.avatarUrl || undefined"
                      :alt="`${wo.assignedTo.firstName} ${wo.assignedTo.lastName}`"
                      size="2xs"
                    />
                    <span class="text-xs text-muted">
                      {{ wo.assignedTo.firstName }}
                    </span>
                  </div>
                  <div v-else class="text-xs text-muted">Unassigned</div>

                  <!-- Due date -->
                  <div
                    v-if="wo.dueDate"
                    class="text-xs"
                    :class="
                      isOverdue(wo.dueDate, wo.status) ? 'text-error font-medium' : 'text-muted'
                    "
                  >
                    {{ formatDistanceToNow(parseISO(wo.dueDate), { addSuffix: true }) }}
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div
                v-if="column.workOrders.length === 0"
                class="text-center py-8 text-muted text-sm"
              >
                No work orders
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
