<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AuditLogEntry, AuditLogFilters } from '~/composables/useAuditLog'

/**
 * AuditLogTable - Paginated table with expandable JSON diff for audit logs
 *
 * Displays audit log entries with:
 * - User info, action type, entity details
 * - Expandable rows showing JSON diff of old/new values
 * - Pagination controls
 * - Filter support via props
 */

interface Props {
  /** Initial page number */
  initialPage?: number
  /** Number of items per page */
  pageSize?: number
  /** Filter options */
  filters?: AuditLogFilters
}

const props = withDefaults(defineProps<Props>(), {
  initialPage: 1,
  pageSize: 20,
  filters: () => ({}),
})

// Resolve components for table cells
const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')

// Use the audit log composable
const {
  logs,
  loading,
  error,
  page,
  totalPages,
  total,
  hasMore,
  goToPage,
  nextPage,
  prevPage,
  setFilters,
} = useAuditLog({
  page: props.initialPage,
  limit: props.pageSize,
  filters: props.filters,
})

// Watch for filter prop changes
watch(
  () => props.filters,
  (newFilters) => {
    if (newFilters) {
      setFilters(newFilters)
    }
  },
  { deep: true },
)

// Expanded rows state
const expandedRows = ref<Set<string>>(new Set())

function toggleRow(logId: string) {
  if (expandedRows.value.has(logId)) {
    expandedRows.value.delete(logId)
  } else {
    expandedRows.value.add(logId)
  }
  // Force reactivity update
  expandedRows.value = new Set(expandedRows.value)
}

function isExpanded(logId: string): boolean {
  return expandedRows.value.has(logId)
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Get action badge color based on action type
function getActionColor(action: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  const lowerAction = action.toLowerCase()
  if (lowerAction.includes('create') || lowerAction.includes('add')) {
    return 'success'
  }
  if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
    return 'error'
  }
  if (
    lowerAction.includes('update') ||
    lowerAction.includes('edit') ||
    lowerAction.includes('modify')
  ) {
    return 'warning'
  }
  if (
    lowerAction.includes('login') ||
    lowerAction.includes('logout') ||
    lowerAction.includes('auth')
  ) {
    return 'info'
  }
  return 'neutral'
}

// Format action name for display
function formatAction(action: string): string {
  // Convert snake_case or camelCase to title case with spaces
  return action
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Check if there are changes to show
function hasChanges(log: AuditLogEntry): boolean {
  return (
    (log.oldValues !== null && log.oldValues !== undefined) ||
    (log.newValues !== null && log.newValues !== undefined)
  )
}

// Compute JSON diff between old and new values
interface DiffEntry {
  key: string
  oldValue: unknown
  newValue: unknown
  type: 'added' | 'removed' | 'modified' | 'unchanged'
}

function computeDiff(log: AuditLogEntry): DiffEntry[] {
  const oldObj = (log.oldValues || {}) as Record<string, unknown>
  const newObj = (log.newValues || {}) as Record<string, unknown>

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  const diff: DiffEntry[] = []

  for (const key of allKeys) {
    const oldVal = oldObj[key]
    const newVal = newObj[key]

    if (!(key in oldObj)) {
      diff.push({ key, oldValue: undefined, newValue: newVal, type: 'added' })
    } else if (!(key in newObj)) {
      diff.push({ key, oldValue: oldVal, newValue: undefined, type: 'removed' })
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff.push({ key, oldValue: oldVal, newValue: newVal, type: 'modified' })
    }
  }

  return diff.sort((a, b) => {
    // Sort by type priority: modified, added, removed
    const priority = { modified: 0, added: 1, removed: 2, unchanged: 3 }
    return priority[a.type] - priority[b.type]
  })
}

// Format a value for display in the diff
function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}

// Table columns
const columns: TableColumn<AuditLogEntry>[] = [
  {
    accessorKey: 'expand',
    header: '',
    cell: ({ row }) => {
      if (!hasChanges(row.original)) {
        return h('div', { class: 'w-8' })
      }
      return h(UButton, {
        icon: isExpanded(row.original.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right',
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        class: 'transition-transform',
        onClick: () => toggleRow(row.original.id),
        'aria-label': isExpanded(row.original.id) ? 'Collapse row' : 'Expand row',
        'aria-expanded': isExpanded(row.original.id),
      })
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm', title: formatDateTime(row.original.createdAt) },
        formatDate(row.original.createdAt),
      ),
  },
  {
    accessorKey: 'user',
    header: 'User',
    cell: ({ row }) => {
      const user = row.original.user
      if (!user) {
        return h('span', { class: 'text-muted italic' }, 'System')
      }
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, {
          src: user.avatar?.src,
          alt: user.name,
          size: 'sm',
        }),
        h('div', undefined, [
          h('p', { class: 'font-medium text-sm' }, user.name),
          h('p', { class: 'text-xs text-muted' }, user.email ?? ''),
        ]),
      ])
    },
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) =>
      h(
        UBadge,
        { variant: 'subtle', color: getActionColor(row.original.action), class: 'text-xs' },
        () => formatAction(row.original.action),
      ),
  },
  {
    accessorKey: 'entityType',
    header: 'Entity',
    cell: ({ row }) => {
      const entityType = row.original.entityType
      const entityId = row.original.entityId
      if (!entityType) {
        return h('span', { class: 'text-muted' }, '-')
      }
      return h('div', { class: 'text-sm' }, [
        h('p', { class: 'font-medium capitalize' }, entityType.replace(/_/g, ' ')),
        entityId
          ? h(
              'p',
              { class: 'text-xs text-muted font-mono truncate max-w-32', title: entityId },
              `${entityId.slice(0, 8)}...`,
            )
          : null,
      ])
    },
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP Address',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted font-mono' }, row.original.ipAddress || '-'),
  },
]
</script>

