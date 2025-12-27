<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
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
  category: { id: string, name: string } | null
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { cacheAsset, getCachedAsset, isOnline } = useAssetCache()

const {
  data: asset,
  status,
  error
} = await useFetch<Asset>(`/api/assets/${route.params.id}`, {
  lazy: true
})

// Cache asset for offline access when loaded
watch(
  asset,
  (newAsset) => {
    if (newAsset) {
      cacheAsset(newAsset)
    }
  },
  { immediate: true }
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
    { immediate: true }
  )
}

const statusColors = {
  active: 'success',
  inactive: 'neutral',
  maintenance: 'warning',
  disposed: 'error'
} as const

async function archiveAsset() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/assets/${route.params.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Asset archived',
      description: 'The asset has been archived successfully.'
    })
    router.push('/assets')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive asset.',
      color: 'error'
    })
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
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

        <UCard v-if="asset.description">
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
        <UCard class="md:hidden">
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
      </div>
    </template>
  </UDashboardPanel>
</template>
