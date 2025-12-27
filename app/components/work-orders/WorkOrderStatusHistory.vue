<script setup lang="ts">
import { formatDistanceToNow, parseISO } from 'date-fns'

interface StatusHistoryItem {
  id: string
  fromStatus: string | null
  toStatus: string
  notes: string | null
  createdAt: string
  changedBy: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
}

defineProps<{
  history: StatusHistoryItem[]
}>()

const statusColors: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'warning',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'neutral',
}

const statusLabels = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  closed: 'Closed',
} as const

function getStatusColor(status: string) {
  return statusColors[status as keyof typeof statusColors] || 'neutral'
}

function getStatusLabel(status: string) {
  return statusLabels[status as keyof typeof statusLabels] || status
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-medium">
        Status History
      </h3>
    </template>

    <div v-if="history.length === 0" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-history" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No status changes recorded</p>
    </div>

    <div v-else class="space-y-0">
      <div v-for="(entry, index) in history" :key="entry.id" class="flex gap-4">
        <div class="flex flex-col items-center">
          <UAvatar
            :src="entry.changedBy.avatarUrl || undefined"
            :alt="`${entry.changedBy.firstName} ${entry.changedBy.lastName}`"
            size="sm"
          />
          <div v-if="index < history.length - 1" class="w-0.5 flex-1 bg-default mt-2" />
        </div>
        <div class="flex-1 pb-6 last:pb-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium">
              {{ entry.changedBy.firstName }} {{ entry.changedBy.lastName }}
            </span>
            <span class="text-muted">changed status</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <template v-if="entry.fromStatus">
              <UBadge :color="getStatusColor(entry.fromStatus)" variant="subtle" size="xs">
                {{ getStatusLabel(entry.fromStatus) }}
              </UBadge>
              <UIcon name="i-lucide-arrow-right" class="w-4 h-4 text-muted" />
            </template>
            <UBadge :color="getStatusColor(entry.toStatus)" variant="subtle" size="xs">
              {{ getStatusLabel(entry.toStatus) }}
            </UBadge>
          </div>
          <p class="text-sm text-muted mt-2">
            {{ formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true }) }}
          </p>
          <p v-if="entry.notes" class="text-sm mt-2 p-2 bg-muted/50 rounded">
            {{ entry.notes }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
