<script setup lang="ts">
/**
 * DTC History Component (US-10.3, US-10.4)
 *
 * Displays diagnostic trouble code history for an asset.
 */

import type { TableColumn } from '@nuxt/ui'
import { UBadge } from '#components'

interface Props {
  assetId: string
}

const props = defineProps<Props>()

interface DiagnosticCode {
  id: string
  code: string
  codeType: 'P' | 'C' | 'B' | 'U'
  description: string | null
  severity: 'info' | 'warning' | 'critical'
  readAt: string
  clearedAt: string | null
  syncStatus: string
  readByUser?: {
    id: string
    firstName: string
    lastName: string
  } | null
  clearedByUser?: {
    id: string
    firstName: string
    lastName: string
  } | null
  workOrder?: {
    id: string
    workOrderNumber: string
    status: string
  } | null
}

interface DtcHistoryResponse {
  data: DiagnosticCode[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  summary: {
    totalCodes: number
    activeCodes: number
    clearedCodes: number
    criticalCount: number
    warningCount: number
    infoCount: number
  }
}

// Fetch history with useFetch for SSR
const { data, status, refresh } = await useFetch<DtcHistoryResponse>(
  () => `/api/obd/dtc/${props.assetId}/history`,
  {
    query: { limit: 20, includeCleared: true },
    lazy: true,
  },
)

// Expose refresh for parent
defineExpose({ refresh })

// Watch for asset changes
watch(
  () => props.assetId,
  () => {
    refresh()
  },
)

/**
 * Get severity badge color
 */
function getSeverityColor(severity: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'critical':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
      return 'primary'
    default:
      return 'neutral'
  }
}

/**
 * Get code type label
 */
function getCodeTypeLabel(codeType: 'P' | 'C' | 'B' | 'U') {
  switch (codeType) {
    case 'P':
      return 'Powertrain'
    case 'C':
      return 'Chassis'
    case 'B':
      return 'Body'
    case 'U':
      return 'Network'
    default:
      return 'Unknown'
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString()
}

/**
 * Format relative date
 */
function formatRelativeDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return `${diffMinutes} minute(s) ago`
    }
    return `${diffHours} hour(s) ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return formatDate(dateString)
  }
}

/**
 * Table columns configuration
 */
const dtcHistoryColumns: TableColumn<DiagnosticCode>[] = [
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => {
      const code = row.original
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'font-mono font-medium' }, code.code),
        h(UBadge, { variant: 'subtle', size: 'xs' }, () => code.codeType),
      ])
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.description || 'Unknown'),
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) =>
      h(
        UBadge,
        { color: getSeverityColor(row.original.severity), size: 'sm' },
        () => row.original.severity,
      ),
  },
  {
    accessorKey: 'readAt',
    header: 'Detected',
    cell: ({ row }) => h('span', { class: 'text-sm' }, formatRelativeDate(row.original.readAt)),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const code = row.original
      if (code.clearedAt) {
        return h(UBadge, { color: 'success', variant: 'soft', size: 'sm' }, () => 'Cleared')
      }
      return h(UBadge, { color: 'error', variant: 'soft', size: 'sm' }, () => 'Active')
    },
  },
]
</script>

<template>
  <div class="space-y-4">
    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-neutral-500" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!data?.data?.length" class="text-center py-8 text-neutral-500">
      <UIcon name="i-lucide-file-search" class="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>No diagnostic code history</p>
    </div>

    <!-- History content -->
    <template v-else>
      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UCard variant="soft">
          <div class="text-center">
            <div class="text-2xl font-bold">{{ data.summary.activeCodes }}</div>
            <div class="text-sm text-neutral-500">Active</div>
          </div>
        </UCard>
        <UCard variant="soft" :class="data.summary.criticalCount > 0 ? 'border border-error-500' : ''">
          <div class="text-center">
            <div class="text-2xl font-bold text-error-500">{{ data.summary.criticalCount }}</div>
            <div class="text-sm text-neutral-500">Critical</div>
          </div>
        </UCard>
        <UCard variant="soft">
          <div class="text-center">
            <div class="text-2xl font-bold text-warning-500">{{ data.summary.warningCount }}</div>
            <div class="text-sm text-neutral-500">Warning</div>
          </div>
        </UCard>
        <UCard variant="soft">
          <div class="text-center">
            <div class="text-2xl font-bold">{{ data.summary.clearedCodes }}</div>
            <div class="text-sm text-neutral-500">Cleared</div>
          </div>
        </UCard>
      </div>

      <!-- History table -->
      <UTable
        :data="data.data"
        :columns="dtcHistoryColumns"
      />

      <!-- Pagination info -->
      <div v-if="data.pagination.hasMore" class="text-center text-sm text-neutral-500">
        Showing {{ data.data.length }} of {{ data.pagination.total }} codes
      </div>
    </template>
  </div>
</template>
