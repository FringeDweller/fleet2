<script setup lang="ts">
import type { AuditLogFilters } from '~/composables/useAuditLog'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const { isAdmin } = usePermissions()

// Redirect if not admin
watch(
  isAdmin,
  (val) => {
    if (val === false) {
      router.push('/')
    }
  },
  { immediate: true },
)

// Filter state - managed at page level and passed to components
const filters = ref<AuditLogFilters>({})

// Track loading state for filter component
const isLoading = ref(false)

// Handle filter updates from the filters component
function handleFilterUpdate(newFilters: AuditLogFilters) {
  filters.value = newFilters
}

// Page size options
const pageSizeOptions = [
  { value: 20, label: '20 per page' },
  { value: 50, label: '50 per page' },
  { value: 100, label: '100 per page' },
]
const pageSize = ref(20)
</script>

<template>
  <UDashboardPanel id="admin-audit-log">
    <template #header>
      <UDashboardNavbar title="Audit Log">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <USelect
            v-model="pageSize"
            :items="pageSizeOptions"
            class="w-36"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Description -->
      <div class="mb-6">
        <p class="text-muted">
          View a complete history of all actions performed in the system, including user activity, data changes, and system events.
        </p>
      </div>

      <!-- Filters -->
      <div class="mb-6">
        <AdminAuditLogFilters
          :filters="filters"
          :loading="isLoading"
          @update:filters="handleFilterUpdate"
        />
      </div>

      <!-- Audit Log Table -->
      <UCard>
        <AdminAuditLogTable
          :filters="filters"
          :page-size="pageSize"
        />
      </UCard>
    </template>
  </UDashboardPanel>
</template>
