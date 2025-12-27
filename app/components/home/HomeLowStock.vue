<script setup lang="ts">
const { data, status, refresh } = await useFetch('/api/parts/low-stock', {
  query: { includeOnOrder: 'true' },
})

const lowStockParts = computed(() => data.value?.parts || [])
const summary = computed(() => data.value?.summary)

// Auto refresh every 5 minutes
onMounted(() => {
  const interval = setInterval(refresh, 5 * 60 * 1000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <UPageCard
    title="Low Stock Alerts"
    icon="i-lucide-alert-triangle"
    variant="subtle"
    class="mt-4 sm:mt-6"
    :ui="{
      header: 'border-b border-default-200 pb-3',
      body: 'p-0',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-alert-triangle" class="size-5 text-warning" />
          <span class="font-semibold">Low Stock Alerts</span>
          <UBadge v-if="summary?.totalLowStock" color="warning" variant="subtle">
            {{ summary.totalLowStock }}
          </UBadge>
        </div>
        <NuxtLink to="/inventory/reorder-alerts" class="text-sm text-primary hover:underline">
          View all
        </NuxtLink>
      </div>
    </template>

    <div v-if="status === 'pending'" class="p-4 text-center text-muted">
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
    </div>

    <div v-else-if="lowStockParts.length === 0" class="p-4 text-center text-muted">
      <UIcon name="i-lucide-check-circle" class="size-8 text-success mb-2" />
      <p>All parts are adequately stocked</p>
    </div>

    <div v-else>
      <!-- Summary stats -->
      <div class="grid grid-cols-3 gap-4 p-4 border-b border-default-200">
        <div class="text-center">
          <div class="text-2xl font-bold text-warning">{{ summary?.totalLowStock || 0 }}</div>
          <div class="text-xs text-muted">Low Stock</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-error">{{ summary?.criticalCount || 0 }}</div>
          <div class="text-xs text-muted">Out of Stock</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-info">{{ summary?.onOrderCount || 0 }}</div>
          <div class="text-xs text-muted">On Order</div>
        </div>
      </div>

      <!-- Parts list (show first 5) -->
      <div class="divide-y divide-default-200">
        <div
          v-for="part in lowStockParts.slice(0, 5)"
          :key="part.id"
          class="flex items-center justify-between p-3 hover:bg-default-50"
        >
          <div class="flex-1 min-w-0">
            <NuxtLink :to="`/inventory/parts/${part.id}`" class="font-medium hover:text-primary">
              {{ part.name }}
            </NuxtLink>
            <div class="text-xs text-muted">{{ part.sku }}</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div
                :class="[
                  'font-semibold',
                  parseFloat(part.quantityInStock) === 0 ? 'text-error' : 'text-warning',
                ]"
              >
                {{ parseFloat(part.quantityInStock).toFixed(0) }}
              </div>
              <div class="text-xs text-muted">
                / {{ parseFloat(part.reorderThreshold || '0').toFixed(0) }}
              </div>
            </div>
            <UBadge v-if="part.isOnOrder" color="info" variant="subtle" size="xs">
              On Order
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Footer link -->
      <div v-if="lowStockParts.length > 5" class="p-3 text-center border-t border-default-200">
        <NuxtLink
          to="/inventory/reorder-alerts"
          class="text-sm text-primary hover:underline flex items-center justify-center gap-1"
        >
          View {{ lowStockParts.length - 5 }} more parts
          <UIcon name="i-lucide-arrow-right" class="size-4" />
        </NuxtLink>
      </div>
    </div>
  </UPageCard>
</template>
