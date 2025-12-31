<script setup lang="ts">
/**
 * Barcode/QR code scanner field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'barcode'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isScanning = ref(false)
const manualEntry = ref(false)

// Note: In a real implementation, you would integrate with a barcode scanning library
// such as @nicolo-ribaudo/chessboard-js, html5-qrcode, or a native Capacitor plugin
function startScan() {
  // Placeholder for scanner integration
  isScanning.value = true

  // Simulate scan for demo purposes
  setTimeout(() => {
    isScanning.value = false
    // In real app, this would come from the scanner
  }, 2000)
}

function toggleManualEntry() {
  manualEntry.value = !manualEntry.value
}
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <div class="space-y-3">
      <!-- Scanned value display -->
      <div
        v-if="modelValue && !manualEntry"
        class="p-3 bg-muted/50 rounded-lg border border-default"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-scan-barcode" class="w-5 h-5 text-primary" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-mono font-medium truncate">{{ modelValue }}</p>
          </div>
          <button
            v-if="!disabled"
            type="button"
            class="p-1 text-muted hover:text-error transition-colors"
            @click="emit('update:modelValue', '')"
          >
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Manual entry input -->
      <UInput
        v-if="manualEntry"
        :placeholder="field.placeholder || 'Enter barcode value...'"
        :model-value="modelValue ?? ''"
        :disabled="disabled"
        leading-icon="i-lucide-scan-barcode"
        :color="error ? 'error' : undefined"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Action buttons -->
      <div v-if="!disabled" class="flex gap-2">
        <UButton
          v-if="!modelValue && !manualEntry"
          :label="isScanning ? 'Scanning...' : 'Scan Code'"
          :icon="isScanning ? 'i-lucide-loader-2' : 'i-lucide-scan'"
          :loading="isScanning"
          color="primary"
          variant="outline"
          @click="startScan"
        />
        <UButton
          :label="manualEntry ? 'Hide Input' : 'Enter Manually'"
          :icon="manualEntry ? 'i-lucide-eye-off' : 'i-lucide-keyboard'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="toggleManualEntry"
        />
      </div>

      <!-- Scanner placeholder -->
      <div
        v-if="isScanning"
        class="aspect-video bg-black rounded-lg flex items-center justify-center"
      >
        <div class="text-center text-white">
          <UIcon name="i-lucide-scan" class="w-12 h-12 mx-auto mb-2 animate-pulse" />
          <p class="text-sm">Point camera at barcode</p>
        </div>
      </div>
    </div>
  </UFormField>
</template>
