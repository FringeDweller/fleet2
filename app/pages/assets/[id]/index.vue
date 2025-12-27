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
  latitude: string | null
  longitude: string | null
  locationName: string | null
  locationAddress: string | null
  lastLocationUpdate: string | null
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

interface LocationHistoryEntry {
  id: string
  latitude: string
  longitude: string
  locationName: string | null
  locationAddress: string | null
  notes: string | null
  source: string
  recordedAt: string
  updatedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface LocationResponse {
  current: {
    latitude: string | null
    longitude: string | null
    locationName: string | null
    locationAddress: string | null
    lastUpdate: string | null
  }
  history: LocationHistoryEntry[]
}

interface Defect {
  id: string
  title: string
  description: string | null
  category: string | null
  severity: 'minor' | 'major' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  location: string | null
  photos: string | null
  reportedAt: string
  resolvedAt: string | null
  resolutionNotes: string | null
  workOrder: {
    id: string
    workOrderNumber: string
    status: string
  } | null
  reportedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
  resolvedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface DefectsResponse {
  data: Defect[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
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

// Fetch location data
const {
  data: locationData,
  status: locationStatus,
  refresh: refreshLocation,
} = await useFetch<LocationResponse>(`/api/assets/${route.params.id}/location`, {
  lazy: true,
})

// Fetch defects for this asset
const {
  data: defectsData,
  status: defectsStatus,
  refresh: refreshDefects,
} = await useFetch<DefectsResponse>(`/api/defects`, {
  query: { assetId: route.params.id },
  lazy: true,
})

// Add part modal state
const showAddPartModal = ref(false)
const addingPart = ref(false)
const selectedPartId = ref('')
const partNotes = ref('')

// Update location modal state
const showLocationModal = ref(false)
const updatingLocation = ref(false)
const locationForm = ref({
  latitude: '',
  longitude: '',
  locationName: '',
  locationAddress: '',
  notes: '',
})

// Report defect modal state
const showDefectModal = ref(false)
const reportingDefect = ref(false)
const defectForm = ref({
  title: '',
  description: '',
  category: '',
  severity: 'minor' as 'minor' | 'major' | 'critical',
  location: '',
  autoCreateWorkOrder: true,
})

const severityOptions = [
  { label: 'Minor', value: 'minor', description: 'Low priority issue' },
  { label: 'Major', value: 'major', description: 'Creates work order automatically' },
  {
    label: 'Critical',
    value: 'critical',
    description: 'Urgent - Creates high priority work order',
  },
]

const defectCategoryOptions = [
  { label: 'Mechanical', value: 'mechanical' },
  { label: 'Electrical', value: 'electrical' },
  { label: 'Body/Exterior', value: 'body' },
  { label: 'Interior', value: 'interior' },
  { label: 'Safety', value: 'safety' },
  { label: 'Tires/Wheels', value: 'tires' },
  { label: 'Fluid Leak', value: 'fluid' },
  { label: 'Other', value: 'other' },
]

function openDefectModal() {
  defectForm.value = {
    title: '',
    description: '',
    category: '',
    severity: 'minor',
    location: '',
    autoCreateWorkOrder: true,
  }
  showDefectModal.value = true
}

async function reportDefect() {
  if (!defectForm.value.title.trim()) return

  reportingDefect.value = true
  try {
    const response = await $fetch<{
      defect: Defect
      workOrder: { id: string; workOrderNumber: string } | null
    }>(`/api/defects`, {
      method: 'POST',
      body: {
        assetId: route.params.id,
        title: defectForm.value.title,
        description: defectForm.value.description || undefined,
        category: defectForm.value.category || undefined,
        severity: defectForm.value.severity,
        location: defectForm.value.location || undefined,
        autoCreateWorkOrder: defectForm.value.autoCreateWorkOrder,
      },
    })

    let message = 'The defect has been reported.'
    if (response.workOrder) {
      message = `Defect reported and work order ${response.workOrder.workOrderNumber} created.`
    }

    toast.add({
      title: 'Defect reported',
      description: message,
      color: 'success',
    })

    showDefectModal.value = false
    refreshDefects()
  } catch (err: unknown) {
    const error = err as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.statusMessage || 'Failed to report defect.',
      color: 'error',
    })
  } finally {
    reportingDefect.value = false
  }
}

function openLocationModal() {
  // Pre-fill with current location if available
  if (locationData.value?.current) {
    locationForm.value = {
      latitude: locationData.value.current.latitude || '',
      longitude: locationData.value.current.longitude || '',
      locationName: locationData.value.current.locationName || '',
      locationAddress: locationData.value.current.locationAddress || '',
      notes: '',
    }
  } else {
    locationForm.value = {
      latitude: '',
      longitude: '',
      locationName: '',
      locationAddress: '',
      notes: '',
    }
  }
  showLocationModal.value = true
}

async function updateLocation() {
  if (!locationForm.value.latitude || !locationForm.value.longitude) return

  updatingLocation.value = true
  try {
    await $fetch(`/api/assets/${route.params.id}/location`, {
      method: 'POST',
      body: {
        latitude: Number.parseFloat(locationForm.value.latitude),
        longitude: Number.parseFloat(locationForm.value.longitude),
        locationName: locationForm.value.locationName || undefined,
        locationAddress: locationForm.value.locationAddress || undefined,
        notes: locationForm.value.notes || undefined,
        source: 'manual',
      },
    })
    toast.add({
      title: 'Location updated',
      description: 'The asset location has been updated.',
      color: 'success',
    })
    showLocationModal.value = false
    refreshLocation()
  } catch (err: unknown) {
    const error = err as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.statusMessage || 'Failed to update location.',
      color: 'error',
    })
  } finally {
    updatingLocation.value = false
  }
}

