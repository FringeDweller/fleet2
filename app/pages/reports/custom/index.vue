<script setup lang="ts">
/**
 * Custom Reports List Page (US-14.7)
 *
 * Lists saved custom reports for the user
 */

definePageMeta({
  middleware: 'auth',
})

interface CustomReportUser {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface CustomReport {
  id: string
  name: string
  description: string | null
  dataSource:
    | 'assets'
    | 'work_orders'
    | 'maintenance_schedules'
    | 'fuel_transactions'
    | 'inspections'
  isShared: boolean
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
  user: CustomReportUser
}

const {
  data: reports,
  status,
  refresh,
} = await useFetch<CustomReport[]>('/api/reports/custom', {
  lazy: true,
})

const toast = useToast()
const isDeleting = ref<string | null>(null)

const dataSourceLabels: Record<string, string> = {
  assets: 'Assets',
  work_orders: 'Work Orders',
  maintenance_schedules: 'Maintenance Schedules',
  fuel_transactions: 'Fuel Transactions',
  inspections: 'Inspections',
}

const dataSourceIcons: Record<string, string> = {
  assets: 'i-lucide-truck',
  work_orders: 'i-lucide-wrench',
  maintenance_schedules: 'i-lucide-calendar',
  fuel_transactions: 'i-lucide-fuel',
  inspections: 'i-lucide-clipboard-check',
}

function getDataSourceLabel(source: string): string {
  return dataSourceLabels[source] || source
}

function getDataSourceIcon(source: string): string {
  return dataSourceIcons[source] || 'i-lucide-file'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function deleteReport(report: CustomReport) {
  if (!confirm(`Are you sure you want to delete "${report.name}"?`)) {
    return
  }

  isDeleting.value = report.id

  try {
    await $fetch(`/api/reports/custom/${report.id}`, {
      method: 'DELETE',
    })

    toast.add({
      title: 'Report Deleted',
      description: `"${report.name}" has been deleted`,
      color: 'success',
    })

    refresh()
  } catch (error) {
    console.error('Failed to delete report:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to delete report',
      color: 'error',
    })
  } finally {
    isDeleting.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="custom-reports">
    <template #header>
      <UDashboardNavbar title="Custom Reports">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/reports" />
        </template>
        <template #right>
          <UButton label="Create Report" icon="i-lucide-plus" to="/reports/custom/builder" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="!reports?.length" class="text-center py-12">
        <UIcon name="i-lucide-file-text" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">No custom reports yet</h3>
        <p class="text-muted mb-4">Create your first custom report to get started</p>
        <UButton label="Create Report" icon="i-lucide-plus" to="/reports/custom/builder" />
      </div>

      <div v-else class="space-y-4">
        <UCard
          v-for="report in reports"
          :key="report.id"
          class="hover:shadow-md transition-shadow cursor-pointer group"
          @click="navigateTo(`/reports/custom/builder?id=${report.id}`)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4 flex-1 min-w-0">
              <div
                class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-primary/10"
              >
                <UIcon :name="getDataSourceIcon(report.dataSource)" class="w-5 h-5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold text-highlighted truncate">
                    {{ report.name }}
                  </h3>
                  <UBadge v-if="report.isShared" color="info" variant="subtle" size="xs">
                    Shared
                  </UBadge>
                </div>
                <p v-if="report.description" class="text-sm text-muted line-clamp-1 mb-2">
                  {{ report.description }}
                </p>
                <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-database" class="w-3 h-3" />
                    {{ getDataSourceLabel(report.dataSource) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-user" class="w-3 h-3" />
                    {{ report.user.firstName }} {{ report.user.lastName }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-play" class="w-3 h-3" />
                    Last run: {{ formatDate(report.lastRunAt) }}
                  </span>
                </div>
              </div>
            </div>
            <div
              class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <UButton
                icon="i-lucide-play"
                color="success"
                variant="soft"
                size="sm"
                title="Run Report"
                @click.stop="navigateTo(`/reports/custom/builder?id=${report.id}&run=true`)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="soft"
                size="sm"
                title="Edit Report"
                @click.stop="navigateTo(`/reports/custom/builder?id=${report.id}`)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="soft"
                size="sm"
                title="Delete Report"
                :loading="isDeleting === report.id"
                @click.stop="deleteReport(report)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
