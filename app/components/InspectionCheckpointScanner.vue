<script setup lang="ts">
import { Html5Qrcode } from 'html5-qrcode'

interface CheckpointDefinition {
  id: string
  name: string
  position: string
  required: boolean
}

interface CheckpointScan {
  id: string
  scannedAt: string
  scanMethod: string
  scannedBy: {
    id: string
    firstName: string
    lastName: string
  }
}

interface CheckpointStatus {
  id: string
  name: string
  description: string | null
  position: string
  required: boolean
  scanned: boolean
  scan: CheckpointScan | null
}

interface CheckpointStatusResponse {
  inspectionId: string
  hasCheckpoints: boolean
  checkpoints: CheckpointStatus[]
  allRequiredComplete: boolean
  progress: {
    total: number
    scanned: number
    required: number
    requiredScanned: number
    percentage: number
  }
}

const props = defineProps<{
  inspectionId: string
}>()

const emit = defineEmits<{
  (e: 'update', status: CheckpointStatusResponse): void
  (e: 'complete'): void
}>()

const toast = useToast()
const scannerContainerId = `checkpoint-scanner-${props.inspectionId}`
const isScanning = ref(false)
const nfcSupported = ref(false)
const nfcReading = ref(false)
const scanError = ref<string | null>(null)
const isLoading = ref(false)

let html5QrCode: Html5Qrcode | null = null
let nfcReader: NDEFReader | null = null

// Fetch checkpoint status
const {
  data: checkpointStatus,
  status: fetchStatus,
  refresh,
} = await useFetch<CheckpointStatusResponse>(
  `/api/inspections/${props.inspectionId}/checkpoint-status`,
  {
    lazy: true,
  },
)

// Emit updates when status changes
watch(
  checkpointStatus,
  (status) => {
    if (status) {
      emit('update', status)
      if (status.allRequiredComplete) {
        emit('complete')
      }
    }
  },
  { immediate: true },
)

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
        qrbox: { width: 200, height: 200 },
      },
      onScanSuccess,
      () => {}, // Ignore scan failures
    )

    isScanning.value = true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start camera'
    scanError.value = message
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
  // Stop scanning after successful scan
  await stopScanner()

  // Process the scan
  await processScan(decodedText, 'qr_code')
}

