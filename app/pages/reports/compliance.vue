<script setup lang="ts">
/**
 * Compliance Report Page (US-14.6)
 *
 * Features:
 * - Pre-start inspection completion rate
 * - Scheduled maintenance compliance (on-time vs overdue)
 * - Certification status (valid, expiring soon, expired)
 * - Overdue items highlighted prominently
 * - Date range filtering
 * - Asset/category filtering
 * - Export to CSV
 */

import { format, sub } from 'date-fns'
import type { Range } from '~/types'

definePageMeta({
  middleware: 'auth',
})

// State
const dateRange = shallowRef<Range>({
  start: sub(new Date(), { days: 30 }),
  end: new Date(),
})
const selectedAssetId = ref('')
const selectedCategoryId = ref('')
const activeTab = ref('overview')
const isExporting = ref(false)

const toast = useToast()
const router = useRouter()

// Query params for API
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (dateRange.value.start) {
    params.startDate = dateRange.value.start.toISOString()
  }
  if (dateRange.value.end) {
    params.endDate = dateRange.value.end.toISOString()
  }
  if (selectedAssetId.value) {
    params.assetId = selectedAssetId.value
  }
  if (selectedCategoryId.value) {
    params.categoryId = selectedCategoryId.value
  }
  return params
})

// Report data types
interface PreStartComplianceMetrics {
  totalRequired: number
  totalCompleted: number
  completionRate: number
  assetsWithInspections: number
  assetsWithoutInspections: number
}

interface MaintenanceComplianceMetrics {
  totalScheduled: number
  completedOnTime: number
  completedLate: number
  overdue: number
  complianceRate: number
}

interface CertificationStatusMetrics {
  valid: number
  expiringSoon: number
  expired: number
}

interface OverdueMaintenanceItem {
  id: string
  name: string
  assetId: string
  assetNumber: string
  assetMake: string | null
  assetModel: string | null
  nextDueDate: string | null
  daysOverdue: number
  scheduleType: string
}

interface ExpiredCertificationItem {
  id: string
  documentName: string
  assetId: string | null
  assetNumber: string | null
  assetMake: string | null
  assetModel: string | null
  expiryDate: string | null
  daysExpired: number
  category: string
}

interface ComplianceReportResponse {
  preStartCompliance: PreStartComplianceMetrics
  maintenanceCompliance: MaintenanceComplianceMetrics
  certificationStatus: CertificationStatusMetrics
  overdueItems: {
    maintenance: OverdueMaintenanceItem[]
    certifications: ExpiredCertificationItem[]
  }
  summary: {
    overallComplianceScore: number
    totalOverdueItems: number
    criticalItems: number
  }
}

// Fetch report data
const { data: reportData, status } = await useFetch<ComplianceReportResponse>(
  '/api/reports/compliance',
  {
    lazy: true,
    query: queryParams,
  },
)

// Fetch assets for filter
interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

const { data: assetsData } = await useFetch<{ data: Asset[] }>('/api/assets', { lazy: true })

const assetOptions = computed(() => [
  { label: 'All Assets', value: '' },
  ...(assetsData.value?.data?.map((a: Asset) => ({
    label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
    value: a.id,
  })) || []),
])

// Fetch categories for filter
interface Category {
  id: string
  name: string
}

const { data: categoriesData } = await useFetch<Category[]>('/api/asset-categories', { lazy: true })

const categoryOptions = computed(() => [
  { label: 'All Categories', value: '' },
  ...(categoriesData.value?.map((c: Category) => ({
    label: c.name,
    value: c.id,
  })) || []),
])

// Helper functions
type ColorType = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

function getComplianceColor(rate: number): ColorType {
  if (rate >= 90) return 'success'
  if (rate >= 70) return 'warning'
  return 'error'
}

