<script setup lang="ts">
/**
 * Location capture field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'location'
    label: string
    helpText?: string
    required: boolean
  }
  modelValue:
    | { latitude: number; longitude: number; accuracy?: number; address?: string }
    | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [
    value: { latitude: number; longitude: number; accuracy?: number; address?: string } | undefined,
  ]
}>()

const isCapturing = ref(false)
const locationError = ref<string | null>(null)
const toast = useToast()

const hasLocation = computed(() => !!props.modelValue)

async function captureLocation() {
  if (props.disabled) return

  if (!navigator.geolocation) {
    toast.add({
      title: 'Not supported',
      description: 'Geolocation is not supported by your browser',
      color: 'error',
    })
    return
  }

  isCapturing.value = true
  locationError.value = null

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    })

    emit('update:modelValue', {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    })

    toast.add({
      title: 'Location captured',
      description: 'Your current location has been recorded',
    })
  } catch (err) {
    const geoError = err as GeolocationPositionError
    switch (geoError.code) {
      case geoError.PERMISSION_DENIED:
        locationError.value = 'Location permission denied'
        break
      case geoError.POSITION_UNAVAILABLE:
        locationError.value = 'Location unavailable'
        break
      case geoError.TIMEOUT:
        locationError.value = 'Location request timed out'
        break
      default:
        locationError.value = 'Failed to get location'
    }
    toast.add({
      title: 'Location error',
      description: locationError.value,
      color: 'error',
    })
  } finally {
    isCapturing.value = false
  }
}

function clearLocation() {
  emit('update:modelValue', undefined)
}

function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`
}
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error || locationError || undefined"
  >
    <div class="space-y-2">
      <!-- Location display -->
      <div
        v-if="hasLocation"
        class="p-3 bg-muted/50 rounded-lg border border-default"
      >
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-primary mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">
              {{ formatCoordinates(modelValue!.latitude, modelValue!.longitude) }}
            </p>
            <p v-if="modelValue!.accuracy" class="text-xs text-muted">
              Accuracy: {{ Math.round(modelValue!.accuracy) }}m
            </p>
            <p v-if="modelValue!.address" class="text-xs text-muted mt-1">
              {{ modelValue!.address }}
            </p>
          </div>
          <button
            v-if="!disabled"
            type="button"
            class="p-1 text-muted hover:text-error transition-colors"
            @click="clearLocation"
          >
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Capture button -->
      <div v-if="!hasLocation && !disabled" class="flex gap-2">
        <UButton
          :label="isCapturing ? 'Capturing...' : 'Capture Location'"
          :icon="isCapturing ? 'i-lucide-loader-2' : 'i-lucide-map-pin'"
          :loading="isCapturing"
          color="primary"
          variant="outline"
          @click="captureLocation"
        />
      </div>

      <!-- Update button -->
      <div v-else-if="hasLocation && !disabled" class="flex gap-2">
        <UButton
          :label="isCapturing ? 'Updating...' : 'Update Location'"
          :icon="isCapturing ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'"
          :loading="isCapturing"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="captureLocation"
        />
      </div>
    </div>
  </UFormField>
</template>
