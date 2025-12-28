<script setup lang="ts">
interface Operator {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
}

interface ActiveSession {
  id: string
  operator: Operator
  startTime: string
  startOdometer: string | null
  startHours: string | null
}

const props = defineProps<{
  assetId: string
  assetNumber: string
  currentSession: ActiveSession
}>()

const emit = defineEmits<{
  success: [newSession: unknown]
  close: []
}>()

const toast = useToast()
const isOpen = defineModel<boolean>('open', { default: false })

const loading = ref(false)
const loadingOperators = ref(true)
const operators = ref<Operator[]>([])

const form = ref({
  newOperatorId: '',
  handoverType: 'shift_change' as 'shift_change' | 'break' | 'emergency' | 'other',
  handoverReason: '',
  endOdometer: '',
  endHours: '',
  endLatitude: '',
  endLongitude: '',
  endLocationName: '',
})

const handoverTypeOptions = [
  { label: 'Shift Change', value: 'shift_change', description: 'Normal shift handover' },
  { label: 'Break', value: 'break', description: 'Temporary break handover' },
  { label: 'Emergency', value: 'emergency', description: 'Emergency handover' },
  { label: 'Other', value: 'other', description: 'Other reason' },
]

// Fetch operators when modal opens
watch(isOpen, async (open) => {
  if (open) {
    await fetchOperators()
    // Pre-fill with current session readings if available
    if (props.currentSession.startOdometer) {
      form.value.endOdometer = props.currentSession.startOdometer
    }
    if (props.currentSession.startHours) {
      form.value.endHours = props.currentSession.startHours
    }
  }
})

async function fetchOperators() {
  loadingOperators.value = true
  try {
    const response = await $fetch<{ data: Operator[] }>('/api/users', {
      query: {
        limit: 100,
        isActive: true,
      },
    })
    // Filter out the current operator
    operators.value = response.data.filter((op) => op.id !== props.currentSession.operator.id)
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to load operators.',
      color: 'error',
    })
  } finally {
    loadingOperators.value = false
  }
}

const operatorOptions = computed(() => {
  return operators.value.map((op) => ({
    label: `${op.firstName} ${op.lastName}`,
    value: op.id,
    description: op.email,
  }))
})

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
      form.value.endLatitude = position.coords.latitude.toFixed(7)
      form.value.endLongitude = position.coords.longitude.toFixed(7)
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

async function performHandover() {
  if (!form.value.newOperatorId) {
    toast.add({
      title: 'Validation error',
      description: 'Please select an operator to hand over to.',
      color: 'error',
    })
    return
  }

  loading.value = true
  try {
    const response = await $fetch(`/api/assets/${props.assetId}/handover`, {
      method: 'POST',
      body: {
        newOperatorId: form.value.newOperatorId,
        handoverType: form.value.handoverType,
        handoverReason: form.value.handoverReason || undefined,
        endOdometer: form.value.endOdometer ? parseFloat(form.value.endOdometer) : undefined,
        endHours: form.value.endHours ? parseFloat(form.value.endHours) : undefined,
        endLatitude: form.value.endLatitude ? parseFloat(form.value.endLatitude) : undefined,
        endLongitude: form.value.endLongitude ? parseFloat(form.value.endLongitude) : undefined,
        endLocationName: form.value.endLocationName || undefined,
      },
    })

    toast.add({
      title: 'Handover successful',
      description:
        (response as { message?: string })?.message ||
        'Asset has been handed over to the new operator.',
      color: 'success',
    })

    // Reset form
    form.value = {
      newOperatorId: '',
      handoverType: 'shift_change',
      handoverReason: '',
      endOdometer: '',
      endHours: '',
      endLatitude: '',
      endLongitude: '',
      endLocationName: '',
    }

    isOpen.value = false
    emit('success', response)
  } catch (err: unknown) {
    const error = err as { data?: { statusMessage?: string; certificationIssues?: unknown[] } }

    // Check for certification warnings
    if (error.data?.certificationIssues) {
      toast.add({
        title: 'Certification issues',
        description: 'The new operator has certification issues. Check the response for details.',
        color: 'warning',
      })
    } else {
      toast.add({
        title: 'Handover failed',
        description: error.data?.statusMessage || 'Failed to perform handover.',
        color: 'error',
      })
    }
  } finally {
    loading.value = false
  }
}

const selectedOperator = computed(() => {
  return operators.value.find((op) => op.id === form.value.newOperatorId)
})

