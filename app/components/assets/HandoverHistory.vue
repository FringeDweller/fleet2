<script setup lang="ts">
interface Operator {
  id: string
  firstName: string
  lastName: string
  email?: string
  avatarUrl?: string | null
}

interface HandoverEntry {
  id: string
  fromOperator: Operator | null
  fromSession: {
    id: string
    startTime: string
    endTime: string | null
    tripDurationMinutes: number | null
    tripDistance: number | null
    startOdometer: number | null
    endOdometer: number | null
  } | null
  toOperator: Operator
  toSession: {
    id: string
    startTime: string
    status: string
  }
  handoverType: string | null
  handoverTypeLabel: string | null
  handoverReason: string | null
  sessionGap: number | null
  isLinkedSession: boolean
  handoverTime: string
}

interface HandoverHistoryResponse {
  data: HandoverEntry[]
  asset: {
    id: string
    assetNumber: string
  }
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const props = defineProps<{
  assetId: string
}>()

const toast = useToast()

const { data, status, refresh } = await useFetch<HandoverHistoryResponse>(
  () => `/api/assets/${props.assetId}/handover-history`,
  {
    lazy: true,
  },
)

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDuration = (minutes: number | null) => {
  if (!minutes) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const handoverTypeColors: Record<string, string> = {
  shift_change: 'primary',
  break: 'info',
  emergency: 'error',
  other: 'neutral',
}

defineExpose({ refresh })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">
        Handover History
      </h3>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="() => refresh()"
      />
    </div>

    <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!data?.data?.length" class="text-center py-12">
      <UIcon name="i-lucide-users" class="w-12 h-12 text-muted mx-auto mb-4" />
      <p class="text-muted">
        No handover history for this asset.
      </p>
      <p class="text-sm text-muted mt-1">
        Handovers will appear here when operators transfer control of this asset.
      </p>
    </div>

    <div v-else class="space-y-4">
      <UCard v-for="entry in data.data" :key="entry.id" class="relative">
        <!-- Linked session indicator -->
        <div
          v-if="entry.isLinkedSession"
          class="absolute -left-1 top-0 bottom-0 w-1 bg-primary rounded-l"
        />

        <div class="flex items-start gap-4">
          <!-- From Operator -->
          <div class="flex-1">
            <p class="text-xs text-muted mb-1">
              From
            </p>
            <div v-if="entry.fromOperator" class="flex items-center gap-2">
              <UAvatar
                :src="entry.fromOperator.avatarUrl || undefined"
                :alt="`${entry.fromOperator.firstName} ${entry.fromOperator.lastName}`"
                size="xs"
              />
              <span class="font-medium text-sm">
                {{ entry.fromOperator.firstName }} {{ entry.fromOperator.lastName }}
              </span>
            </div>
            <div v-else class="text-sm text-muted">
              Unknown
            </div>
            <p v-if="entry.fromSession" class="text-xs text-muted mt-1">
              Duration: {{ formatDuration(entry.fromSession.tripDurationMinutes) }}
            </p>
          </div>

          <!-- Arrow -->
          <div class="flex flex-col items-center py-2">
            <UIcon name="i-lucide-arrow-right" class="w-5 h-5 text-muted" />
            <UBadge
              v-if="entry.handoverTypeLabel"
              :color="(handoverTypeColors[entry.handoverType || 'other'] as 'primary' | 'info' | 'error' | 'neutral')"
              variant="subtle"
              size="xs"
              class="mt-1"
            >
              {{ entry.handoverTypeLabel }}
            </UBadge>
          </div>

          <!-- To Operator -->
          <div class="flex-1 text-right">
            <p class="text-xs text-muted mb-1">
              To
            </p>
            <div class="flex items-center justify-end gap-2">
              <span class="font-medium text-sm">
                {{ entry.toOperator.firstName }} {{ entry.toOperator.lastName }}
              </span>
              <UAvatar
                :src="entry.toOperator.avatarUrl || undefined"
                :alt="`${entry.toOperator.firstName} ${entry.toOperator.lastName}`"
                size="xs"
              />
            </div>
            <UBadge
              v-if="entry.toSession.status === 'active'"
              color="success"
              variant="subtle"
              size="xs"
              class="mt-1"
            >
              Active
            </UBadge>
          </div>
        </div>

        <!-- Handover Details -->
        <div class="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
          <div class="flex items-center gap-4">
            <span>{{ formatDate(entry.handoverTime) }}</span>
            <span v-if="entry.sessionGap != null && entry.sessionGap > 0">
              Gap: {{ entry.sessionGap }} min
            </span>
            <UBadge
              v-if="entry.isLinkedSession"
              color="primary"
              variant="subtle"
              size="xs"
            >
              Linked Session
            </UBadge>
          </div>
        </div>

        <!-- Handover Reason -->
        <div v-if="entry.handoverReason" class="mt-2 text-sm text-muted italic">
          "{{ entry.handoverReason }}"
        </div>
      </UCard>

      <!-- Load More -->
      <div v-if="data.pagination.hasMore" class="flex justify-center pt-4">
        <UButton
          label="Load More"
          color="neutral"
          variant="outline"
          @click="() => refresh()"
        />
      </div>

      <!-- Pagination Info -->
      <p class="text-xs text-muted text-center">
        Showing {{ data.data.length }} of {{ data.pagination.total }} handovers
      </p>
    </div>
  </div>
</template>