<template>
  <div class="audit-log-table">
    <!-- Loading state -->
    <div v-if="loading" class="p-8 text-center text-muted">
      <i class="i-lucide-loader-2 animate-spin text-2xl mb-2" aria-hidden="true" />
      <p>Loading audit logs...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-8 text-center">
      <i class="i-lucide-alert-circle text-error text-2xl mb-2" aria-hidden="true" />
      <p class="text-error">Failed to load audit logs</p>
      <p class="text-sm text-muted mt-1">{{ error.message }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!logs.length" class="p-8 text-center">
      <i class="i-lucide-file-search text-4xl text-muted mb-4" aria-hidden="true" />
      <p class="text-muted">No audit logs found</p>
      <p class="text-sm text-muted mt-1">Audit logs will appear here when actions are performed.</p>
    </div>

    <!-- Table with data -->
    <template v-else>
      <UTable
        :data="logs"
        :columns="columns"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default align-top',
        }"
      />

      <!-- Expanded row details (rendered outside table for better layout) -->
      <TransitionGroup name="expand">
        <div
          v-for="log in logs.filter((l: AuditLogEntry) => isExpanded(l.id))"
          :key="`detail-${log.id}`"
          class="border border-default rounded-lg mx-4 mb-4 -mt-3 bg-elevated/30 overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-default bg-elevated/50">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-sm">
                Changes for {{ formatAction(log.action) }}
              </h4>
              <span class="text-xs text-muted">{{ formatDateTime(log.createdAt) }}</span>
            </div>
          </div>

          <div class="p-4">
            <!-- JSON Diff Display -->
            <div v-if="hasChanges(log)" class="space-y-2">
              <div
                v-for="entry in computeDiff(log)"
                :key="entry.key"
                class="grid grid-cols-[1fr_1fr_1fr] gap-4 p-2 rounded text-sm"
                :class="{
                  'bg-success/10': entry.type === 'added',
                  'bg-error/10': entry.type === 'removed',
                  'bg-warning/10': entry.type === 'modified',
                }"
              >
                <div class="font-mono font-medium text-highlighted">
                  {{ entry.key }}
                </div>
                <div
                  class="font-mono text-muted break-all"
                  :class="{ 'line-through': entry.type === 'removed' || entry.type === 'modified' }"
                >
                  <span v-if="entry.type === 'added'" class="text-muted italic">-</span>
                  <pre v-else class="whitespace-pre-wrap">{{ formatDiffValue(entry.oldValue) }}</pre>
                </div>
                <div
                  class="font-mono break-all"
                  :class="{
                    'text-success': entry.type === 'added',
                    'text-warning': entry.type === 'modified',
                    'text-muted italic': entry.type === 'removed',
                  }"
                >
                  <span v-if="entry.type === 'removed'">-</span>
                  <pre v-else class="whitespace-pre-wrap">{{ formatDiffValue(entry.newValue) }}</pre>
                </div>
              </div>

              <!-- Column headers for diff -->
              <div v-if="computeDiff(log).length > 0" class="grid grid-cols-[1fr_1fr_1fr] gap-4 px-2 text-xs text-muted font-medium -mt-2 border-t border-default pt-2">
                <div>Field</div>
                <div>Old Value</div>
                <div>New Value</div>
              </div>
            </div>

            <!-- No changes message -->
            <div v-else class="text-muted text-sm italic">
              No value changes recorded for this action.
            </div>

            <!-- Additional metadata -->
            <div v-if="log.userAgent" class="mt-4 pt-4 border-t border-default">
              <p class="text-xs text-muted">
                <span class="font-medium">User Agent:</span>
                {{ log.userAgent }}
              </p>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-default"
      >
        <p class="text-sm text-muted">
          Showing {{ (page - 1) * props.pageSize + 1 }} to
          {{ Math.min(page * props.pageSize, total) }} of
          {{ total }} entries
        </p>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevrons-left"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="page <= 1"
            aria-label="Go to first page"
            @click="goToPage(1)"
          />
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="page <= 1"
            aria-label="Go to previous page"
            @click="prevPage"
          />
          <span class="text-sm text-muted px-2">
            Page {{ page }} of {{ totalPages }}
          </span>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="!hasMore"
            aria-label="Go to next page"
            @click="nextPage"
          />
          <UButton
            icon="i-lucide-chevrons-right"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="page >= totalPages"
            aria-label="Go to last page"
            @click="goToPage(totalPages)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