// Calculate current session duration
const sessionDuration = computed(() => {
  if (!props.currentSession?.startTime) return null
  const now = new Date()
  const start = new Date(props.currentSession.startTime)
  const diffMinutes = Math.round((now.getTime() - start.getTime()) / (1000 * 60))
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-users" class="w-5 h-5 text-primary" />
              <h3 class="font-medium">
                Shift Handover - {{ assetNumber }}
              </h3>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="isOpen = false"
            />
          </div>
        </template>

        <div class="space-y-6">
          <!-- Current Session Info -->
          <div class="bg-muted/50 rounded-lg p-4">
            <h4 class="text-sm font-medium mb-3">
              Current Session
            </h4>
            <div class="flex items-center gap-3">
              <UAvatar
                :src="currentSession.operator.avatarUrl || undefined"
                :alt="`${currentSession.operator.firstName} ${currentSession.operator.lastName}`"
                size="md"
              />
              <div class="flex-1">
                <p class="font-medium">
                  {{ currentSession.operator.firstName }} {{ currentSession.operator.lastName }}
                </p>
                <p class="text-sm text-muted">
                  {{ currentSession.operator.email }}
                </p>
              </div>
              <div class="text-right">
                <UBadge color="success" variant="subtle">
                  Active
                </UBadge>
                <p v-if="sessionDuration" class="text-xs text-muted mt-1">
                  {{ sessionDuration }}
                </p>
              </div>
            </div>
          </div>

          <!-- Handover Form -->
          <div class="space-y-4">
            <!-- New Operator Selection -->
            <UFormField label="Hand over to" required>
              <div v-if="loadingOperators" class="flex items-center gap-2 text-muted text-sm py-2">
                <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
                Loading operators...
              </div>
              <USelect
                v-else
                v-model="form.newOperatorId"
                :items="operatorOptions"
                placeholder="Select an operator..."
                class="w-full"
                searchable
              />
            </UFormField>

            <!-- Selected Operator Preview -->
            <div v-if="selectedOperator" class="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <UAvatar
                :src="selectedOperator.avatarUrl || undefined"
                :alt="`${selectedOperator.firstName} ${selectedOperator.lastName}`"
                size="sm"
              />
              <div class="flex-1">
                <p class="font-medium text-primary">
                  {{ selectedOperator.firstName }} {{ selectedOperator.lastName }}
                </p>
                <p class="text-xs text-muted">
                  {{ selectedOperator.email }}
                </p>
              </div>
              <UIcon name="i-lucide-arrow-right" class="w-4 h-4 text-primary" />
            </div>

            <!-- Handover Type -->
            <UFormField label="Handover Type">
              <USelect
                v-model="form.handoverType"
                :items="handoverTypeOptions"
              />
            </UFormField>

            <!-- Handover Reason -->
            <UFormField label="Reason (optional)">
              <UTextarea
                v-model="form.handoverReason"
                placeholder="Enter the reason for handover..."
                :rows="2"
              />
            </UFormField>

            <!-- Readings Section (collapsible) -->
            <UAccordion :items="[{ label: 'End Readings (Optional)', value: 'readings', defaultOpen: false }]">
              <template #content>
                <div class="space-y-4 pt-4">
                  <div class="grid grid-cols-2 gap-4">
                    <UFormField label="End Odometer (km)">
                      <UInput
                        v-model="form.endOdometer"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Current odometer reading"
                      />
                    </UFormField>
                    <UFormField label="End Hours">
                      <UInput
                        v-model="form.endHours"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Current engine hours"
                      />
                    </UFormField>
                  </div>

                  <div class="flex gap-2">
                    <UButton
                      label="Use Current Location"
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
                        v-model="form.endLatitude"
                        type="number"
                        step="0.0000001"
                        min="-90"
                        max="90"
                        placeholder="-33.8688"
                      />
                    </UFormField>
                    <UFormField label="Longitude">
                      <UInput
                        v-model="form.endLongitude"
                        type="number"
                        step="0.0000001"
                        min="-180"
                        max="180"
                        placeholder="151.2093"
                      />
                    </UFormField>
                  </div>

                  <UFormField label="Location Name">
                    <UInput
                      v-model="form.endLocationName"
                      placeholder="e.g. Sydney Depot"
                    />
                  </UFormField>
                </div>
              </template>
            </UAccordion>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="isOpen = false"
            />
            <UButton
              label="Handover"
              icon="i-lucide-users"
              color="primary"
              :loading="loading"
              :disabled="!form.newOperatorId"
              @click="performHandover"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
