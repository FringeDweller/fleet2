<script setup lang="ts">
import QRCode from 'qrcode'

const props = defineProps<{
  assetId: string
  assetNumber?: string
  size?: number
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const qrDataUrl = ref<string | null>(null)
const isGenerating = ref(false)
const showModal = ref(false)

const size = computed(() => props.size ?? 150)

// Generate QR code content - use fleet:// URL scheme for easy identification
const qrContent = computed(() => `fleet://asset/${props.assetId}`)

// Generate QR code on mount and when asset changes
watch(
  () => props.assetId,
  async () => {
    await generateQRCode()
  },
  { immediate: true }
)

async function generateQRCode() {
  if (!props.assetId) return

  isGenerating.value = true

  try {
    qrDataUrl.value = await QRCode.toDataURL(qrContent.value, {
      width: size.value,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  } finally {
    isGenerating.value = false
  }
}

async function downloadQRCode() {
  if (!qrDataUrl.value) return

  // Generate a larger version for download
  const largeQR = await QRCode.toDataURL(qrContent.value, {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  })

  const link = document.createElement('a')
  link.download = `asset-${props.assetNumber || props.assetId}-qr.png`
  link.href = largeQR
  link.click()
}

async function printQRCode() {
  if (!qrDataUrl.value) return

  // Generate a print-optimized version
  const printQR = await QRCode.toDataURL(qrContent.value, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  })

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Asset QR Code - ${props.assetNumber || props.assetId}</title>
      <style>
        body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          font-family: system-ui, sans-serif;
        }
        .container {
          text-align: center;
          padding: 20px;
        }
        .qr-code {
          width: 300px;
          height: 300px;
        }
        .asset-number {
          font-size: 24px;
          font-weight: bold;
          margin-top: 20px;
        }
        .asset-id {
          font-size: 12px;
          color: #666;
          margin-top: 8px;
          word-break: break-all;
        }
        @media print {
          body { margin: 0; }
          .container { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="${printQR}" alt="QR Code" class="qr-code" />
        <div class="asset-number">${props.assetNumber || 'Asset'}</div>
        <div class="asset-id">${props.assetId}</div>
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.close();
        };
      ${'<'}/script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

function copyToClipboard() {
  navigator.clipboard.writeText(qrContent.value)
}
</script>

<template>
  <div class="inline-flex flex-col items-center">
    <!-- QR Code Display -->
    <div
      class="relative bg-white rounded-lg p-2 cursor-pointer hover:shadow-md transition-shadow"
      @click="showModal = true"
    >
      <div
        v-if="isGenerating"
        class="flex items-center justify-center"
        :style="{ width: `${size}px`, height: `${size}px` }"
      >
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>
      <img
        v-else-if="qrDataUrl"
        :src="qrDataUrl"
        :alt="`QR code for ${assetNumber || assetId}`"
        :width="size"
        :height="size"
      >
      <canvas ref="canvas" class="hidden" />
    </div>

    <!-- Hint text -->
    <p class="text-xs text-muted mt-1">
      Tap to enlarge
    </p>
  </div>

  <!-- Enlarged Modal -->
  <UModal v-model:open="showModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              Asset QR Code
            </h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showModal = false"
            />
          </div>
        </template>

        <div class="flex flex-col items-center space-y-4">
          <!-- Large QR -->
          <div class="bg-white rounded-lg p-4">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              :alt="`QR code for ${assetNumber || assetId}`"
              class="w-64 h-64"
            >
          </div>

          <!-- Asset Info -->
          <div class="text-center">
            <p v-if="assetNumber" class="font-semibold text-lg">
              {{ assetNumber }}
            </p>
            <p class="text-xs text-muted break-all">
              {{ assetId }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <UButton
              label="Download"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              @click="downloadQRCode"
            />
            <UButton
              label="Print"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              @click="printQRCode"
            />
            <UButton
              label="Copy URL"
              icon="i-lucide-copy"
              color="neutral"
              variant="outline"
              @click="copyToClipboard"
            />
          </div>
        </div>

        <template #footer>
          <p class="text-xs text-muted text-center">
            Scan this QR code with the Fleet app to quickly access this asset's details.
          </p>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
