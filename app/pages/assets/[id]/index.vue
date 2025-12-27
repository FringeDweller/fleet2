<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface Asset {
  id: string
  assetNumber: string
  vin: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  operationalHours: string | null
  mileage: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  description: string | null
  imageUrl: string | null
  isArchived: boolean
  categoryId: string | null
  category: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface CompatiblePart {
  id: string
  partId: string
  part: {
    id: string
    sku: string
    name: string
    unit: string
    quantityInStock: string
    unitCost: string | null
    category: { id: string; name: string } | null
  }
  notes: string | null
  source: 'asset' | 'category'
  createdAt: string
}

interface CompatiblePartsResponse {
  data: CompatiblePart[]
  asset: { id: string; assetNumber: string }
}

interface CostSummary {
  totalLaborCost: number
  totalPartsCost: number
  totalCost: number
  workOrderCount: number
}

interface CostWorkOrder {
  id: string
  workOrderNumber: string
  description: string | null
  completedAt: string
  laborCost: string | null
  partsCost: string | null
  totalCost: string | null
  assignedTo: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface CostsResponse {
  summary: CostSummary
  recentWorkOrders: CostWorkOrder[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { cacheAsset, getCachedAsset, isOnline } = useAssetCache()

// Tab state
const activeTab = ref((route.query.tab as string) || 'details')

const {
  data: asset,
  status,
  error,
} = await useFetch<Asset>(`/api/assets/${route.params.id}`, {
  lazy: true,
})

// Fetch compatible parts
const {
  data: compatiblePartsData,
  status: compatiblePartsStatus,
  refresh: refreshCompatibleParts,
} = await useFetch<CompatiblePartsResponse>(`/api/assets/${route.params.id}/compatible-parts`, {
  lazy: true,
})

// Fetch all parts for the add dropdown
const { data: allPartsData } = await useFetch<{
  data: { id: string; sku: string; name: string }[]
}>('/api/parts', { lazy: true })

// Fetch cost summary for this asset
const { data: costsData, status: costsStatus } = await useFetch<CostsResponse>(
  `/api/reports/costs`,
  {
    query: { assetId: route.params.id },
    lazy: true,
  },
)

// Add part modal state
const showAddPartModal = ref(false)
const addingPart = ref(false)
const selectedPartId = ref('')
const partNotes = ref('')

const availableParts = computed(() => {
  if (!allPartsData.value?.data) return []
  const assignedIds = new Set(compatiblePartsData.value?.data?.map((cp) => cp.partId) || [])
  return allPartsData.value.data
    .filter((p) => !assignedIds.has(p.id))
    .map((p) => ({ label: `${p.sku} - ${p.name}`, value: p.id }))
})

async function addPart() {
  if (!selectedPartId.value) return
  addingPart.value = true
  try {
    await $fetch(`/api/assets/${route.params.id}/compatible-parts`, {
      method: 'POST',
      body: { partId: selectedPartId.value, notes: partNotes.value || undefined },
    })
    toast.add({
      title: 'Part added',
      description: 'The part has been assigned to this asset.',
      color: 'success',
    })
    showAddPartModal.value = false
    selectedPartId.value = ''
    partNotes.value = ''
    refreshCompatibleParts()
  } catch (err: unknown) {
    const error = err as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.statusMessage || 'Failed to add part.',
      color: 'error',
    })
  } finally {
    addingPart.value = false
  }
}

async function removePart(partId: string) {
  try {
    await $fetch(`/api/assets/${route.params.id}/compatible-parts/${partId}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Part removed',
      description: 'The part has been removed from this asset.',
    })
    refreshCompatibleParts()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to remove part.',
      color: 'error',
    })
  }
}

// Cache asset for offline access when loaded
watch(
  asset,
  (newAsset) => {
    if (newAsset) {
      cacheAsset(newAsset)
    }
  },
  { immediate: true },
)

// Try to load from cache if offline and no data
const cachedAsset = ref<ReturnType<typeof getCachedAsset>>(null)
if (import.meta.client) {
  watch(
    [() => status.value, () => error.value],
    () => {
      if ((status.value === 'error' || error.value) && !isOnline.value) {
        cachedAsset.value = getCachedAsset(route.params.id as string)
      }
    },
    { immediate: true },
  )
}

const statusColors = {
  active: 'success',
  inactive: 'neutral',
  maintenance: 'warning',
  disposed: 'error',
} as const

async function archiveAsset() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/assets/${route.params.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Asset archived',
      description: 'The asset has been archived successfully.',
    })
    router.push('/assets')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive asset.',
      color: 'error',
    })
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '$0.00'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(num)
}
</script>

<template>
  <UDashboardPanel id="asset-detail">
    <template #header>
      <UDashboardNavbar :title="asset?.assetNumber || 'Asset Details'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/assets')"
          />
        </template>

        <template #right>
          <div class="flex gap-2">
            <UButton
              label="Edit"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              @click="router.push(`/assets/${route.params.id}/edit`)"
            />
            <UButton
              label="Archive"
              icon="i-lucide-archive"
              color="error"
              variant="subtle"
              @click="archiveAsset"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="error && !cachedAsset" class="text-center py-12">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-error mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          Asset not found
        </h3>
        <p class="text-muted mb-4">
          The asset you're looking for doesn't exist or has been removed.
        </p>
        <UButton label="Back to Assets" @click="router.push('/assets')" />
      </div>

      <!-- Offline cached view -->
      <div v-else-if="cachedAsset && !asset" class="space-y-6">
        <UAlert
          color="warning"
          icon="i-lucide-wifi-off"
          title="Offline Mode"
          description="Showing cached data. Some information may be outdated."
          class="mb-4"
        />

        <div class="flex items-start gap-6">
          <div class="w-48 h-32 rounded-lg bg-muted flex items-center justify-center">
            <UIcon name="i-lucide-truck" class="w-12 h-12 text-muted" />
          </div>

          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold">
                {{ cachedAsset.assetNumber }}
              </h1>
              <UBadge :color="statusColors[cachedAsset.status as keyof typeof statusColors] || 'neutral'" variant="subtle" class="capitalize">
                {{ cachedAsset.status }}
              </UBadge>
            </div>
            <p v-if="cachedAsset.make || cachedAsset.model" class="text-lg text-muted">
              {{ [cachedAsset.year, cachedAsset.make, cachedAsset.model].filter(Boolean).join(' ') }}
            </p>
            <p v-if="cachedAsset.categoryName" class="text-sm text-muted mt-1">
              Category: {{ cachedAsset.categoryName }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Vehicle Information
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  VIN
                </dt>
                <dd class="font-medium">
                  {{ cachedAsset.vin || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  License Plate
                </dt>
                <dd class="font-medium">
                  {{ cachedAsset.licensePlate || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Year
                </dt>
                <dd class="font-medium">
                  {{ cachedAsset.year || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Make
                </dt>
                <dd class="font-medium">
                  {{ cachedAsset.make || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Model
                </dt>
                <dd class="font-medium">
                  {{ cachedAsset.model || '-' }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>
      </div>

      <div v-else-if="asset" class="space-y-6">
        <div class="flex items-start gap-6">
          <div v-if="asset.imageUrl" class="w-48 h-32 rounded-lg overflow-hidden bg-muted">
            <img
              :src="asset.imageUrl"
              :alt="asset.assetNumber"
              class="w-full h-full object-cover"
            >
          </div>
          <div v-else class="w-48 h-32 rounded-lg bg-muted flex items-center justify-center">
            <UIcon name="i-lucide-truck" class="w-12 h-12 text-muted" />
          </div>

          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold">
                {{ asset.assetNumber }}
              </h1>
              <UBadge :color="statusColors[asset.status]" variant="subtle" class="capitalize">
                {{ asset.status }}
              </UBadge>
              <UBadge v-if="asset.isArchived" color="error" variant="subtle">
                Archived
              </UBadge>
            </div>
            <p v-if="asset.make || asset.model" class="text-lg text-muted">
              {{ [asset.year, asset.make, asset.model].filter(Boolean).join(' ') }}
            </p>
            <p v-if="asset.category" class="text-sm text-muted mt-1">
              Category: {{ asset.category.name }}
            </p>
          </div>

          <!-- QR Code for quick asset identification -->
          <div class="hidden md:block">
            <AssetQRCode :asset-id="asset.id" :asset-number="asset.assetNumber" :size="120" />
          </div>
        </div>

        <!-- Tabs -->
        <UTabs
          v-model="activeTab"
          :items="[
            { label: 'Details', value: 'details', icon: 'i-lucide-info' },
            { label: 'Compatible Parts', value: 'parts', icon: 'i-lucide-package' },
            { label: 'Costs', value: 'costs', icon: 'i-lucide-dollar-sign' }
          ]"
        />

        <!-- Details Tab -->
        <div v-if="activeTab === 'details'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Vehicle Information
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  VIN
                </dt>
                <dd class="font-medium">
                  {{ asset.vin || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  License Plate
                </dt>
                <dd class="font-medium">
                  {{ asset.licensePlate || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Year
                </dt>
                <dd class="font-medium">
                  {{ asset.year || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Make
                </dt>
                <dd class="font-medium">
                  {{ asset.make || '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Model
                </dt>
                <dd class="font-medium">
                  {{ asset.model || '-' }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Usage Metrics
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  Mileage
                </dt>
                <dd class="font-medium">
                  {{ asset.mileage ? `${Number(asset.mileage).toLocaleString()} km` : '-' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Operational Hours
                </dt>
                <dd class="font-medium">
                  {{
                    asset.operationalHours
                      ? `${Number(asset.operationalHours).toLocaleString()} hrs`
                      : '-'
                  }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">
                Record Information
              </h3>
            </template>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm text-muted">
                  Created
                </dt>
                <dd class="font-medium">
                  {{ formatDate(asset.createdAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Last Updated
                </dt>
                <dd class="font-medium">
                  {{ formatDate(asset.updatedAt) }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <UCard v-if="activeTab === 'details' && asset.description">
          <template #header>
            <h3 class="font-medium">
              Description
            </h3>
          </template>
          <p class="text-muted whitespace-pre-wrap">
            {{ asset.description }}
          </p>
        </UCard>

        <!-- QR Code Card for mobile (hidden on desktop) -->
        <UCard v-if="activeTab === 'details'" class="md:hidden">
          <template #header>
            <h3 class="font-medium">
              Asset QR Code
            </h3>
          </template>
          <div class="flex justify-center">
            <AssetQRCode :asset-id="asset.id" :asset-number="asset.assetNumber" :size="180" />
          </div>
          <p class="text-xs text-muted text-center mt-3">
            Scan this code to quickly access this asset
          </p>
        </UCard>

        <!-- Compatible Parts Tab -->
        <div v-if="activeTab === 'parts'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">
              Compatible Parts
            </h3>
            <UButton
              label="Add Part"
              icon="i-lucide-plus"
              color="primary"
              @click="showAddPartModal = true"
            />
          </div>

          <div v-if="compatiblePartsStatus === 'pending'" class="flex items-center justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
          </div>

          <div v-else-if="!compatiblePartsData?.data?.length" class="text-center py-8">
            <UIcon name="i-lucide-package-x" class="w-12 h-12 text-muted mx-auto mb-4" />
            <p class="text-muted">
              No compatible parts assigned yet.
            </p>
            <p class="text-sm text-muted mt-1">
              Add parts that are compatible with this asset.
            </p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UCard
              v-for="cp in compatiblePartsData.data"
              :key="cp.id"
              class="relative"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <NuxtLink
                      :to="`/inventory/parts/${cp.part.id}`"
                      class="font-medium text-primary hover:underline"
                    >
                      {{ cp.part.name }}
                    </NuxtLink>
                    <UBadge
                      :color="cp.source === 'asset' ? 'primary' : 'neutral'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ cp.source === 'asset' ? 'Direct' : 'Category' }}
                    </UBadge>
                  </div>
                  <p class="text-sm text-muted font-mono">
                    {{ cp.part.sku }}
                  </p>
                  <div class="flex items-center gap-4 mt-2 text-sm">
                    <span>
                      Stock: {{ parseFloat(cp.part.quantityInStock).toLocaleString() }} {{ cp.part.unit }}
                    </span>
                    <span v-if="cp.part.unitCost">
                      ${{ parseFloat(cp.part.unitCost).toFixed(2) }}/{{ cp.part.unit }}
                    </span>
                  </div>
                  <p v-if="cp.notes" class="text-sm text-muted mt-2">
                    {{ cp.notes }}
                  </p>
                </div>
                <UButton
                  v-if="cp.source === 'asset'"
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="removePart(cp.partId)"
                />
                <UTooltip v-else text="Inherited from category - cannot remove here">
                  <UIcon name="i-lucide-lock" class="w-4 h-4 text-muted" />
                </UTooltip>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Costs Tab -->
        <div v-if="activeTab === 'costs'" class="space-y-6">
          <div v-if="costsStatus === 'pending'" class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
          </div>

          <template v-else-if="costsData">
            <!-- Cost Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <UCard>
                <div class="text-center">
                  <p class="text-sm text-muted mb-1">
                    Work Orders
                  </p>
                  <p class="text-2xl font-bold">
                    {{ costsData.summary.workOrderCount }}
                  </p>
                </div>
              </UCard>
              <UCard>
                <div class="text-center">
                  <p class="text-sm text-muted mb-1">
                    Labor Cost
                  </p>
                  <p class="text-2xl font-bold text-blue-600">
                    {{ formatCurrency(costsData.summary.totalLaborCost) }}
                  </p>
                </div>
              </UCard>
              <UCard>
                <div class="text-center">
                  <p class="text-sm text-muted mb-1">
                    Parts Cost
                  </p>
                  <p class="text-2xl font-bold text-orange-600">
                    {{ formatCurrency(costsData.summary.totalPartsCost) }}
                  </p>
                </div>
              </UCard>
              <UCard>
                <div class="text-center">
                  <p class="text-sm text-muted mb-1">
                    Total Cost
                  </p>
                  <p class="text-2xl font-bold text-green-600">
                    {{ formatCurrency(costsData.summary.totalCost) }}
                  </p>
                </div>
              </UCard>
            </div>

            <!-- Work Order Cost History -->
            <UCard>
              <template #header>
                <h3 class="font-medium">
                  Completed Work Orders
                </h3>
              </template>
              <div v-if="!costsData.recentWorkOrders?.length" class="text-center py-8">
                <UIcon name="i-lucide-clipboard-check" class="w-12 h-12 text-muted mx-auto mb-4" />
                <p class="text-muted">
                  No completed work orders yet.
                </p>
                <p class="text-sm text-muted mt-1">
                  Costs will appear here after work orders are completed.
                </p>
              </div>
              <div v-else class="divide-y">
                <div
                  v-for="wo in costsData.recentWorkOrders"
                  :key="wo.id"
                  class="py-3 first:pt-0 last:pb-0"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <NuxtLink
                        :to="`/work-orders/${wo.id}`"
                        class="font-medium text-primary hover:underline"
                      >
                        {{ wo.workOrderNumber }}
                      </NuxtLink>
                      <p v-if="wo.description" class="text-sm text-muted line-clamp-1 mt-0.5">
                        {{ wo.description }}
                      </p>
                      <div class="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span v-if="wo.completedAt">
                          {{ formatDate(wo.completedAt) }}
                        </span>
                        <span v-if="wo.assignedTo">
                          {{ wo.assignedTo.firstName }} {{ wo.assignedTo.lastName }}
                        </span>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="font-medium">
                        {{ formatCurrency(wo.totalCost) }}
                      </p>
                      <div class="text-xs text-muted mt-0.5">
                        <span class="text-blue-600">{{ formatCurrency(wo.laborCost) }}</span>
                        +
                        <span class="text-orange-600">{{ formatCurrency(wo.partsCost) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </UCard>
          </template>
        </div>
      </div>

      <!-- Add Part Modal -->
      <UModal v-model:open="showAddPartModal">
        <template #content>
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Add Compatible Part
              </h3>
            </template>
            <div class="space-y-4">
              <UFormField label="Part">
                <USelect
                  v-model="selectedPartId"
                  :items="availableParts"
                  placeholder="Select a part..."
                  class="w-full"
                  searchable
                />
              </UFormField>
              <UFormField label="Notes (optional)">
                <UTextarea
                  v-model="partNotes"
                  placeholder="Notes about this part's compatibility..."
                  :rows="2"
                />
              </UFormField>
            </div>
            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="showAddPartModal = false"
                />
                <UButton
                  label="Add Part"
                  color="primary"
                  :loading="addingPart"
                  :disabled="!selectedPartId"
                  @click="addPart"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
