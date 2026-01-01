<script setup lang="ts">
/**
 * Fleet Compliance Report Page
 *
 * Features:
 * - Date range picker for filtering
 * - Optional vehicle filter dropdown
 * - Per-vehicle compliance table: vehicle, inspection status, registration status, insurance status, overall status
 * - Summary cards showing aggregate counts for registration/insurance/inspection status
 * - Color-coded status badges (green=valid, yellow=expiring_soon, red=expired/missing)
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
const selectedVehicleId = ref('')
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
  if (selectedVehicleId.value) {
    params.vehicleId = selectedVehicleId.value
  }
  return params
})

// Report data types
interface VehicleComplianceRecord {
  assetId: string
  assetNumber: string
  make: string | null
  model: string | null
  inspectionStatus: 'compliant' | 'non_compliant' | 'pending'
  registrationStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  insuranceStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  registrationExpiry: string | null
  insuranceExpiry: string | null
  lastInspectionDate: string | null
  overallStatus: 'compliant' | 'at_risk' | 'non_compliant'
}

interface ComplianceReportResponse {
  vehicleCompliance: VehicleComplianceRecord[]
  inspectionStatus: {
    totalVehicles: number
    vehiclesInspected: number
    vehiclesNotInspected: number
    complianceRate: number
  }
  registrationStatus: {
    valid: number
    expiringSoon: number
    expired: number
    missing: number
  }
  insuranceStatus: {
    valid: number
    expiringSoon: number
    expired: number
    missing: number
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

// Fetch vehicles for filter
interface Vehicle {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
}

const { data: vehiclesData } = await useFetch<{ data: Vehicle[] }>('/api/assets', { lazy: true })

const vehicleOptions = computed(() => [
  { label: 'All Vehicles', value: '' },
  ...(vehiclesData.value?.data?.map((v: Vehicle) => ({
    label: `${v.assetNumber} - ${v.make || ''} ${v.model || ''}`.trim(),
    value: v.id,
  })) || []),
])

// Status color mappings
type StatusColor = 'success' | 'warning' | 'error' | 'neutral'

function getStatusColor(status: string): StatusColor {
  switch (status) {
    case 'valid':
    case 'compliant':
      return 'success'
    case 'expiring_soon':
    case 'at_risk':
    case 'pending':
      return 'warning'
    case 'expired':
    case 'missing':
    case 'non_compliant':
      return 'error'
    default:
      return 'neutral'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'expiring_soon':
      return 'Expiring Soon'
    case 'expired':
      return 'Expired'
    case 'missing':
      return 'Missing'
    case 'compliant':
      return 'Compliant'
    case 'non_compliant':
      return 'Non-Compliant'
    case 'pending':
      return 'Pending'
    case 'at_risk':
      return 'At Risk'
    default:
      return status
  }
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
      value: `${data.summary.overallComplianceScore.toFixed(1)}%`,
      icon: 'i-lucide-shield-check',
      color:
        data.summary.overallComplianceScore >= 90
          ? 'success'
          : data.summary.overallComplianceScore >= 70
            ? 'warning'
            : 'error',
      description: 'Fleet compliance score',
    },
    {
      title: 'Inspections',
      value: `${data.inspectionStatus.vehiclesInspected}/${data.inspectionStatus.totalVehicles}`,
      icon: 'i-lucide-clipboard-check',
      color:
        data.inspectionStatus.complianceRate >= 90
          ? 'success'
          : data.inspectionStatus.complianceRate >= 70
            ? 'warning'
            : 'error',
      description: `${data.inspectionStatus.complianceRate.toFixed(1)}% inspected`,
    },
    {
      title: 'Registrations',
      value: data.registrationStatus.valid.toString(),
      icon: 'i-lucide-file-text',
      color:
        data.registrationStatus.expired > 0 || data.registrationStatus.missing > 0
          ? 'error'
          : data.registrationStatus.expiringSoon > 0
            ? 'warning'
            : 'success',
      description: `${data.registrationStatus.expired + data.registrationStatus.missing} need attention`,
    },
    {
      title: 'Insurance',
      value: data.insuranceStatus.valid.toString(),
      icon: 'i-lucide-shield',
      color:
        data.insuranceStatus.expired > 0 || data.insuranceStatus.missing > 0
          ? 'error'
          : data.insuranceStatus.expiringSoon > 0
            ? 'warning'
            : 'success',
      description: `${data.insuranceStatus.expired + data.insuranceStatus.missing} need attention`,
    },
  ]
})

// Status breakdown data
const registrationBreakdown = computed(() => {
  if (!reportData.value) return []
  const reg = reportData.value.registrationStatus
  return [
    { label: 'Valid', value: reg.valid, color: 'success' as const },
    { label: 'Expiring Soon', value: reg.expiringSoon, color: 'warning' as const },
    { label: 'Expired', value: reg.expired, color: 'error' as const },
    { label: 'Missing', value: reg.missing, color: 'neutral' as const },
  ]
})

const insuranceBreakdown = computed(() => {
  if (!reportData.value) return []
  const ins = reportData.value.insuranceStatus
  return [
    { label: 'Valid', value: ins.valid, color: 'success' as const },
    { label: 'Expiring Soon', value: ins.expiringSoon, color: 'warning' as const },
    { label: 'Expired', value: ins.expired, color: 'error' as const },
    { label: 'Missing', value: ins.missing, color: 'neutral' as const },
  ]
})

const inspectionBreakdown = computed(() => {
  if (!reportData.value) return []
  const insp = reportData.value.inspectionStatus
  return [
    { label: 'Inspected', value: insp.vehiclesInspected, color: 'success' as const },
    { label: 'Not Inspected', value: insp.vehiclesNotInspected, color: 'error' as const },
  ]
})

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

    // Header
    lines.push('FLEET COMPLIANCE REPORT')
    lines.push(
      `Date Range,${format(dateRange.value.start, 'yyyy-MM-dd')},${format(dateRange.value.end, 'yyyy-MM-dd')}`,
    )
    lines.push('')
    lines.push(`Overall Compliance Score,${data.summary.overallComplianceScore.toFixed(1)}%`)
    lines.push('')

    // Summary
    lines.push('SUMMARY')
    lines.push('Registration Status')
    lines.push(`Valid,${data.registrationStatus.valid}`)
    lines.push(`Expiring Soon,${data.registrationStatus.expiringSoon}`)
    lines.push(`Expired,${data.registrationStatus.expired}`)
    lines.push(`Missing,${data.registrationStatus.missing}`)
    lines.push('')
    lines.push('Insurance Status')
    lines.push(`Valid,${data.insuranceStatus.valid}`)
    lines.push(`Expiring Soon,${data.insuranceStatus.expiringSoon}`)
    lines.push(`Expired,${data.insuranceStatus.expired}`)
    lines.push(`Missing,${data.insuranceStatus.missing}`)
    lines.push('')
    lines.push('Inspection Status')
    lines.push(`Vehicles Inspected,${data.inspectionStatus.vehiclesInspected}`)
    lines.push(`Vehicles Not Inspected,${data.inspectionStatus.vehiclesNotInspected}`)
    lines.push(`Compliance Rate,${data.inspectionStatus.complianceRate.toFixed(1)}%`)
    lines.push('')

    // Vehicle compliance table
    lines.push('VEHICLE COMPLIANCE DETAILS')
    lines.push(
      'Vehicle Number,Make,Model,Inspection Status,Registration Status,Insurance Status,Overall Status,Registration Expiry,Insurance Expiry,Last Inspection',
    )

    for (const vehicle of data.vehicleCompliance) {
      lines.push(
        [
          vehicle.assetNumber,
          vehicle.make || '',
          vehicle.model || '',
          vehicle.inspectionStatus,
          vehicle.registrationStatus,
          vehicle.insuranceStatus,
          vehicle.overallStatus,
          vehicle.registrationExpiry
            ? format(new Date(vehicle.registrationExpiry), 'yyyy-MM-dd')
            : '',
          vehicle.insuranceExpiry ? format(new Date(vehicle.insuranceExpiry), 'yyyy-MM-dd') : '',
          vehicle.lastInspectionDate
            ? format(new Date(vehicle.lastInspectionDate), 'yyyy-MM-dd')
            : '',
        ].join(','),
      )
    }

    const csvContent = lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fleet-compliance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
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

// Clear filters
function clearFilters() {
  selectedVehicleId.value = ''
  dateRange.value = {
    start: sub(new Date(), { days: 30 }),
    end: new Date(),
  }
}
</script>

<template>
  <UDashboardPanel id="compliance-report">
    <template #header>
      <UDashboardNavbar title="Fleet Compliance Report">
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
          <ComplianceDateRangePicker v-model="dateRange" />

          <USelect
            v-model="selectedVehicleId"
            :items="vehicleOptions"
            placeholder="Filter by vehicle"
            class="min-w-48"
          />

          <UButton
            v-if="selectedVehicleId"
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
                }"
              >
                <UIcon
                  :name="card.icon"
                  class="w-5 h-5"
                  :class="{
                    'text-success-600 dark:text-success-400': card.color === 'success',
                    'text-warning-600 dark:text-warning-400': card.color === 'warning',
                    'text-error-600 dark:text-error-400': card.color === 'error',
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

        <!-- Status Breakdown Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <!-- Registration Status Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-file-text" class="w-5 h-5 text-primary" />
                <h3 class="font-semibold text-highlighted">Registration Status</h3>
              </div>
            </template>

            <div class="space-y-3">
              <div
                v-for="item in registrationBreakdown"
                :key="item.label"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :class="{
                      'bg-success': item.color === 'success',
                      'bg-warning': item.color === 'warning',
                      'bg-error': item.color === 'error',
                      'bg-neutral-400': item.color === 'neutral',
                    }"
                  />
                  <span class="text-sm">{{ item.label }}</span>
                </div>
                <UBadge :color="item.color" variant="subtle">
                  {{ item.value }}
                </UBadge>
              </div>
            </div>
          </UCard>

          <!-- Insurance Status Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-shield" class="w-5 h-5 text-info" />
                <h3 class="font-semibold text-highlighted">Insurance Status</h3>
              </div>
            </template>

            <div class="space-y-3">
              <div
                v-for="item in insuranceBreakdown"
                :key="item.label"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :class="{
                      'bg-success': item.color === 'success',
                      'bg-warning': item.color === 'warning',
                      'bg-error': item.color === 'error',
                      'bg-neutral-400': item.color === 'neutral',
                    }"
                  />
                  <span class="text-sm">{{ item.label }}</span>
                </div>
                <UBadge :color="item.color" variant="subtle">
                  {{ item.value }}
                </UBadge>
              </div>
            </div>
          </UCard>

          <!-- Inspection Status Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-clipboard-check" class="w-5 h-5 text-success" />
                <h3 class="font-semibold text-highlighted">Inspection Status</h3>
              </div>
            </template>

            <div class="space-y-3">
              <div
                v-for="item in inspectionBreakdown"
                :key="item.label"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :class="{
                      'bg-success': item.color === 'success',
                      'bg-error': item.color === 'error',
                    }"
                  />
                  <span class="text-sm">{{ item.label }}</span>
                </div>
                <UBadge :color="item.color" variant="subtle">
                  {{ item.value }}
                </UBadge>
              </div>
              <div class="pt-2 border-t border-default">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">Compliance Rate</span>
                  <span class="text-lg font-semibold">
                    {{ reportData.inspectionStatus.complianceRate.toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Per-Vehicle Compliance Table -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-truck" class="w-5 h-5 text-primary" />
                <h3 class="font-semibold text-highlighted">Vehicle Compliance</h3>
              </div>
              <UBadge v-if="reportData.vehicleCompliance.length > 0" color="neutral" variant="subtle">
                {{ reportData.vehicleCompliance.length }} vehicles
              </UBadge>
            </div>
          </template>

          <div
            v-if="reportData.vehicleCompliance.length === 0"
            class="text-center py-12"
          >
            <UIcon name="i-lucide-truck" class="w-12 h-12 text-muted mx-auto mb-4" />
            <p class="text-lg font-medium text-highlighted">No Vehicles Found</p>
            <p class="text-muted">No vehicles match the current filters</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default">
                  <th class="text-left py-3 px-4 font-medium">Vehicle</th>
                  <th class="text-center py-3 px-4 font-medium">Inspection</th>
                  <th class="text-center py-3 px-4 font-medium">Registration</th>
                  <th class="text-center py-3 px-4 font-medium">Insurance</th>
                  <th class="text-center py-3 px-4 font-medium">Overall</th>
                  <th class="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="vehicle in reportData.vehicleCompliance"
                  :key="vehicle.assetId"
                  class="border-b border-default hover:bg-elevated/50"
                  :class="{
                    'bg-error/5': vehicle.overallStatus === 'non_compliant',
                    'bg-warning/5': vehicle.overallStatus === 'at_risk',
                  }"
                >
                  <td class="py-3 px-4">
                    <p class="font-medium">{{ vehicle.assetNumber }}</p>
                    <p class="text-xs text-muted">
                      {{ vehicle.make || '' }} {{ vehicle.model || '' }}
                    </p>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <UBadge
                      :color="getStatusColor(vehicle.inspectionStatus)"
                      variant="subtle"
                      size="sm"
                    >
                      {{ getStatusLabel(vehicle.inspectionStatus) }}
                    </UBadge>
                    <p v-if="vehicle.lastInspectionDate" class="text-xs text-muted mt-1">
                      {{ formatDate(vehicle.lastInspectionDate) }}
                    </p>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <UBadge
                      :color="getStatusColor(vehicle.registrationStatus)"
                      variant="subtle"
                      size="sm"
                    >
                      {{ getStatusLabel(vehicle.registrationStatus) }}
                    </UBadge>
                    <p v-if="vehicle.registrationExpiry" class="text-xs text-muted mt-1">
                      {{ formatDate(vehicle.registrationExpiry) }}
                    </p>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <UBadge
                      :color="getStatusColor(vehicle.insuranceStatus)"
                      variant="subtle"
                      size="sm"
                    >
                      {{ getStatusLabel(vehicle.insuranceStatus) }}
                    </UBadge>
                    <p v-if="vehicle.insuranceExpiry" class="text-xs text-muted mt-1">
                      {{ formatDate(vehicle.insuranceExpiry) }}
                    </p>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <UBadge
                      :color="getStatusColor(vehicle.overallStatus)"
                      variant="solid"
                      size="sm"
                    >
                      {{ getStatusLabel(vehicle.overallStatus) }}
                    </UBadge>
                  </td>
                  <td class="py-3 px-4">
                    <UButton
                      icon="i-lucide-eye"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="router.push(`/assets/${vehicle.assetId}`)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
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
