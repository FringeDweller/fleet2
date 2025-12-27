<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface TechnicianWorkload {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  workload: {
    open: number
    in_progress: number
    pending_parts: number
    overdue: number
    total: number
  }
}

const router = useRouter()

const { data: technicians, status } = await useFetch<TechnicianWorkload[]>(
  '/api/technicians/workload',
  {
    lazy: true,
  },
)

function getWorkloadColor(total: number): 'success' | 'warning' | 'error' | 'info' {
  if (total === 0) return 'info'
  if (total <= 3) return 'success'
  if (total <= 6) return 'warning'
  return 'error'
}

function viewAssignedWorkOrders(technicianId: string) {
  router.push(`/work-orders?assignedToId=${technicianId}`)
}
</script>

<template>
  <UDashboardPanel id="work-order-assignments">
    <template #header>
      <UDashboardNavbar title="Technician Workload">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Back to Work Orders"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="outline"
            @click="router.push('/work-orders')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="!technicians?.length" class="text-center py-12">
        <UIcon name="i-lucide-users" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          No Technicians Found
        </h3>
        <p class="text-muted">
          There are no technicians in your organisation.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="tech in technicians"
          :key="tech.id"
          class="cursor-pointer hover:shadow-md transition-shadow"
          @click="viewAssignedWorkOrders(tech.id)"
        >
          <div class="flex items-start gap-4">
            <UAvatar
              :src="tech.avatarUrl || undefined"
              :alt="`${tech.firstName} ${tech.lastName}`"
              size="lg"
            />
            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-highlighted truncate">
                {{ tech.firstName }} {{ tech.lastName }}
              </h3>
              <p class="text-sm text-muted truncate">
                {{ tech.email }}
              </p>

              <div class="mt-3 flex items-center gap-2">
                <UBadge :color="getWorkloadColor(tech.workload.total)" variant="subtle" size="lg">
                  {{ tech.workload.total }} active
                </UBadge>
                <UBadge v-if="tech.workload.overdue > 0" color="error" variant="subtle">
                  {{ tech.workload.overdue }} overdue
                </UBadge>
              </div>

              <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div class="text-center p-2 bg-info/10 rounded">
                  <div class="font-medium text-info">
                    {{ tech.workload.open }}
                  </div>
                  <div class="text-muted text-xs">
                    Open
                  </div>
                </div>
                <div class="text-center p-2 bg-warning/10 rounded">
                  <div class="font-medium text-warning">
                    {{ tech.workload.in_progress }}
                  </div>
                  <div class="text-muted text-xs">
                    In Progress
                  </div>
                </div>
                <div class="text-center p-2 bg-warning/10 rounded">
                  <div class="font-medium text-warning">
                    {{ tech.workload.pending_parts }}
                  </div>
                  <div class="text-muted text-xs">
                    Pending
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Unassigned Work Orders Quick Link -->
      <div class="mt-8 p-4 bg-muted/30 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-medium">
              Unassigned Work Orders
            </h3>
            <p class="text-sm text-muted">
              View work orders that need to be assigned to a technician
            </p>
          </div>
          <UButton
            label="View Unassigned"
            icon="i-lucide-user-x"
            color="neutral"
            variant="outline"
            @click="router.push('/work-orders?assignedToId=null')"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