async function getCurrentPosition() {
  if (!navigator.geolocation) {
    toast.add({
      title: 'Not supported',
      description: 'Geolocation is not supported by your browser.',
      color: 'warning',
    })
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationForm.value.latitude = position.coords.latitude.toFixed(7)
      locationForm.value.longitude = position.coords.longitude.toFixed(7)
      toast.add({
        title: 'Location captured',
        description: 'Your current position has been captured.',
        color: 'success',
      })
    },
    (error) => {
      toast.add({
        title: 'Location error',
        description: error.message || 'Failed to get current position.',
        color: 'error',
      })
    },
    { enableHighAccuracy: true },
  )
}

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
            { label: 'Location', value: 'location', icon: 'i-lucide-map-pin' },
            { label: 'Compatible Parts', value: 'parts', icon: 'i-lucide-package' },
            { label: 'Defects', value: 'defects', icon: 'i-lucide-alert-triangle' },
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

        <!-- Location Tab -->
        <div v-if="activeTab === 'location'" class="space-y-6">
          <div v-if="locationStatus === 'pending'" class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
          </div>

          <template v-else>
            <!-- Current Location Card -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="font-medium">
                    Current Location
                  </h3>
                  <UButton
                    label="Update Location"
                    icon="i-lucide-map-pin"
                    color="primary"
                    size="sm"
                    @click="openLocationModal"
                  />
                </div>
              </template>
              <div v-if="locationData?.current?.latitude && locationData?.current?.longitude">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dl class="space-y-3">
                      <div v-if="locationData.current.locationName">
                        <dt class="text-sm text-muted">
                          Location Name
                        </dt>
                        <dd class="font-medium">
                          {{ locationData.current.locationName }}
                        </dd>
                      </div>
                      <div v-if="locationData.current.locationAddress">
                        <dt class="text-sm text-muted">
                          Address
                        </dt>
                        <dd class="font-medium">
                          {{ locationData.current.locationAddress }}
                        </dd>
                      </div>
                      <div>
                        <dt class="text-sm text-muted">
                          Coordinates
                        </dt>
                        <dd class="font-medium font-mono text-sm">
                          {{ locationData.current.latitude }}, {{ locationData.current.longitude }}
                        </dd>
                      </div>
                      <div v-if="locationData.current.lastUpdate">
                        <dt class="text-sm text-muted">
                          Last Updated
                        </dt>
                        <dd class="font-medium">
                          {{ formatDate(locationData.current.lastUpdate) }}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <!-- Map placeholder - will show coordinates on external map -->
                    <a
                      :href="`https://www.google.com/maps?q=${locationData.current.latitude},${locationData.current.longitude}`"
                      target="_blank"
                      class="block bg-muted rounded-lg p-8 text-center hover:bg-muted/80 transition-colors"
                    >
                      <UIcon name="i-lucide-map" class="w-12 h-12 text-muted mx-auto mb-2" />
                      <p class="text-sm text-muted">
                        View on Google Maps
                      </p>
                    </a>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8">
                <UIcon name="i-lucide-map-pin-off" class="w-12 h-12 text-muted mx-auto mb-4" />
                <p class="text-muted">
                  No location set for this asset.
                </p>
                <p class="text-sm text-muted mt-1">
                  Click "Update Location" to set the asset's current location.
                </p>
              </div>
            </UCard>

            <!-- Location History -->
            <UCard>
              <template #header>
                <h3 class="font-medium">
                  Location History
                </h3>
              </template>
              <div v-if="!locationData?.history?.length" class="text-center py-8">
                <UIcon name="i-lucide-history" class="w-12 h-12 text-muted mx-auto mb-4" />
                <p class="text-muted">
                  No location history yet.
                </p>
              </div>
              <div v-else class="divide-y">
                <div
                  v-for="entry in locationData.history"
                  :key="entry.id"
                  class="py-3 first:pt-0 last:pb-0"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <p v-if="entry.locationName" class="font-medium">
                        {{ entry.locationName }}
                      </p>
                      <p v-else class="font-medium font-mono text-sm">
                        {{ entry.latitude }}, {{ entry.longitude }}
                      </p>
                      <p v-if="entry.locationAddress" class="text-sm text-muted mt-0.5">
                        {{ entry.locationAddress }}
                      </p>
                      <div class="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{{ formatDate(entry.recordedAt) }}</span>
                        <UBadge variant="subtle" size="xs" class="capitalize">
                          {{ entry.source }}
                        </UBadge>
                        <span v-if="entry.updatedBy">
                          by {{ entry.updatedBy.firstName }} {{ entry.updatedBy.lastName }}
                        </span>
                      </div>
                      <p v-if="entry.notes" class="text-sm text-muted mt-1">
                        {{ entry.notes }}
                      </p>
                    </div>
                    <a
                      :href="`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`"
                      target="_blank"
                      class="text-primary hover:underline text-sm"
                    >
                      View
                    </a>
                  </div>
                </div>
              </div>
            </UCard>
          </template>
        </div>

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

        <!-- Defects Tab -->
        <div v-if="activeTab === 'defects'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">
              Defects
            </h3>
            <UButton
              label="Report Defect"
              icon="i-lucide-alert-triangle"
              color="error"
              @click="openDefectModal"
            />
          </div>

          <div v-if="defectsStatus === 'pending'" class="flex items-center justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
          </div>

          <div v-else-if="!defectsData?.data?.length" class="text-center py-8">
            <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-success mx-auto mb-4" />
            <p class="text-muted">
              No defects reported for this asset.
            </p>
            <p class="text-sm text-muted mt-1">
              Report any issues or problems you find with this asset.
            </p>
          </div>

          <div v-else class="space-y-3">
            <UCard
              v-for="defect in defectsData.data"
              :key="defect.id"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium">{{ defect.title }}</span>
                    <UBadge
                      :color="defect.severity === 'critical' ? 'error' : defect.severity === 'major' ? 'warning' : 'neutral'"
                      variant="subtle"
                      size="xs"
                      class="capitalize"
                    >
                      {{ defect.severity }}
                    </UBadge>
                    <UBadge
                      :color="defect.status === 'open' ? 'error' : defect.status === 'in_progress' ? 'warning' : 'success'"
                      variant="subtle"
                      size="xs"
                      class="capitalize"
                    >
                      {{ defect.status.replace('_', ' ') }}
                    </UBadge>
                  </div>
                  <p v-if="defect.description" class="text-sm text-muted line-clamp-2">
                    {{ defect.description }}
                  </p>
                  <div class="flex items-center gap-3 mt-2 text-xs text-muted">
                    <span v-if="defect.category" class="capitalize">
                      {{ defect.category }}
                    </span>
                    <span v-if="defect.location">
                      {{ defect.location }}
                    </span>
                    <span>
                      Reported {{ formatDate(defect.reportedAt) }}
                    </span>
                    <span v-if="defect.reportedBy">
                      by {{ defect.reportedBy.firstName }} {{ defect.reportedBy.lastName }}
                    </span>
                  </div>
                  <div v-if="defect.resolvedAt" class="flex items-center gap-2 mt-1 text-xs text-success">
                    <UIcon name="i-lucide-check-circle" class="w-3 h-3" />
                    <span>
                      Resolved {{ formatDate(defect.resolvedAt) }}
                      <span v-if="defect.resolvedBy">
                        by {{ defect.resolvedBy.firstName }} {{ defect.resolvedBy.lastName }}
                      </span>
                    </span>
                  </div>
                </div>
                <div v-if="defect.workOrder" class="text-right">
                  <NuxtLink
                    :to="`/work-orders/${defect.workOrder.id}`"
                    class="text-sm text-primary hover:underline"
                  >
                    {{ defect.workOrder.workOrderNumber }}
                  </NuxtLink>
                  <UBadge
                    variant="subtle"
                    size="xs"
                    class="capitalize block mt-1"
                  >
                    {{ defect.workOrder.status }}
                  </UBadge>
                </div>
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

      <!-- Update Location Modal -->
      <UModal v-model:open="showLocationModal">
        <template #content>
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Update Location
              </h3>
            </template>
            <div class="space-y-4">
              <div class="flex gap-2">
                <UButton
                  label="Use Current Position"
                  icon="i-lucide-locate"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  class="flex-1"
                  @click="getCurrentPosition"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <UFormField label="Latitude">
                  <UInput
                    v-model="locationForm.latitude"
                    type="number"
                    step="0.0000001"
                    min="-90"
                    max="90"
                    placeholder="-33.8688"
                  />
                </UFormField>
                <UFormField label="Longitude">
                  <UInput
                    v-model="locationForm.longitude"
                    type="number"
                    step="0.0000001"
                    min="-180"
                    max="180"
                    placeholder="151.2093"
                  />
                </UFormField>
              </div>
              <UFormField label="Location Name (optional)">
                <UInput
                  v-model="locationForm.locationName"
                  placeholder="e.g. Sydney Depot"
                />
              </UFormField>
              <UFormField label="Address (optional)">
                <UTextarea
                  v-model="locationForm.locationAddress"
                  placeholder="e.g. 123 Main St, Sydney NSW 2000"
                  :rows="2"
                />
              </UFormField>
              <UFormField label="Notes (optional)">
                <UTextarea
                  v-model="locationForm.notes"
                  placeholder="Any notes about this location update..."
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
                  @click="showLocationModal = false"
                />
                <UButton
                  label="Update Location"
                  color="primary"
                  :loading="updatingLocation"
                  :disabled="!locationForm.latitude || !locationForm.longitude"
                  @click="updateLocation"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>

      <!-- Report Defect Modal -->
      <UModal v-model:open="showDefectModal">
        <template #content>
          <UCard>
            <template #header>
              <h3 class="font-medium">
                Report Defect
              </h3>
            </template>
            <div class="space-y-4">
              <UFormField label="Defect Title" required>
                <UInput
                  v-model="defectForm.title"
                  placeholder="Brief description of the issue..."
                />
              </UFormField>
              <UFormField label="Description">
                <UTextarea
                  v-model="defectForm.description"
                  placeholder="Detailed description of the defect..."
                  :rows="3"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-4">
                <UFormField label="Category">
                  <USelect
                    v-model="defectForm.category"
                    :items="defectCategoryOptions"
                    placeholder="Select category..."
                  />
                </UFormField>
                <UFormField label="Severity" required>
                  <USelect
                    v-model="defectForm.severity"
                    :items="severityOptions"
                  />
                </UFormField>
              </div>
              <UFormField label="Location on Asset">
                <UInput
                  v-model="defectForm.location"
                  placeholder="e.g. Front left tire, Engine compartment..."
                />
              </UFormField>
              <div class="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <UCheckbox
                  v-model="defectForm.autoCreateWorkOrder"
                  :disabled="defectForm.severity === 'minor'"
                />
                <div class="flex-1">
                  <p class="font-medium text-sm">
                    Auto-create work order
                  </p>
                  <p class="text-xs text-muted mt-0.5">
                    {{ defectForm.severity === 'minor'
                      ? 'Work orders are only auto-created for major and critical defects.'
                      : 'A work order will be created automatically with the appropriate priority.'
                    }}
                  </p>
                </div>
              </div>
            </div>
            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="showDefectModal = false"
                />
                <UButton
                  label="Report Defect"
                  color="error"
                  icon="i-lucide-alert-triangle"
                  :loading="reportingDefect"
                  :disabled="!defectForm.title.trim()"
                  @click="reportDefect"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
