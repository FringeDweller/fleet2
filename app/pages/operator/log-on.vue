<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  imageUrl: string | null
  mileage: string | null
  operationalHours: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'disposed'
  category: { id: string; name: string } | null
}

const router = useRouter()
const toast = useToast()
const { isNfcAvailable, readAssetTag } = useNfc()
const { currentSession, hasActiveSession, logOn, isLoading, fetchActiveSession } =
  useOperatorSession()

// Check if user already has an active session on load
onMounted(async () => {
  await fetchActiveSession()
  if (hasActiveSession.value) {
    router.push('/operator/session')
  }
})

// State
const scanMode = ref<'nfc' | 'qr' | 'manual'>('manual')
const isScanning = ref(false)
const selectedAssetId = ref('')
const searchQuery = ref('')
const showOdometerForm = ref(false)

// Form data
const odometerReading = ref<number | null>(null)
const hoursReading = ref<number | null>(null)
const useCurrentLocation = ref(true)
const notes = ref('')
const isCapturingLocation = ref(false)
const capturedLocation = ref<{
  latitude: number
  longitude: number
  locationName?: string
} | null>(null)

// Fetch assets for manual selection
const { data: assetsData, status: assetsStatus } = await useFetch<{
  data: Asset[]
}>('/api/assets', {
  query: {
    status: 'active',
    limit: 100,
    search: searchQuery,
  },
  lazy: true,
})

// Filter assets based on search
const filteredAssets = computed(() => {
  if (!assetsData.value?.data) return []
  if (!searchQuery.value) return assetsData.value.data
  const query = searchQuery.value.toLowerCase()
  return assetsData.value.data.filter(
    (asset) =>
      asset.assetNumber.toLowerCase().includes(query) ||
      asset.make?.toLowerCase().includes(query) ||
      asset.model?.toLowerCase().includes(query) ||
      asset.licensePlate?.toLowerCase().includes(query),
  )
})

const selectedAsset = computed(() =>
  assetsData.value?.data.find((a) => a.id === selectedAssetId.value),
)

// NFC Scanning
async function startNfcScan() {
  if (!isNfcAvailable.value) {
    toast.add({
      title: 'NFC Not Available',
      description: 'NFC is only available on Android devices with Chrome.',
      color: 'warning',
    })
    return
  }

  isScanning.value = true
  scanMode.value = 'nfc'

  const result = await readAssetTag()

  if (result.success && result.assetId) {
    // Verify the asset exists and belongs to the organisation
    try {
      const asset = await $fetch<Asset>(`/api/assets/${result.assetId}`)
      selectedAssetId.value = asset.id
      showOdometerForm.value = true
      toast.add({
        title: 'Asset Identified',
        description: `Identified ${asset.assetNumber}`,
        color: 'success',
        icon: 'i-lucide-nfc',
      })
    } catch {
      toast.add({
        title: 'Asset Not Found',
        description: 'The scanned NFC tag is not linked to a valid asset.',
        color: 'error',
      })
    }
  } else {
    toast.add({
      title: 'Scan Failed',
      description: result.error || 'Failed to read NFC tag.',
      color: 'error',
    })
  }

  isScanning.value = false
}

// QR Code Scanning
function onQrCodeScanned(data: string) {
  // Expected format: fleet://asset/{id} or just the UUID
  const match = data.match(/fleet:\/\/asset\/([a-f0-9-]+)/) || data.match(/^([a-f0-9-]+)$/)

  if (match?.[1]) {
    handleAssetId(match[1])
  } else {
    toast.add({
      title: 'Invalid QR Code',
      description: 'This QR code is not a valid asset code.',
      color: 'error',
    })
  }
  scanMode.value = 'manual'
}

