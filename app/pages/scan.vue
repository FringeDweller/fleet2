<script setup lang="ts">
import { Html5Qrcode } from 'html5-qrcode'

definePageMeta({
  middleware: 'auth',
  layout: 'minimal',
})

const router = useRouter()
const toast = useToast()
const { isOnline, getCachedAsset, searchCachedAssets } = useAssetCache()

const scannerContainerId = 'qr-scanner'
const isScanning = ref(false)
const scanError = ref<string | null>(null)
const nfcSupported = ref(false)
const nfcReading = ref(false)
const lastScannedCode = ref<string | null>(null)
const manualInput = ref('')
const offlineSearchResults = ref<ReturnType<typeof searchCachedAssets>>([])

let html5QrCode: Html5Qrcode | null = null
let nfcReader: NDEFReader | null = null

// Search cached assets as user types (for offline mode)
watch(manualInput, (query) => {
  if (!isOnline.value && query.trim().length >= 2) {
    offlineSearchResults.value = searchCachedAssets(query)
  } else {
    offlineSearchResults.value = []
  }
})

// Check NFC support on mount
onMounted(() => {
  nfcSupported.value = 'NDEFReader' in window
})

// Cleanup on unmount
onUnmounted(() => {
  stopScanner()
  stopNfcReading()
})

async function startScanner() {
  scanError.value = null

  try {
    html5QrCode = new Html5Qrcode(scannerContainerId)

    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      onScanSuccess,
      () => {}, // Ignore scan failures (no QR in frame)
    )

    isScanning.value = true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start camera'
    scanError.value = message
    toast.add({
      title: 'Camera Error',
      description: message,
      color: 'error',
    })
  }
}

async function stopScanner() {
  if (html5QrCode && isScanning.value) {
    try {
      await html5QrCode.stop()
      html5QrCode.clear()
    } catch {
      // Ignore stop errors
    }
  }
  isScanning.value = false
  html5QrCode = null
}

async function onScanSuccess(decodedText: string) {
  // Prevent duplicate scans
  if (lastScannedCode.value === decodedText) return
  lastScannedCode.value = decodedText

  // Stop scanning after successful scan
  await stopScanner()

  // Process the scanned code
  await processScannedCode(decodedText)

  // Reset after delay to allow re-scanning
  setTimeout(() => {
    lastScannedCode.value = null
  }, 2000)
}

async function processScannedCode(code: string) {
  // Expected format: fleet://asset/{uuid} or just the UUID
  let assetId: string | null = null

  // Try to extract asset ID from various formats
  const fleetUrlMatch = code.match(/^fleet:\/\/asset\/([a-f0-9-]+)$/i)
  const uuidMatch = code.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)
  const httpUrlMatch = code.match(/\/assets\/([a-f0-9-]+)/i)

  if (fleetUrlMatch?.[1]) {
    assetId = fleetUrlMatch[1]
  } else if (uuidMatch) {
    assetId = code
  } else if (httpUrlMatch?.[1]) {
    assetId = httpUrlMatch[1]
  }

  if (assetId) {
    // Check cache first (works offline)
    const cachedAsset = getCachedAsset(assetId)

    if (!isOnline.value) {
      // Offline mode - rely on cache only
      if (cachedAsset) {
        toast.add({
          title: 'Asset Found (Cached)',
          description: `${cachedAsset.assetNumber} - Viewing offline data`,
        })
        router.push(`/assets/${assetId}`)
      } else {
        toast.add({
          title: 'Asset Not Cached',
          description: 'This asset is not available offline. Connect to the internet to view it.',
          color: 'warning',
        })
      }
      return
    }

    // Online mode - validate with server
    try {
      await $fetch(`/api/assets/${assetId}`)
      toast.add({
        title: 'Asset Found',
        description: 'Navigating to asset details...',
      })
      router.push(`/assets/${assetId}`)
    } catch {
      // Not found on server, but maybe in cache
      if (cachedAsset) {
        toast.add({
          title: 'Asset Not Found',
          description: 'This asset may have been removed. Showing cached data.',
          color: 'warning',
        })
        router.push(`/assets/${assetId}`)
      } else {
        toast.add({
          title: 'Asset Not Found',
          description: 'The scanned code does not match any asset.',
          color: 'error',
        })
      }
    }
  } else {
    toast.add({
      title: 'Invalid Code',
      description: 'The scanned code is not a valid asset identifier.',
      color: 'warning',
    })
  }
}

function navigateToCachedAsset(assetId: string) {
  router.push(`/assets/${assetId}`)
}