function getOverallScoreColor(score: number): ColorType {
  if (score >= 85) return 'success'
  if (score >= 70) return 'warning'
  return 'error'
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '0%'
  return `${value.toFixed(1)}%`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return format(new Date(dateStr), 'MMM d, yyyy')
}

// Summary cards data
const summaryCards = computed(() => {
  if (!reportData.value) return []

  const data = reportData.value
  return [
    {
      title: 'Overall Compliance',
      value: formatPercent(data.summary.overallComplianceScore),
      icon: 'i-lucide-shield-check',
      color: getOverallScoreColor(data.summary.overallComplianceScore),
      description: 'Weighted compliance score',
    },
    {
      title: 'Pre-Start Inspections',
      value: formatPercent(data.preStartCompliance.completionRate),
      icon: 'i-lucide-clipboard-check',
      color: getComplianceColor(data.preStartCompliance.completionRate),
      description: `${data.preStartCompliance.totalCompleted} of ${data.preStartCompliance.totalRequired} completed`,
    },
    {
      title: 'Maintenance On-Time',
      value: formatPercent(data.maintenanceCompliance.complianceRate),
      icon: 'i-lucide-wrench',
      color: getComplianceColor(data.maintenanceCompliance.complianceRate),
      description: `${data.maintenanceCompliance.overdue} overdue schedules`,
    },
    {
      title: 'Overdue Items',
      value: data.summary.totalOverdueItems.toString(),
      icon: 'i-lucide-alert-triangle',
      color: data.summary.totalOverdueItems > 0 ? 'error' : 'success',
      description: `${data.summary.criticalItems} critical (>7 days)`,
    },
  ]
})

// Certification breakdown
const certificationBreakdown = computed(() => {
  if (!reportData.value) return []

  const cert = reportData.value.certificationStatus
  const total = cert.valid + cert.expiringSoon + cert.expired

  return [
    {
      label: 'Valid',
      value: cert.valid,
      percent: total > 0 ? ((cert.valid / total) * 100).toFixed(1) : '0',
      color: 'bg-success',
    },
    {
      label: 'Expiring Soon',
      value: cert.expiringSoon,
      percent: total > 0 ? ((cert.expiringSoon / total) * 100).toFixed(1) : '0',
      color: 'bg-warning',
    },
    {
      label: 'Expired',
      value: cert.expired,
      percent: total > 0 ? ((cert.expired / total) * 100).toFixed(1) : '0',
      color: 'bg-error',
    },
  ]
})

// Tab configuration
const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard' },
  { label: 'Overdue Items', value: 'overdue', icon: 'i-lucide-alert-circle' },
]