async function handleAssetId(assetId: string) {
  try {
    // Verify asset exists
    const asset = await $fetch<Asset>(`/api/assets/${assetId}`)
    selectedAssetId.value = asset.id
    showOdometerForm.value = true
    toast.add({
      title: 'Asset Identified',
      description: `Identified ${asset.assetNumber}`,
      color: 'success',
    })
  } catch {
    toast.add({
      title: 'Asset Not Found',
      description: 'The scanned code is not linked to a valid asset.',
      color: 'error',
    })
  }
}

// Manual asset selection
function selectAsset(asset: Asset) {
  selectedAssetId.value = asset.id
  showOdometerForm.value = true
}

// Capture current GPS location
async function captureLocation() {
  if (!navigator.geolocation) {
    toast.add({
      title: 'Location Not Available',
      description: 'Geolocation is not supported by your browser.',
      color: 'warning',
    })
    return
  }

  isCapturingLocation.value = true

  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedLocation.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
      toast.add({
        title: 'Location Captured',
        description: 'Your current position has been captured.',
        color: 'success',
        icon: 'i-lucide-map-pin',
      })
      isCapturingLocation.value = false
    },
    (error) => {
      toast.add({
        title: 'Location Error',
        description: error.message || 'Failed to get current position.',
        color: 'error',
      })
      isCapturingLocation.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

// Submit log-on
async function handleLogOn() {
  if (!selectedAssetId.value) {
    toast.add({
      title: 'No Asset Selected',
      description: 'Please select an asset to log on to.',
      color: 'warning',
    })
    return
  }

  // Capture location if requested
  let location = capturedLocation.value
  if (useCurrentLocation.value && !location) {
    isCapturingLocation.value = true
    location = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 },
      )
    })
    isCapturingLocation.value = false
  }

  const result = await logOn({
    assetId: selectedAssetId.value,
    startOdometer: odometerReading.value,
    startHours: hoursReading.value,
    startLatitude: location?.latitude ?? null,
    startLongitude: location?.longitude ?? null,
    startLocationName: location?.locationName ?? null,
    notes: notes.value || null,
  })

  if (result.success) {
    toast.add({
      title: 'Logged On Successfully',
      description: `You are now logged on to ${selectedAsset.value?.assetNumber || 'the asset'}.`,
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    router.push('/operator/session')
  } else {
    toast.add({
      title: 'Log On Failed',
      description: result.error || 'Failed to log on to the asset.',
      color: 'error',
    })
  }
}

// Go back to asset selection
function backToSelection() {
  showOdometerForm.value = false
  selectedAssetId.value = ''
  odometerReading.value = null
  hoursReading.value = null
  notes.value = ''
  capturedLocation.value = null
}

const statusColors = {
  active: 'success',
  inactive: 'neutral',
  maintenance: 'warning',
  disposed: 'error',
} as const
</script>

<template>
  <UDashboardPanel id="operator-log-on">
    <template #header>
      <UDashboardNavbar title="Operator Log-On">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto py-6 px-4">
        <!-- Already logged on redirect notice -->
        <UAlert
          v-if="hasActiveSession"
          color="info"
          icon="i-lucide-info"
          title="Active Session"
          description="You already have an active session. Redirecting..."
          class="mb-6"
        />

        <!-- Step 1: Asset Selection -->
        <div v-if="!showOdometerForm" class="space-y-6">
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold mb-2">Select Asset</h1>
            <p class="text-muted">Scan an NFC tag, QR code, or select manually</p>
          </div>

          <!-- Scan Options -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <!-- NFC Scan -->
            <UCard
              :class="[
                'cursor-pointer transition-all hover:ring-2 hover:ring-primary',
                !isNfcAvailable && 'opacity-50',
              ]"
              @click="startNfcScan"
            >
              <div class="text-center py-4">
                <div
                  class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
                >
                  <UIcon
                    v-if="isScanning && scanMode === 'nfc'"
                    name="i-lucide-loader-2"
                    class="w-8 h-8 text-primary animate-spin"
                  />
                  <UIcon v-else name="i-lucide-nfc" class="w-8 h-8 text-primary" />
                </div>
                <h3 class="font-medium mb-1">NFC Scan</h3>
                <p class="text-sm text-muted">
                  {{ isNfcAvailable ? 'Tap NFC tag on asset' : 'Android only' }}
                </p>
              </div>
            </UCard>

            <!-- QR Scan -->
            <UCard
              class="cursor-pointer transition-all hover:ring-2 hover:ring-primary"
              @click="scanMode = 'qr'"
            >
              <div class="text-center py-4">
                <div
                  class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
                >
                  <UIcon name="i-lucide-qr-code" class="w-8 h-8 text-primary" />
                </div>
                <h3 class="font-medium mb-1">QR Code</h3>
                <p class="text-sm text-muted">Scan asset QR code</p>
              </div>
            </UCard>

            <!-- Manual Selection -->
            <UCard
              :class="[
                'cursor-pointer transition-all hover:ring-2 hover:ring-primary',
                scanMode === 'manual' && 'ring-2 ring-primary',
              ]"
              @click="scanMode = 'manual'"
            >
              <div class="text-center py-4">
                <div
                  class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
                >
                  <UIcon name="i-lucide-list" class="w-8 h-8 text-primary" />
                </div>
                <h3 class="font-medium mb-1">Manual Select</h3>
                <p class="text-sm text-muted">Choose from list</p>
              </div>
            </UCard>
          </div>

          <!-- QR Scanner -->
          <UCard v-if="scanMode === 'qr'" class="mb-6">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium">QR Code Scanner</h3>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="scanMode = 'manual'"
                />
              </div>
            </template>
            <div class="aspect-square max-w-sm mx-auto bg-muted rounded-lg flex items-center justify-center">
              <!-- QR Scanner component would go here -->
              <div class="text-center p-8">
                <UIcon name="i-lucide-camera" class="w-12 h-12 text-muted mx-auto mb-4" />
                <p class="text-muted">Point camera at QR code</p>
                <p class="text-xs text-muted mt-2">
                  Camera access required
                </p>
                <!-- For now, show manual input fallback -->
                <div class="mt-4">
                  <UInput
                    placeholder="Or enter asset ID manually..."
                    class="text-center"
                    @keyup.enter="(e: KeyboardEvent) => handleAssetId((e.target as HTMLInputElement).value)"
                  />
                </div>
              </div>
            </div>
          </UCard>

          <!-- Manual Asset List -->
          <div v-if="scanMode === 'manual'">
            <UFormField label="Search Assets">
              <UInput
                v-model="searchQuery"
                placeholder="Search by asset number, make, model..."
                icon="i-lucide-search"
              />
            </UFormField>

            <div class="mt-4">
              <div v-if="assetsStatus === 'pending'" class="flex items-center justify-center py-8">
                <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
              </div>

              <div v-else-if="!filteredAssets.length" class="text-center py-8">
                <UIcon name="i-lucide-truck" class="w-12 h-12 text-muted mx-auto mb-4" />
                <p class="text-muted">No assets found</p>
              </div>

              <div v-else class="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                <UCard
                  v-for="asset in filteredAssets"
                  :key="asset.id"
                  class="cursor-pointer transition-all hover:ring-2 hover:ring-primary"
                  @click="selectAsset(asset)"
                >
                  <div class="flex items-center gap-4">
                    <div v-if="asset.imageUrl" class="w-16 h-12 rounded overflow-hidden bg-muted">
                      <img :src="asset.imageUrl" :alt="asset.assetNumber" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-16 h-12 rounded bg-muted flex items-center justify-center">
                      <UIcon name="i-lucide-truck" class="w-6 h-6 text-muted" />
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{{ asset.assetNumber }}</span>
                        <UBadge
                          :color="statusColors[asset.status]"
                          variant="subtle"
                          size="xs"
                          class="capitalize"
                        >
                          {{ asset.status }}
                        </UBadge>
                      </div>
                      <p v-if="asset.make || asset.model" class="text-sm text-muted">
                        {{ [asset.year, asset.make, asset.model].filter(Boolean).join(' ') }}
                      </p>
                      <p v-if="asset.licensePlate" class="text-xs text-muted">
                        {{ asset.licensePlate }}
                      </p>
                    </div>
                    <UIcon name="i-lucide-chevron-right" class="w-5 h-5 text-muted" />
                  </div>
                </UCard>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Odometer/Hours Entry -->
        <div v-else class="space-y-6">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            label="Back"
            @click="backToSelection"
          />

          <!-- Selected Asset Summary -->
          <UCard v-if="selectedAsset">
            <div class="flex items-center gap-4">
              <div v-if="selectedAsset.imageUrl" class="w-20 h-14 rounded overflow-hidden bg-muted">
                <img
                  :src="selectedAsset.imageUrl"
                  :alt="selectedAsset.assetNumber"
                  class="w-full h-full object-cover"
                />
              </div>
              <div v-else class="w-20 h-14 rounded bg-muted flex items-center justify-center">
                <UIcon name="i-lucide-truck" class="w-8 h-8 text-muted" />
              </div>
              <div>
                <h2 class="text-xl font-bold">{{ selectedAsset.assetNumber }}</h2>
                <p v-if="selectedAsset.make || selectedAsset.model" class="text-muted">
                  {{ [selectedAsset.year, selectedAsset.make, selectedAsset.model].filter(Boolean).join(' ') }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Meter Readings</h3>
            </template>

            <div class="space-y-4">
              <!-- Current readings display -->
              <div v-if="selectedAsset" class="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p class="text-xs text-muted mb-1">Current Odometer</p>
                  <p class="font-medium">
                    {{
                      selectedAsset.mileage
                        ? `${parseFloat(selectedAsset.mileage).toLocaleString()} km`
                        : 'Not recorded'
                    }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1">Current Hours</p>
                  <p class="font-medium">
                    {{
                      selectedAsset.operationalHours
                        ? `${parseFloat(selectedAsset.operationalHours).toLocaleString()} hrs`
                        : 'Not recorded'
                    }}
                  </p>
                </div>
              </div>

              <UFormField label="Starting Odometer (km)" hint="Optional - Enter current reading">
                <UInput
                  v-model.number="odometerReading"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Enter odometer reading..."
                  icon="i-lucide-gauge"
                />
              </UFormField>

              <UFormField label="Starting Hours" hint="Optional - Enter current hour meter">
                <UInput
                  v-model.number="hoursReading"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Enter hour meter reading..."
                  icon="i-lucide-clock"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Location</h3>
            </template>

            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <UCheckbox v-model="useCurrentLocation" />
                <div>
                  <p class="font-medium text-sm">Use current GPS location</p>
                  <p class="text-xs text-muted">Capture your location for trip tracking</p>
                </div>
              </div>

              <div v-if="capturedLocation" class="p-3 bg-success/10 rounded-lg flex items-center gap-3">
                <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-success" />
                <div>
                  <p class="text-sm font-medium">Location captured</p>
                  <p class="text-xs text-muted font-mono">
                    {{ capturedLocation.latitude.toFixed(6) }}, {{ capturedLocation.longitude.toFixed(6) }}
                  </p>
                </div>
              </div>

              <UButton
                v-if="useCurrentLocation && !capturedLocation"
                label="Capture Location Now"
                icon="i-lucide-crosshair"
                color="neutral"
                variant="outline"
                :loading="isCapturingLocation"
                @click="captureLocation"
              />
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Notes</h3>
            </template>
            <UTextarea
              v-model="notes"
              placeholder="Any notes for this session (optional)..."
              :rows="3"
            />
          </UCard>

          <!-- Log On Button -->
          <UButton
            label="Log On"
            icon="i-lucide-log-in"
            color="primary"
            size="lg"
            block
            :loading="isLoading"
            @click="handleLogOn"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