async function processScan(scanData: string, scanMethod: 'qr_code' | 'nfc') {
  isLoading.value = true
  scanError.value = null

  try {
    // Get current GPS position
    let latitude: number | undefined
    let longitude: number | undefined

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        })
      })
      latitude = position.coords.latitude
      longitude = position.coords.longitude
    } catch {
      // GPS is optional, continue without it
    }

    await $fetch(`/api/inspections/${props.inspectionId}/scan-checkpoint`, {
      method: 'POST',
      body: {
        scanData,
        scanMethod,
        latitude,
        longitude,
      },
    })

    toast.add({
      title: 'Checkpoint scanned',
      description: 'Checkpoint has been recorded.',
      color: 'success',
    })

    // Refresh status
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    scanError.value = err.data?.statusMessage || 'Failed to record checkpoint scan'
    toast.add({
      title: 'Scan failed',
      description: scanError.value,
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

async function startNfcReading() {
  if (!nfcSupported.value) return

  try {
    nfcReader = new NDEFReader()
    await nfcReader.scan()
    nfcReading.value = true

    nfcReader.addEventListener('reading', (event: Event) => {
      const ndefEvent = event as NDEFReadingEvent
      for (const record of ndefEvent.message.records) {
        if (record.recordType === 'text' || record.recordType === 'url') {
          const textDecoder = new TextDecoder()
          const text = textDecoder.decode(record.data)
          processScan(text, 'nfc')
          break
        }
      }
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

function getPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    front: 'Front',
    rear: 'Rear',
    left_side: 'Left Side',
    right_side: 'Right Side',
    engine_bay: 'Engine Bay',
    cab_interior: 'Cab Interior',
    undercarriage: 'Undercarriage',
    roof: 'Roof',
    fuel_tank: 'Fuel Tank',
    hydraulic: 'Hydraulic System',
    boom_arm: 'Boom/Arm',
    bucket: 'Bucket/Attachment',
    tracks_wheels: 'Tracks/Wheels',
  }
  return labels[position] || position
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Loading state -->
    <div v-if="fetchStatus === 'pending'" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
    </div>

    <!-- No checkpoints configured -->
    <div v-else-if="!checkpointStatus?.hasCheckpoints" class="text-center py-6 text-muted">
      <UIcon name="i-lucide-check-circle" class="w-8 h-8 mx-auto mb-2 text-success" />
      <p class="text-sm">No checkpoints required for this asset type.</p>
    </div>

    <!-- Checkpoint list and scanner -->
    <template v-else-if="checkpointStatus">
      <!-- Progress bar -->
      <div class="bg-elevated p-4 rounded-lg border border-default">
        <div class="flex items-center justify-between text-sm mb-2">
          <span class="font-medium">Walk-Around Checkpoints</span>
          <span class="text-muted">
            {{ checkpointStatus.progress.scanned }} / {{ checkpointStatus.progress.total }} scanned
          </span>
        </div>
        <div class="h-2 bg-muted/30 rounded-full overflow-hidden" role="progressbar" :aria-valuenow="checkpointStatus.progress.percentage" aria-valuemin="0" aria-valuemax="100">
          <div
            class="h-full transition-all duration-300"
            :class="checkpointStatus.allRequiredComplete ? 'bg-success' : 'bg-primary'"
            :style="{ width: `${checkpointStatus.progress.percentage}%` }"
          />
        </div>
        <div v-if="!checkpointStatus.allRequiredComplete" class="mt-2 text-xs text-warning">
          {{ checkpointStatus.progress.required - checkpointStatus.progress.requiredScanned }} required checkpoint(s) remaining
        </div>
      </div>

      <!-- Scanner controls -->
      <div class="flex gap-2">
        <UButton
          v-if="!isScanning"
          label="Scan QR"
          icon="i-lucide-qr-code"
          color="primary"
          class="flex-1"
          :loading="isLoading"
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
          :loading="isLoading"
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

      <!-- Camera view -->
      <div
        v-show="isScanning"
        :id="scannerContainerId"
        class="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden"
      />

      <!-- Error display -->
      <UAlert
        v-if="scanError"
        color="error"
        icon="i-lucide-alert-circle"
        :title="scanError"
        class="mt-2"
      />

      <!-- Checkpoint list -->
      <div class="space-y-2">
        <div
          v-for="checkpoint in checkpointStatus.checkpoints"
          :key="checkpoint.id"
          class="flex items-center gap-3 p-3 rounded-lg border"
          :class="checkpoint.scanned ? 'border-success bg-success/5' : 'border-default bg-muted/30'"
        >
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            :class="checkpoint.scanned ? 'bg-success text-white' : 'bg-muted text-muted-foreground'"
          >
            <UIcon
              v-if="checkpoint.scanned"
              name="i-lucide-check"
              class="w-4 h-4"
            />
            <UIcon
              v-else-if="checkpoint.required"
              name="i-lucide-circle-dot"
              class="w-4 h-4"
            />
            <UIcon
              v-else
              name="i-lucide-circle"
              class="w-4 h-4"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">{{ checkpoint.name }}</span>
              <UBadge
                v-if="checkpoint.required"
                :color="checkpoint.scanned ? 'success' : 'warning'"
                variant="subtle"
                size="xs"
              >
                Required
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              {{ getPositionLabel(checkpoint.position) }}
            </p>
            <p
              v-if="checkpoint.scanned && checkpoint.scan"
              class="text-xs text-success mt-1"
            >
              Scanned at {{ formatTime(checkpoint.scan.scannedAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Completion status -->
      <UAlert
        v-if="checkpointStatus.allRequiredComplete"
        color="success"
        icon="i-lucide-check-circle"
        title="All required checkpoints complete"
        description="You can now proceed with the inspection."
      />
    </template>
  </div>
</template>

<style>
/* Hide html5-qrcode default elements */
#checkpoint-scanner video {
  border-radius: 0.5rem;
}

#checkpoint-scanner__dashboard_section {
  display: none !important;
}

#checkpoint-scanner__scan_region img {
  display: none !important;
}
</style>