async function startNfcReading() {
  if (!nfcSupported.value) {
    toast.add({
      title: 'NFC Not Supported',
      description: 'Your device does not support NFC.',
      color: 'warning',
    })
    return
  }

  try {
    nfcReader = new NDEFReader()
    await nfcReader.scan()
    nfcReading.value = true

    nfcReader.addEventListener('reading', (event: Event) => {
      const ndefEvent = event as NDEFReadingEvent
      for (const record of ndefEvent.message.records) {
        if (record.recordType === 'text') {
          const textDecoder = new TextDecoder()
          const text = textDecoder.decode(record.data)
          processScannedCode(text)
          break
        } else if (record.recordType === 'url') {
          const textDecoder = new TextDecoder()
          const url = textDecoder.decode(record.data)
          processScannedCode(url)
          break
        }
      }
    })

    nfcReader.addEventListener('readingerror', () => {
      toast.add({
        title: 'NFC Read Error',
        description: 'Failed to read NFC tag. Try again.',
        color: 'error',
      })
    })

    toast.add({
      title: 'NFC Ready',
      description: 'Hold your device near an NFC tag.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start NFC'
    toast.add({
      title: 'NFC Error',
      description: message,
      color: 'error',
    })
  }
}

function stopNfcReading() {
  nfcReading.value = false
  nfcReader = null
}

function handleManualSubmit() {
  if (manualInput.value.trim()) {
    processScannedCode(manualInput.value.trim())
    manualInput.value = ''
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-default">
      <div class="flex items-center justify-between px-4 py-3">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          @click="router.back()"
        />
        <h1 class="font-semibold">
          Scan Asset
        </h1>
        <div class="w-10" />
      </div>

      <!-- Offline indicator -->
      <div
        v-if="!isOnline"
        class="flex items-center justify-center gap-2 px-4 py-2 bg-warning/10 text-warning text-sm"
      >
        <UIcon name="i-lucide-wifi-off" class="w-4 h-4" />
        <span>Offline - Using cached data</span>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Scanner Controls -->
      <div class="flex gap-2">
        <UButton
          v-if="!isScanning"
          label="Start Camera"
          icon="i-lucide-camera"
          color="primary"
          class="flex-1"
          @click="startScanner"
        />
        <UButton
          v-else
          label="Stop Camera"
          icon="i-lucide-camera-off"
          color="neutral"
          variant="outline"
          class="flex-1"
          @click="stopScanner"
        />

        <UButton
          v-if="nfcSupported && !nfcReading"
          label="NFC"
          icon="i-lucide-nfc"
          color="neutral"
          variant="outline"
          @click="startNfcReading"
        />
        <UButton
          v-else-if="nfcSupported && nfcReading"
          label="NFC Active"
          icon="i-lucide-nfc"
          color="primary"
          @click="stopNfcReading"
        />
      </div>

      <!-- Camera View -->
      <div class="relative">
        <div
          :id="scannerContainerId"
          class="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden"
          :class="{ hidden: !isScanning }"
        />

        <!-- Placeholder when not scanning -->
        <div
          v-if="!isScanning"
          class="w-full aspect-square bg-gray-900 rounded-lg flex flex-col items-center justify-center text-white"
        >
          <UIcon name="i-lucide-scan" class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-sm opacity-70">
            Tap "Start Camera" to scan QR code
          </p>
        </div>

        <!-- NFC Reading Indicator -->
        <div
          v-if="nfcReading && !isScanning"
          class="absolute inset-0 bg-primary/10 rounded-lg flex flex-col items-center justify-center"
        >
          <UIcon name="i-lucide-nfc" class="w-16 h-16 mb-4 text-primary animate-pulse" />
          <p class="text-sm font-medium">
            Ready to scan NFC tag
          </p>
          <p class="text-xs text-muted mt-1">
            Hold your device near the tag
          </p>
        </div>
      </div>

      <!-- Error Display -->
      <UAlert
        v-if="scanError"
        color="error"
        icon="i-lucide-alert-circle"
        :title="scanError"
      />

      <!-- Manual Input -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-sm">
            Manual Entry
          </h3>
        </template>
        <div class="flex gap-2">
          <UInput
            v-model="manualInput"
            placeholder="Enter asset ID or scan URL"
            class="flex-1"
            @keyup.enter="handleManualSubmit"
          />
          <UButton
            icon="i-lucide-search"
            color="primary"
            :disabled="!manualInput.trim()"
            @click="handleManualSubmit"
          />
        </div>

        <!-- Offline search results -->
        <div v-if="offlineSearchResults.length > 0" class="mt-4 space-y-2">
          <p class="text-xs text-muted">
            Cached assets matching your search:
          </p>
          <div
            v-for="asset in offlineSearchResults.slice(0, 5)"
            :key="asset.id"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="navigateToCachedAsset(asset.id)"
          >
            <div>
              <p class="font-medium text-sm">
                {{ asset.assetNumber }}
              </p>
              <p class="text-xs text-muted">
                {{ [asset.year, asset.make, asset.model].filter(Boolean).join(' ') || 'No details' }}
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-muted" />
          </div>
        </div>
      </UCard>

      <!-- Instructions -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-sm">
            How to Scan
          </h3>
        </template>
        <ul class="text-sm text-muted space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-camera" class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Point your camera at an asset QR code</span>
          </li>
          <li v-if="nfcSupported" class="flex items-start gap-2">
            <UIcon name="i-lucide-nfc" class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Or tap an NFC tag attached to the asset</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-type" class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Or manually enter the asset ID</span>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>

<style>
/* Hide html5-qrcode default elements we don't need */
#qr-scanner video {
  border-radius: 0.5rem;
}

#qr-scanner__dashboard_section {
  display: none !important;
}

#qr-scanner__scan_region img {
  display: none !important;
}
</style>