// Export to CSV
async function exportToCSV() {
  if (!reportData.value) {
    toast.add({
      title: 'No Data',
      description: 'No data available to export',
      color: 'warning',
    })
    return
  }

  isExporting.value = true

  try {
    const data = reportData.value
    const lines: string[] = []

    // Summary section
    lines.push('COMPLIANCE REPORT SUMMARY')
    lines.push(
      `Date Range,${format(dateRange.value.start, 'yyyy-MM-dd')},${format(dateRange.value.end, 'yyyy-MM-dd')}`,
    )
    lines.push('')
    lines.push(`Overall Compliance Score,${data.summary.overallComplianceScore.toFixed(1)}%`)
    lines.push(`Total Overdue Items,${data.summary.totalOverdueItems}`)
    lines.push(`Critical Items (>7 days),${data.summary.criticalItems}`)
    lines.push('')

    // Pre-start section
    lines.push('PRE-START INSPECTION COMPLIANCE')
    lines.push(`Completion Rate,${data.preStartCompliance.completionRate.toFixed(1)}%`)
    lines.push(`Total Required,${data.preStartCompliance.totalRequired}`)
    lines.push(`Total Completed,${data.preStartCompliance.totalCompleted}`)
    lines.push(`Assets With Inspections,${data.preStartCompliance.assetsWithInspections}`)
    lines.push(`Assets Without Inspections,${data.preStartCompliance.assetsWithoutInspections}`)
    lines.push('')

    // Maintenance section
    lines.push('MAINTENANCE COMPLIANCE')
    lines.push(`Compliance Rate,${data.maintenanceCompliance.complianceRate.toFixed(1)}%`)
    lines.push(`Total Scheduled,${data.maintenanceCompliance.totalScheduled}`)
    lines.push(`Completed On Time,${data.maintenanceCompliance.completedOnTime}`)
    lines.push(`Completed Late,${data.maintenanceCompliance.completedLate}`)
    lines.push(`Overdue,${data.maintenanceCompliance.overdue}`)
    lines.push('')

    // Certification section
    lines.push('CERTIFICATION STATUS')
    lines.push(`Valid,${data.certificationStatus.valid}`)
    lines.push(`Expiring Soon (30 days),${data.certificationStatus.expiringSoon}`)
    lines.push(`Expired,${data.certificationStatus.expired}`)
    lines.push('')

    // Overdue maintenance
    if (data.overdueItems.maintenance.length > 0) {
      lines.push('OVERDUE MAINTENANCE')
      lines.push('Schedule Name,Asset Number,Asset Make,Asset Model,Due Date,Days Overdue,Type')
      for (const item of data.overdueItems.maintenance) {
        lines.push(
          [
            `"${item.name}"`,
            item.assetNumber,
            item.assetMake || '',
            item.assetModel || '',
            item.nextDueDate ? format(new Date(item.nextDueDate), 'yyyy-MM-dd') : '',
            item.daysOverdue,
            item.scheduleType,
          ].join(','),
        )
      }
      lines.push('')
    }

    // Expired certifications
    if (data.overdueItems.certifications.length > 0) {
      lines.push('EXPIRED CERTIFICATIONS')
      lines.push('Document Name,Asset Number,Asset Make,Asset Model,Expiry Date,Days Expired')
      for (const item of data.overdueItems.certifications) {
        lines.push(
          [
            `"${item.documentName}"`,
            item.assetNumber || '',
            item.assetMake || '',
            item.assetModel || '',
            item.expiryDate ? format(new Date(item.expiryDate), 'yyyy-MM-dd') : '',
            item.daysExpired,
          ].join(','),
        )
      }
    }

    const csvContent = lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compliance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.add({
      title: 'Export Complete',
      description: 'Report has been downloaded',
      color: 'success',
    })
  } catch (error) {
    console.error('Export failed:', error)
    toast.add({
      title: 'Export Failed',
      description: 'Failed to export report',
      color: 'error',
    })
  } finally {
    isExporting.value = false
  }
}

// Quick date range presets
function setDateRange(days: number) {
  dateRange.value = {
    start: sub(new Date(), { days }),
    end: new Date(),
  }
}

// Clear filters
function clearFilters() {
  selectedAssetId.value = ''
  selectedCategoryId.value = ''
  dateRange.value = {
    start: sub(new Date(), { days: 30 }),
    end: new Date(),
  }
}
</script>

