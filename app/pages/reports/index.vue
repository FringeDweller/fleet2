<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const reports = [
  {
    title: 'Asset Utilisation',
    description:
      'Usage hours and mileage per asset compared to fleet averages. Identify underutilised assets.',
    icon: 'i-lucide-bar-chart-3',
    to: '/reports/asset-utilisation',
    color: 'primary' as const,
  },
  {
    title: 'Maintenance Costs',
    description:
      'Total cost by asset, labor vs parts breakdown, trends over time, and cost per km/hour metrics.',
    icon: 'i-lucide-wrench',
    to: '/reports/maintenance-costs',
    color: 'warning' as const,
  },
  {
    title: 'Fuel Analytics',
    description: 'Fuel consumption trends, efficiency metrics, and anomaly detection.',
    icon: 'i-lucide-fuel',
    to: '/fuel-analytics',
    color: 'success' as const,
  },
  {
    title: 'Form Data',
    description: 'Submitted custom form data and inspection results.',
    icon: 'i-lucide-clipboard-list',
    to: '/reports/forms',
    color: 'info' as const,
  },
]
</script>

<template>
  <UDashboardPanel id="reports">
    <template #header>
      <UDashboardNavbar title="Reports">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <UCard
          v-for="report in reports"
          :key="report.title"
          class="hover:shadow-lg transition-shadow cursor-pointer group"
          :ui="{ body: 'p-6' }"
          @click="navigateTo(report.to)"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-12 h-12 rounded-lg shrink-0"
              :class="{
                'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': report.color === 'primary',
                'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400': report.color === 'warning',
                'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400': report.color === 'success',
                'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400': report.color === 'info',
              }"
            >
              <UIcon :name="report.icon" class="w-6 h-6" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-base font-semibold text-highlighted truncate">
                  {{ report.title }}
                </h3>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <p class="mt-1 text-sm text-muted line-clamp-2">
                {{ report.description }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
