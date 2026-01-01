<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

type BadgeColor = 'error' | 'info' | 'success' | 'primary' | 'secondary' | 'warning' | 'neutral'

interface AlertCategory {
  id: string
  name: string
  description: string
  icon: string
  color: BadgeColor
  link: string
}

// Alert rule categories
const categories: AlertCategory[] = [
  {
    id: 'fuel',
    name: 'Fuel Anomalies',
    description: 'Configure alerts for unusual fuel consumption patterns',
    icon: 'i-lucide-fuel',
    color: 'warning',
    link: '/admin/alert-rules/fuel',
  },
  {
    id: 'geofence',
    name: 'Geofence Alerts',
    description: 'Configure entry, exit, and after-hours movement alerts',
    icon: 'i-lucide-map-pin',
    color: 'primary',
    link: '/geofences',
  },
  {
    id: 'dtc',
    name: 'DTC Work Order Rules',
    description: 'Automatically create work orders for diagnostic trouble codes',
    icon: 'i-lucide-alert-triangle',
    color: 'error',
    link: '/admin/alert-rules/dtc',
  },
  {
    id: 'maintenance',
    name: 'Maintenance Schedules',
    description: 'Configure maintenance interval and threshold alerts',
    icon: 'i-lucide-wrench',
    color: 'success',
    link: '/maintenance-schedules',
  },
  {
    id: 'documents',
    name: 'Document Expiry',
    description: 'Alert thresholds for expiring documents and certifications',
    icon: 'i-lucide-file-warning',
    color: 'warning',
    link: '/admin/alert-rules/documents',
  },
  {
    id: 'inventory',
    name: 'Low Stock Alerts',
    description: 'Configure reorder thresholds for parts inventory',
    icon: 'i-lucide-package',
    color: 'neutral',
    link: '/parts',
  },
]

// Fetch recent alerts summary
const { data: alertsSummary, status: summaryStatus } = await useFetch('/api/admin/alerts/summary', {
  default: () => ({
    totalToday: 0,
    unacknowledged: 0,
    byType: {} as Record<string, number>,
  }),
})

// Get alert type counts
const alertTypeCounts = computed(() => {
  const counts: Record<string, number> = alertsSummary.value?.byType ?? {}
  return {
    fuel: counts.fuel_anomaly ?? 0,
    geofence:
      (counts.geofence_entry ?? 0) +
      (counts.geofence_exit ?? 0) +
      (counts.after_hours_movement ?? 0),
    dtc: counts.dtc_work_order ?? 0,
    maintenance: counts.maintenance_due ?? 0,
    documents: counts.document_expiring ?? 0,
    inventory: counts.low_stock ?? 0,
  }
})
</script>

<template>
  <UDashboardPanel id="alert-rules">
    <template #header>
      <UDashboardNavbar title="Alert Rules">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton to="/admin/alert-rules/history" color="neutral" variant="ghost" icon="i-lucide-history">
            Alert History
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Summary Cards -->
      <div v-if="summaryStatus !== 'pending'" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <UPageCard class="text-center">
          <template #header>
            <span class="text-sm text-muted">Alerts Today</span>
          </template>
          <div class="text-3xl font-bold">{{ alertsSummary?.totalToday ?? 0 }}</div>
        </UPageCard>

        <UPageCard class="text-center">
          <template #header>
            <span class="text-sm text-muted">Unacknowledged</span>
          </template>
          <div class="text-3xl font-bold text-warning">{{ alertsSummary?.unacknowledged ?? 0 }}</div>
        </UPageCard>

        <UPageCard class="text-center">
          <template #header>
            <span class="text-sm text-muted">Active Rules</span>
          </template>
          <div class="text-3xl font-bold text-success">{{ categories.length }}</div>
        </UPageCard>
      </div>

      <!-- Alert Categories -->
      <h2 class="text-lg font-semibold mb-4">Configure Alert Rules</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="category.link"
          class="block group"
        >
          <UPageCard
            class="h-full transition-all group-hover:ring-2 ring-primary"
            :ui="{ container: 'flex items-start gap-4' }"
          >
            <div
              class="shrink-0 size-12 rounded-lg flex items-center justify-center"
              :class="{
                'bg-warning/10 text-warning': category.color === 'warning',
                'bg-primary/10 text-primary': category.color === 'primary',
                'bg-error/10 text-error': category.color === 'error',
                'bg-success/10 text-success': category.color === 'success',
                'bg-default text-muted': category.color === 'neutral',
              }"
            >
              <UIcon :name="category.icon" class="size-6" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold truncate">{{ category.name }}</h3>
                <UBadge
                  v-if="alertTypeCounts[category.id as keyof typeof alertTypeCounts] > 0"
                  :color="category.color === 'neutral' ? 'info' : (category.color as BadgeColor)"
                  variant="subtle"
                  size="xs"
                >
                  {{ alertTypeCounts[category.id as keyof typeof alertTypeCounts] }} today
                </UBadge>
              </div>
              <p class="text-sm text-muted mt-1">{{ category.description }}</p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-muted shrink-0" />
          </UPageCard>
        </NuxtLink>
      </div>

      <!-- Quick Actions -->
      <h2 class="text-lg font-semibold mt-8 mb-4">Quick Actions</h2>
      <div class="flex flex-wrap gap-3">
        <UButton to="/admin/alert-rules/fuel" variant="soft" icon="i-lucide-settings">
          Fuel Alert Settings
        </UButton>
        <UButton to="/geofences?tab=alerts" variant="soft" icon="i-lucide-map-pin">
          Geofence Alert Settings
        </UButton>
        <UButton to="/admin/alert-rules/dtc" variant="soft" icon="i-lucide-code">
          DTC Rules
        </UButton>
        <UButton to="/maintenance-schedules" variant="soft" icon="i-lucide-calendar">
          Maintenance Thresholds
        </UButton>
      </div>
    </template>
  </UDashboardPanel>
</template>