<template>
  <UDashboardPanel id="compliance-report">
    <template #header>
      <UDashboardNavbar title="Compliance Report">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/reports"
          />
        </template>
        <template #right>
          <UButton
            label="Export CSV"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :loading="isExporting"
            @click="exportToCSV"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UButtonGroup>
            <UButton
              label="7 Days"
              :color="Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)) === 7 ? 'primary' : 'neutral'"
              variant="soft"
              size="sm"
              @click="setDateRange(7)"
            />
            <UButton
              label="30 Days"
              :color="Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)) === 30 ? 'primary' : 'neutral'"
              variant="soft"
              size="sm"
              @click="setDateRange(30)"
            />
            <UButton
              label="90 Days"
              :color="Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)) === 90 ? 'primary' : 'neutral'"
              variant="soft"
              size="sm"
              @click="setDateRange(90)"
            />
          </UButtonGroup>

          <USelect
            v-model="selectedAssetId"
            :items="assetOptions"
            placeholder="Filter by asset"
            class="min-w-48"
          />

          <USelect
            v-model="selectedCategoryId"
            :items="categoryOptions"
            placeholder="Filter by category"
            class="min-w-40"
          />

          <UButton
            v-if="selectedAssetId || selectedCategoryId"
            label="Clear Filters"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearFilters"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-20">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <template v-else-if="reportData">
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <UCard
            v-for="(card, index) in summaryCards"
            :key="index"
            :ui="{ body: 'p-4' }"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center w-10 h-10 rounded-lg"
                :class="{
                  'bg-success-100 dark:bg-success-900/30': card.color === 'success',
                  'bg-warning-100 dark:bg-warning-900/30': card.color === 'warning',
                  'bg-error-100 dark:bg-error-900/30': card.color === 'error',
                  'bg-info-100 dark:bg-info-900/30': card.color === 'info',
                }"
              >
                <UIcon
                  :name="card.icon"
                  class="w-5 h-5"
                  :class="{
                    'text-success-600 dark:text-success-400': card.color === 'success',
                    'text-warning-600 dark:text-warning-400': card.color === 'warning',
                    'text-error-600 dark:text-error-400': card.color === 'error',
                    'text-info-600 dark:text-info-400': card.color === 'info',
                  }"
                />
              </div>
              <div>
                <p class="text-sm text-muted">{{ card.title }}</p>
                <p class="text-2xl font-semibold text-highlighted tabular-nums">
                  {{ card.value }}
                </p>
                <p v-if="card.description" class="text-xs text-muted">
                  {{ card.description }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Tabs -->
        <UTabs
          v-model="activeTab"
          :items="tabs"
          class="mb-6"
        />

        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Pre-Start Compliance Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-clipboard-check" class="w-5 h-5 text-primary" />
                <h3 class="font-semibold text-highlighted">Pre-Start Inspection Compliance</h3>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-muted">Completion Rate</span>
                <UBadge
                  :color="getComplianceColor(reportData.preStartCompliance.completionRate)"
                  variant="subtle"
                  size="lg"
                >
                  {{ formatPercent(reportData.preStartCompliance.completionRate) }}
                </UBadge>
              </div>

              <UProgress
                :value="reportData.preStartCompliance.completionRate"
                :color="getComplianceColor(reportData.preStartCompliance.completionRate)"
                size="lg"
              />

              <div class="grid grid-cols-2 gap-4 pt-2">
                <div class="text-center p-3 bg-elevated rounded-lg">
                  <p class="text-2xl font-bold text-success">
                    {{ reportData.preStartCompliance.assetsWithInspections }}
                  </p>
                  <p class="text-xs text-muted">Assets Inspected</p>
                </div>
                <div class="text-center p-3 bg-elevated rounded-lg">
                  <p class="text-2xl font-bold text-error">
                    {{ reportData.preStartCompliance.assetsWithoutInspections }}
                  </p>
                  <p class="text-xs text-muted">Not Inspected</p>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Maintenance Compliance Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-wrench" class="w-5 h-5 text-warning" />
                <h3 class="font-semibold text-highlighted">Maintenance Compliance</h3>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-muted">On-Time Rate</span>
                <UBadge
                  :color="getComplianceColor(reportData.maintenanceCompliance.complianceRate)"
                  variant="subtle"
                  size="lg"
                >
                  {{ formatPercent(reportData.maintenanceCompliance.complianceRate) }}
                </UBadge>
              </div>

              <UProgress
                :value="reportData.maintenanceCompliance.complianceRate"
                :color="getComplianceColor(reportData.maintenanceCompliance.complianceRate)"
                size="lg"
              />

              <div class="grid grid-cols-3 gap-3 pt-2">
                <div class="text-center p-3 bg-elevated rounded-lg">
                  <p class="text-xl font-bold text-success">
                    {{ reportData.maintenanceCompliance.completedOnTime }}
                  </p>
                  <p class="text-xs text-muted">On Time</p>
                </div>
                <div class="text-center p-3 bg-elevated rounded-lg">
                  <p class="text-xl font-bold text-warning">
                    {{ reportData.maintenanceCompliance.completedLate }}
                  </p>
                  <p class="text-xs text-muted">Late</p>
                </div>
                <div class="text-center p-3 bg-elevated rounded-lg">
                  <p class="text-xl font-bold text-error">
                    {{ reportData.maintenanceCompliance.overdue }}
                  </p>
                  <p class="text-xs text-muted">Overdue</p>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Certification Status Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-file-badge" class="w-5 h-5 text-info" />
                <h3 class="font-semibold text-highlighted">Certification Status</h3>
              </div>
            </template>

            <div class="space-y-4">
              <div
                v-for="item in certificationBreakdown"
                :key="item.label"
                class="flex items-center gap-3"
              >
                <div :class="[item.color, 'w-4 h-4 rounded-full shrink-0']" />
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm">{{ item.label }}</span>
                    <span class="text-sm font-medium">
                      {{ item.value }}
                      <span class="text-muted">({{ item.percent }}%)</span>
                    </span>
                  </div>
                  <UProgress
                    :value="Number(item.percent)"
                    :color="item.label === 'Valid' ? 'success' : item.label === 'Expiring Soon' ? 'warning' : 'error'"
                    size="xs"
                  />
                </div>
              </div>

              <div
                v-if="certificationBreakdown.every(c => c.value === 0)"
                class="text-center text-muted py-4"
              >
                No certifications found
              </div>
            </div>
          </UCard>

          <!-- Quick Actions Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-zap" class="w-5 h-5 text-primary" />
                <h3 class="font-semibold text-highlighted">Quick Actions</h3>
              </div>
            </template>

            <div class="space-y-3">
              <UButton
                v-if="reportData.maintenanceCompliance.overdue > 0"
                label="View Overdue Maintenance"
                icon="i-lucide-alert-circle"
                color="error"
                variant="soft"
                block
                @click="activeTab = 'overdue'"
              />
              <UButton
                v-if="reportData.certificationStatus.expired > 0"
                label="View Expired Certifications"
                icon="i-lucide-file-x"
                color="error"
                variant="soft"
                block
                @click="activeTab = 'overdue'"
              />
              <UButton
                label="View All Inspections"
                icon="i-lucide-clipboard-list"
                color="neutral"
                variant="soft"
                block
                @click="router.push('/inspections/history')"
              />
              <UButton
                label="View Maintenance Schedules"
                icon="i-lucide-calendar"
                color="neutral"
                variant="soft"
                block
                @click="router.push('/maintenance/schedules')"
              />
            </div>
          </UCard>
        </div>

        <!-- Overdue Items Tab -->
        <div v-if="activeTab === 'overdue'" class="space-y-6">
          <!-- Overdue Maintenance -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-wrench" class="w-5 h-5 text-error" />
                  <h3 class="font-semibold text-highlighted">Overdue Maintenance</h3>
                </div>
                <UBadge
                  v-if="reportData.overdueItems.maintenance.length > 0"
                  color="error"
                  variant="subtle"
                >
                  {{ reportData.overdueItems.maintenance.length }} items
                </UBadge>
              </div>
            </template>

            <div
              v-if="reportData.overdueItems.maintenance.length === 0"
              class="text-center py-8"
            >
              <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-success mx-auto mb-3" />
              <p class="text-lg font-medium text-highlighted">No Overdue Maintenance</p>
              <p class="text-muted">All maintenance schedules are up to date</p>
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-default">
                    <th class="text-left py-3 px-4 font-medium">Schedule</th>
                    <th class="text-left py-3 px-4 font-medium">Asset</th>
                    <th class="text-left py-3 px-4 font-medium">Due Date</th>
                    <th class="text-left py-3 px-4 font-medium">Overdue</th>
                    <th class="text-left py-3 px-4 font-medium">Type</th>
                    <th class="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in reportData.overdueItems.maintenance"
                    :key="item.id"
                    class="border-b border-default"
                    :class="{ 'bg-error/5': item.daysOverdue > 7 }"
                  >
                    <td class="py-3 px-4">
                      <p class="font-medium">{{ item.name }}</p>
                    </td>
                    <td class="py-3 px-4">
                      <p class="font-medium">{{ item.assetNumber }}</p>
                      <p class="text-xs text-muted">
                        {{ item.assetMake || '' }} {{ item.assetModel || '' }}
                      </p>
                    </td>
                    <td class="py-3 px-4">
                      {{ formatDate(item.nextDueDate) }}
                    </td>
                    <td class="py-3 px-4">
                      <UBadge
                        :color="item.daysOverdue > 7 ? 'error' : 'warning'"
                        variant="subtle"
                      >
                        {{ item.daysOverdue }} days
                      </UBadge>
                    </td>
                    <td class="py-3 px-4 capitalize">
                      {{ item.scheduleType.replace('_', ' ') }}
                    </td>
                    <td class="py-3 px-4">
                      <UButton
                        icon="i-lucide-eye"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="router.push(`/assets/${item.assetId}`)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>

          <!-- Expired Certifications -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-file-x" class="w-5 h-5 text-error" />
                  <h3 class="font-semibold text-highlighted">Expired Certifications</h3>
                </div>
                <UBadge
                  v-if="reportData.overdueItems.certifications.length > 0"
                  color="error"
                  variant="subtle"
                >
                  {{ reportData.overdueItems.certifications.length }} items
                </UBadge>
              </div>
            </template>

            <div
              v-if="reportData.overdueItems.certifications.length === 0"
              class="text-center py-8"
            >
              <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-success mx-auto mb-3" />
              <p class="text-lg font-medium text-highlighted">No Expired Certifications</p>
              <p class="text-muted">All certifications are valid or expiring soon</p>
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-default">
                    <th class="text-left py-3 px-4 font-medium">Document</th>
                    <th class="text-left py-3 px-4 font-medium">Asset</th>
                    <th class="text-left py-3 px-4 font-medium">Expiry Date</th>
                    <th class="text-left py-3 px-4 font-medium">Expired</th>
                    <th class="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in reportData.overdueItems.certifications"
                    :key="item.id"
                    class="border-b border-default"
                    :class="{ 'bg-error/5': item.daysExpired > 7 }"
                  >
                    <td class="py-3 px-4">
                      <p class="font-medium">{{ item.documentName }}</p>
                    </td>
                    <td class="py-3 px-4">
                      <template v-if="item.assetNumber">
                        <p class="font-medium">{{ item.assetNumber }}</p>
                        <p class="text-xs text-muted">
                          {{ item.assetMake || '' }} {{ item.assetModel || '' }}
                        </p>
                      </template>
                      <span v-else class="text-muted">-</span>
                    </td>
                    <td class="py-3 px-4">
                      {{ formatDate(item.expiryDate) }}
                    </td>
                    <td class="py-3 px-4">
                      <UBadge
                        :color="item.daysExpired > 7 ? 'error' : 'warning'"
                        variant="subtle"
                      >
                        {{ item.daysExpired }} days
                      </UBadge>
                    </td>
                    <td class="py-3 px-4">
                      <UButton
                        v-if="item.assetId"
                        icon="i-lucide-eye"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="router.push(`/assets/${item.assetId}`)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
        </div>
      </template>

      <!-- Empty/Error State -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-20"
      >
        <UIcon name="i-lucide-file-warning" class="w-12 h-12 text-muted mb-4" />
        <p class="text-lg font-medium text-highlighted mb-2">Unable to load report</p>
        <p class="text-muted">Please try again later or adjust your filters</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
