<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const toast = useToast()
const { currentSession, hasActiveSession, sessionDuration, fetchActiveSession, isLoading } =
  useOperatorSession()

// Redirect if no active session
onMounted(async () => {
  await fetchActiveSession()
  if (!hasActiveSession.value) {
    toast.add({
      title: 'No Active Session',
      description: 'You do not have an active session. Please log on first.',
      color: 'warning',
    })
    router.push('/operator/log-on')
  }
})

// Refresh session info periodically
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  refreshInterval.value = setInterval(() => {
    if (hasActiveSession.value) {
      fetchActiveSession()
    }
  }, 60000) // Refresh every minute
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <UDashboardPanel id="operator-session">
    <template #header>
      <UDashboardNavbar title="Active Session">
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
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
        </div>

        <div v-else-if="!hasActiveSession" class="text-center py-12">
          <UIcon name="i-lucide-log-in" class="w-16 h-16 text-muted mx-auto mb-4" />
          <h2 class="text-xl font-bold mb-2">No Active Session</h2>
          <p class="text-muted mb-6">You are not currently logged on to any asset.</p>
          <UButton
            label="Log On"
            icon="i-lucide-log-in"
            color="primary"
            @click="router.push('/operator/log-on')"
          />
        </div>

        <div v-else-if="currentSession" class="space-y-6">
          <!-- Status Banner -->
          <UCard class="bg-success/10 border-success/30">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <UIcon name="i-lucide-check-circle" class="w-6 h-6 text-success" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-success">Session Active</h2>
                <p class="text-sm text-success/80">
                  You are currently logged on
                </p>
              </div>
            </div>
          </UCard>

          <!-- Asset Information -->
          <UCard>
            <div class="flex items-start gap-4">
              <div
                v-if="currentSession.asset.imageUrl"
                class="w-24 h-16 rounded overflow-hidden bg-muted"
              >
                <img
                  :src="currentSession.asset.imageUrl"
                  :alt="currentSession.asset.assetNumber"
                  class="w-full h-full object-cover"
                />
              </div>
              <div v-else class="w-24 h-16 rounded bg-muted flex items-center justify-center">
                <UIcon name="i-lucide-truck" class="w-10 h-10 text-muted" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold">{{ currentSession.asset.assetNumber }}</h3>
                <p
                  v-if="currentSession.asset.make || currentSession.asset.model"
                  class="text-muted"
                >
                  {{
                    [
                      currentSession.asset.year,
                      currentSession.asset.make,
                      currentSession.asset.model,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }}
                </p>
                <p v-if="currentSession.asset.licensePlate" class="text-sm text-muted mt-1">
                  {{ currentSession.asset.licensePlate }}
                </p>
              </div>
              <NuxtLink :to="`/assets/${currentSession.asset.id}`">
                <UButton
                  icon="i-lucide-external-link"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </NuxtLink>
            </div>
          </UCard>

          <!-- Session Details -->
          <UCard>
            <template #header>
              <h3 class="font-medium">Session Details</h3>
            </template>

            <div class="grid grid-cols-2 gap-6">
              <!-- Duration -->
              <div class="col-span-2 text-center py-4 bg-muted/50 rounded-lg">
                <p class="text-sm text-muted mb-1">Session Duration</p>
                <p class="text-4xl font-bold">
                  {{ sessionDuration?.formatted || '0m' }}
                </p>
              </div>

              <!-- Start Time -->
              <div>
                <p class="text-xs text-muted mb-1">Started At</p>
                <p class="font-medium">{{ formatTime(currentSession.startTime) }}</p>
                <p class="text-sm text-muted">{{ formatDate(currentSession.startTime) }}</p>
              </div>

              <!-- Operator -->
              <div>
                <p class="text-xs text-muted mb-1">Operator</p>
                <p class="font-medium">
                  {{ currentSession.operator.firstName }} {{ currentSession.operator.lastName }}
                </p>
                <p class="text-sm text-muted">{{ currentSession.operator.email }}</p>
              </div>

              <!-- Starting Odometer -->
              <div v-if="currentSession.startOdometer">
                <p class="text-xs text-muted mb-1">Starting Odometer</p>
                <p class="font-medium">
                  {{ parseFloat(currentSession.startOdometer).toLocaleString() }} km
                </p>
              </div>

              <!-- Starting Hours -->
              <div v-if="currentSession.startHours">
                <p class="text-xs text-muted mb-1">Starting Hours</p>
                <p class="font-medium">
                  {{ parseFloat(currentSession.startHours).toLocaleString() }} hrs
                </p>
              </div>

              <!-- Starting Location -->
              <div
                v-if="currentSession.startLatitude && currentSession.startLongitude"
                class="col-span-2"
              >
                <p class="text-xs text-muted mb-1">Starting Location</p>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-map-pin" class="w-4 h-4 text-muted" />
                  <p v-if="currentSession.startLocationName" class="font-medium">
                    {{ currentSession.startLocationName }}
                  </p>
                  <p class="text-sm text-muted font-mono">
                    {{ parseFloat(currentSession.startLatitude).toFixed(6) }},
                    {{ parseFloat(currentSession.startLongitude).toFixed(6) }}
                  </p>
                  <a
                    :href="`https://www.google.com/maps?q=${currentSession.startLatitude},${currentSession.startLongitude}`"
                    target="_blank"
                    class="text-primary text-sm hover:underline"
                  >
                    View
                  </a>
                </div>
              </div>

              <!-- Notes -->
              <div v-if="currentSession.notes" class="col-span-2">
                <p class="text-xs text-muted mb-1">Notes</p>
                <p class="text-sm">{{ currentSession.notes }}</p>
              </div>
            </div>
          </UCard>

          <!-- Sync Status -->
          <UAlert
            v-if="currentSession.syncStatus === 'pending'"
            color="warning"
            icon="i-lucide-wifi-off"
            title="Pending Sync"
            description="This session will be synced when you are back online."
          />

          <!-- Actions -->
          <div class="flex flex-col gap-3">
            <UButton
              label="End Session / Log Off"
              icon="i-lucide-log-out"
              color="error"
              size="lg"
              block
              @click="router.push('/operator/log-off')"
            />

            <UButton
              label="Report Defect"
              icon="i-lucide-alert-triangle"
              color="warning"
              variant="outline"
              size="lg"
              block
              :to="`/assets/${currentSession.asset.id}?tab=defects`"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
