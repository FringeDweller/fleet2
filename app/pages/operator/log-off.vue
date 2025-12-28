<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const toast = useToast()
const { currentSession, hasActiveSession, sessionDuration, fetchActiveSession, logOff, isLoading } =
  useOperatorSession()

// Form data
const endOdometer = ref<number | null>(null)
const endHours = ref<number | null>(null)
const useCurrentLocation = ref(true)
const notes = ref('')
const isCapturingLocation = ref(false)
const capturedLocation = ref<{
  latitude: number
  longitude: number
  locationName?: string
} | null>(null)

// Trip summary after log off
const showSummary = ref(false)
const tripSummary = ref<{
  tripDistance: string | null
  tripDuration: string
  tripDurationMinutes: number
  startTime: string
  endTime: Date
  startOdometer: number | null
  endOdometer: number | null
  startHours: number | null
  endHours: number | null
} | null>(null)

// Redirect if no active session
onMounted(async () => {
  await fetchActiveSession()
  if (!hasActiveSession.value) {
    toast.add({
      title: 'No Active Session',
      description: 'You do not have an active session.',
      color: 'warning',
    })
    router.push('/operator/log-on')
  }
})

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

// Submit log-off
async function handleLogOff() {
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

  const result = await logOff({
    endOdometer: endOdometer.value,
    endHours: endHours.value,
    endLatitude: location?.latitude ?? null,
    endLongitude: location?.longitude ?? null,
    endLocationName: location?.locationName ?? null,
    notes: notes.value || null,
  })

  if (result.success && result.summary) {
    tripSummary.value = result.summary
    showSummary.value = true
    toast.add({
      title: 'Logged Off Successfully',
      description: 'Your session has been completed.',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } else {
    toast.add({
      title: 'Log Off Failed',
      description: result.error || 'Failed to log off.',
      color: 'error',
    })
  }
}

const formatTime = (date: string | Date) => {
  return new Date(date).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
</script>

<template>
  <UDashboardPanel id="operator-log-off">
    <template #header>
      <UDashboardNavbar title="End Session">
        <template #leading>
          <UButton
            v-if="!showSummary"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/operator/session')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto py-6 px-4">
        <!-- Trip Summary (After Log Off) -->
        <div v-if="showSummary && tripSummary" class="space-y-6">
          <div class="text-center mb-8">
            <div
              class="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
            >
              <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-success" />
            </div>
            <h1 class="text-2xl font-bold mb-2">Session Complete</h1>
            <p class="text-muted">Your trip has been recorded</p>
          </div>

          <UCard>
            <template #header>
              <h3 class="font-medium">Trip Summary</h3>
            </template>

            <div class="grid grid-cols-2 gap-6">
              <!-- Duration -->
              <div class="col-span-2 text-center py-4 bg-primary/10 rounded-lg">
                <p class="text-sm text-muted mb-1">Total Duration</p>
                <p class="text-3xl font-bold text-primary">
                  {{ tripSummary.tripDuration }}
                </p>
              </div>

              <!-- Distance -->
              <div v-if="tripSummary.tripDistance" class="text-center py-4 bg-muted/50 rounded-lg">
                <p class="text-sm text-muted mb-1">Distance Traveled</p>
                <p class="text-2xl font-bold">{{ tripSummary.tripDistance }}</p>
              </div>

              <!-- Time Range -->
              <div class="text-center py-4 bg-muted/50 rounded-lg">
                <p class="text-sm text-muted mb-1">Time</p>
                <p class="font-medium">
                  {{ formatTime(tripSummary.startTime) }} - {{ formatTime(tripSummary.endTime) }}
                </p>
                <p class="text-sm text-muted">{{ formatDate(tripSummary.startTime) }}</p>
              </div>

              <!-- Odometer -->
              <div
                v-if="tripSummary.startOdometer || tripSummary.endOdometer"
                class="col-span-2 grid grid-cols-2 gap-4"
              >
                <div>
                  <p class="text-xs text-muted mb-1">Starting Odometer</p>
                  <p class="font-medium">
                    {{
                      tripSummary.startOdometer
                        ? `${tripSummary.startOdometer.toLocaleString()} km`
                        : '-'
                    }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1">Ending Odometer</p>
                  <p class="font-medium">
                    {{
                      tripSummary.endOdometer
                        ? `${tripSummary.endOdometer.toLocaleString()} km`
                        : '-'
                    }}
                  </p>
                </div>
              </div>

              <!-- Hours -->
              <div
                v-if="tripSummary.startHours || tripSummary.endHours"
                class="col-span-2 grid grid-cols-2 gap-4"
              >
                <div>
                  <p class="text-xs text-muted mb-1">Starting Hours</p>
                  <p class="font-medium">
                    {{
                      tripSummary.startHours
                        ? `${tripSummary.startHours.toLocaleString()} hrs`
                        : '-'
                    }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1">Ending Hours</p>
                  <p class="font-medium">
                    {{
                      tripSummary.endHours ? `${tripSummary.endHours.toLocaleString()} hrs` : '-'
                    }}
                  </p>
                </div>
              </div>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UButton
              label="Back to Dashboard"
              icon="i-lucide-home"
              color="primary"
              size="lg"
              block
              @click="router.push('/')"
            />

            <UButton
              label="Start New Session"
              icon="i-lucide-log-in"
              color="neutral"
              variant="outline"
              size="lg"
              block
              @click="router.push('/operator/log-on')"
            />
          </div>
        </div>

        <!-- Log Off Form -->
        <div v-else-if="hasActiveSession && currentSession" class="space-y-6">
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold mb-2">End Session</h1>
            <p class="text-muted">Complete your log-off for {{ currentSession.asset.assetNumber }}</p>
          </div>

          <!-- Current Session Summary -->
          <UCard class="bg-muted/50">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">Current Session Duration</p>
                <p class="text-2xl font-bold">{{ sessionDuration?.formatted || '0m' }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-muted">Asset</p>
                <p class="font-medium">{{ currentSession.asset.assetNumber }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Final Meter Readings</h3>
            </template>

            <div class="space-y-4">
              <!-- Starting readings display -->
              <div class="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p class="text-xs text-muted mb-1">Starting Odometer</p>
                  <p class="font-medium">
                    {{
                      currentSession.startOdometer
                        ? `${parseFloat(currentSession.startOdometer).toLocaleString()} km`
                        : 'Not recorded'
                    }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1">Starting Hours</p>
                  <p class="font-medium">
                    {{
                      currentSession.startHours
                        ? `${parseFloat(currentSession.startHours).toLocaleString()} hrs`
                        : 'Not recorded'
                    }}
                  </p>
                </div>
              </div>

              <UFormField label="Ending Odometer (km)" hint="Optional - Enter current reading">
                <UInput
                  v-model.number="endOdometer"
                  type="number"
                  :min="currentSession.startOdometer ? parseFloat(currentSession.startOdometer) : 0"
                  step="0.1"
                  placeholder="Enter odometer reading..."
                  icon="i-lucide-gauge"
                />
              </UFormField>

              <UFormField label="Ending Hours" hint="Optional - Enter current hour meter">
                <UInput
                  v-model.number="endHours"
                  type="number"
                  :min="currentSession.startHours ? parseFloat(currentSession.startHours) : 0"
                  step="0.1"
                  placeholder="Enter hour meter reading..."
                  icon="i-lucide-clock"
                />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">End Location</h3>
            </template>

            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <UCheckbox v-model="useCurrentLocation" />
                <div>
                  <p class="font-medium text-sm">Capture current GPS location</p>
                  <p class="text-xs text-muted">Record where the asset was parked</p>
                </div>
              </div>

              <div
                v-if="capturedLocation"
                class="p-3 bg-success/10 rounded-lg flex items-center gap-3"
              >
                <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-success" />
                <div>
                  <p class="text-sm font-medium">Location captured</p>
                  <p class="text-xs text-muted font-mono">
                    {{ capturedLocation.latitude.toFixed(6) }},
                    {{ capturedLocation.longitude.toFixed(6) }}
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
              placeholder="Any notes about this trip (optional)..."
              :rows="3"
            />
          </UCard>

          <!-- Log Off Button -->
          <UButton
            label="End Session"
            icon="i-lucide-log-out"
            color="error"
            size="lg"
            block
            :loading="isLoading"
            @click="handleLogOff"
          />

          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            block
            @click="router.push('/operator/session')"
          />
        </div>

        <!-- Loading or no session -->
        <div v-else class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
