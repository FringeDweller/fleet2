<script setup lang="ts">
import { format, formatDistanceToNow, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const defectId = computed(() => route.params.id as string)

interface DefectDetail {
  id: string
  title: string
  description: string | null
  category: string | null
  severity: 'minor' | 'major' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  location: string | null
  photos: string | null
  reportedAt: string
  updatedAt: string
  resolvedAt: string | null
  resolutionNotes: string | null
  asset: {
    id: string
    assetNumber: string
    make: string | null
    model: string | null
    year: number | null
  }
  inspection: {
    id: string
    status: string
    overallResult: string | null
    startedAt: string
    completedAt: string | null
    operator: {
      id: string
      firstName: string
      lastName: string
    }
    template: {
      id: string
      name: string
    } | null
  } | null
  inspectionItem: {
    id: string
    checklistItemLabel: string
    checklistItemType: string
    result: string
    notes: string | null
  } | null
  workOrder: {
    id: string
    workOrderNumber: string
    status: string
    priority: string
    title: string
  } | null
  reportedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  resolvedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

const {
  data: defect,
  status,
  refresh,
} = await useFetch<DefectDetail>(`/api/defects/${defectId.value}`, {
  lazy: true,
})

const isLoading = computed(() => status.value === 'pending')

const parsedPhotos = computed(() => {
  if (!defect.value?.photos) return []
  try {
    return JSON.parse(defect.value.photos) as string[]
  } catch {
    return []
  }
})

const severityColors = {
  minor: 'neutral',
  major: 'warning',
  critical: 'error',
} as const

const statusColors = {
  open: 'error',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
} as const

const statusLabels = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
} as const

const workOrderStatusColors: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> =
  {
    draft: 'neutral',
    pending_approval: 'warning',
    open: 'info',
    in_progress: 'warning',
    pending_parts: 'warning',
    completed: 'success',
    closed: 'neutral',
  }

// Resolution modal
const isResolveModalOpen = ref(false)
const resolutionNotes = ref('')
const isResolving = ref(false)

async function openResolveModal() {
  resolutionNotes.value = ''
  isResolveModalOpen.value = true
}

async function resolveDefect() {
  if (!defect.value) return

  isResolving.value = true
  try {
    await $fetch(`/api/defects/${defect.value.id}`, {
      method: 'PATCH',
      body: {
        status: 'resolved',
        resolutionNotes: resolutionNotes.value || undefined,
      },
    })
    toast.add({
      title: 'Defect resolved',
      description: 'The defect has been marked as resolved.',
    })
    isResolveModalOpen.value = false
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to resolve defect.',
      color: 'error',
    })
  } finally {
    isResolving.value = false
  }
}

async function updateStatus(newStatus: 'open' | 'in_progress' | 'resolved' | 'closed') {
  if (!defect.value) return

  try {
    await $fetch(`/api/defects/${defect.value.id}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    toast.add({
      title: 'Status updated',
      description: `Defect status changed to ${statusLabels[newStatus]}.`,
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update status.',
      color: 'error',
    })
  }
}

// Create work order for this defect
async function createWorkOrder() {
  if (!defect.value) return

  try {
    const result = await $fetch('/api/work-orders', {
      method: 'POST',
      body: {
        assetId: defect.value.asset.id,
        title: `Defect: ${defect.value.title}`,
        description: `Created from defect report.\n\n${defect.value.description || ''}${defect.value.location ? `\n\nLocation: ${defect.value.location}` : ''}`,
        priority:
          defect.value.severity === 'critical'
            ? 'critical'
            : defect.value.severity === 'major'
              ? 'high'
              : 'medium',
        status: 'open',
      },
    })

    // Link the work order to the defect
    await $fetch(`/api/defects/${defect.value.id}`, {
      method: 'PATCH',
      body: { workOrderId: result.id },
    })

    toast.add({
      title: 'Work order created',
      description: `Work order ${result.workOrderNumber} has been created.`,
    })

    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to create work order.',
      color: 'error',
    })
  }
}
</script>

<template>
  <UDashboardPanel id="defect-detail">
    <template #header>
      <UDashboardNavbar :title="defect?.title || 'Defect Details'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.back()"
          />
        </template>

        <template #right>
          <template v-if="defect">
            <UButton
              v-if="defect.status === 'open'"
              label="Start Work"
              icon="i-lucide-play"
              color="warning"
              variant="outline"
              class="mr-2"
              @click="updateStatus('in_progress')"
            />
            <UButton
              v-if="defect.status !== 'resolved' && defect.status !== 'closed'"
              label="Resolve"
              icon="i-lucide-check-circle"
              color="success"
              @click="openResolveModal"
            />
            <UButton
              v-if="!defect.workOrder"
              label="Create Work Order"
              icon="i-lucide-clipboard-plus"
              color="primary"
              variant="outline"
              class="ml-2"
              @click="createWorkOrder"
            />
          </template>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="defect" class="space-y-6 max-w-5xl mx-auto">
        <!-- Header Section -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <UBadge :color="severityColors[defect.severity as keyof typeof severityColors]" variant="subtle" class="capitalize">
                {{ defect.severity }}
              </UBadge>
              <UBadge :color="statusColors[defect.status as keyof typeof statusColors]" variant="subtle">
                {{ statusLabels[defect.status as keyof typeof statusLabels] }}
              </UBadge>
              <span v-if="defect.category" class="text-sm text-muted">{{ defect.category }}</span>
            </div>
            <h1 class="text-2xl font-semibold text-highlighted">{{ defect.title }}</h1>
            <p v-if="defect.description" class="mt-2 text-muted whitespace-pre-wrap">
              {{ defect.description }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Asset Info Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-truck" class="w-5 h-5 text-muted" />
                <span class="font-medium">Asset</span>
              </div>
            </template>

            <div class="space-y-3">
              <NuxtLink
                :to="`/assets/${defect.asset.id}`"
                class="text-lg font-medium text-primary hover:underline"
              >
                {{ defect.asset.assetNumber }}
              </NuxtLink>
              <p v-if="defect.asset.make || defect.asset.model" class="text-muted">
                {{ [defect.asset.make, defect.asset.model, defect.asset.year].filter(Boolean).join(' ') }}
              </p>
              <p v-if="defect.location" class="flex items-center gap-2 text-sm">
                <UIcon name="i-lucide-map-pin" class="w-4 h-4 text-muted" />
                <span>{{ defect.location }}</span>
              </p>
            </div>
          </UCard>

          <!-- Work Order Card -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-clipboard-list" class="w-5 h-5 text-muted" />
                <span class="font-medium">Work Order</span>
              </div>
            </template>

            <div v-if="defect.workOrder" class="space-y-3">
              <NuxtLink
                :to="`/work-orders/${defect.workOrder.id}`"
                class="text-lg font-medium text-primary hover:underline"
              >
                {{ defect.workOrder.workOrderNumber }}
              </NuxtLink>
              <p class="text-muted">{{ defect.workOrder.title }}</p>
              <div class="flex items-center gap-2">
                <UBadge
                  :color="workOrderStatusColors[defect.workOrder.status] || 'neutral'"
                  variant="subtle"
                  class="capitalize"
                >
                  {{ defect.workOrder.status.replace('_', ' ') }}
                </UBadge>
                <UBadge variant="outline" class="capitalize">
                  {{ defect.workOrder.priority }}
                </UBadge>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <p class="text-muted mb-3">No work order linked</p>
              <UButton
                label="Create Work Order"
                icon="i-lucide-plus"
                size="sm"
                variant="soft"
                @click="createWorkOrder"
              />
            </div>
          </UCard>
        </div>

        <!-- Inspection Source Card (if from inspection) -->
        <UCard v-if="defect.inspection">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-clipboard-check" class="w-5 h-5 text-muted" />
              <span class="font-medium">Source Inspection</span>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-start justify-between">
              <div>
                <NuxtLink
                  :to="`/inspections/${defect.inspection.id}`"
                  class="text-lg font-medium text-primary hover:underline"
                >
                  {{ defect.inspection.template?.name || 'Inspection' }}
                </NuxtLink>
                <p class="text-sm text-muted mt-1">
                  Performed by {{ defect.inspection.operator.firstName }} {{ defect.inspection.operator.lastName }}
                </p>
                <p class="text-sm text-muted">
                  Completed {{ defect.inspection.completedAt ? format(parseISO(defect.inspection.completedAt), 'PPpp') : 'N/A' }}
                </p>
              </div>
              <UBadge
                :color="defect.inspection.overallResult === 'pass' ? 'success' : defect.inspection.overallResult === 'fail' ? 'error' : 'warning'"
                variant="subtle"
                class="capitalize"
              >
                {{ defect.inspection.overallResult || defect.inspection.status }}
              </UBadge>
            </div>

            <div v-if="defect.inspectionItem" class="border-t pt-4">
              <h4 class="font-medium mb-2">Failed Item</h4>
              <div class="bg-muted/50 rounded-lg p-3">
                <div class="flex items-center justify-between">
                  <span class="font-medium">{{ defect.inspectionItem.checklistItemLabel }}</span>
                  <UBadge color="error" variant="subtle" size="xs">
                    {{ defect.inspectionItem.result }}
                  </UBadge>
                </div>
                <p v-if="defect.inspectionItem.notes" class="text-sm text-muted mt-1">
                  {{ defect.inspectionItem.notes }}
                </p>
                <span class="text-xs text-muted capitalize">
                  Type: {{ defect.inspectionItem.checklistItemType }}
                </span>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Photos -->
        <UCard v-if="parsedPhotos.length > 0">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-image" class="w-5 h-5 text-muted" />
              <span class="font-medium">Photos</span>
            </div>
          </template>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <a
              v-for="(photo, index) in parsedPhotos"
              :key="index"
              :href="photo"
              target="_blank"
              class="aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all"
            >
              <img :src="photo" :alt="`Defect photo ${index + 1}`" class="w-full h-full object-cover" />
            </a>
          </div>
        </UCard>

        <!-- Timeline / Metadata -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-history" class="w-5 h-5 text-muted" />
              <span class="font-medium">Details</span>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="text-sm font-medium text-muted mb-1">Reported By</h4>
              <p>{{ defect.reportedBy.firstName }} {{ defect.reportedBy.lastName }}</p>
              <p class="text-sm text-muted">{{ defect.reportedBy.email }}</p>
            </div>
            <div>
              <h4 class="text-sm font-medium text-muted mb-1">Reported At</h4>
              <p>{{ format(parseISO(defect.reportedAt), 'PPpp') }}</p>
              <p class="text-sm text-muted">
                {{ formatDistanceToNow(parseISO(defect.reportedAt), { addSuffix: true }) }}
              </p>
            </div>
            <div v-if="defect.resolvedBy">
              <h4 class="text-sm font-medium text-muted mb-1">Resolved By</h4>
              <p>{{ defect.resolvedBy.firstName }} {{ defect.resolvedBy.lastName }}</p>
              <p class="text-sm text-muted">{{ defect.resolvedBy.email }}</p>
            </div>
            <div v-if="defect.resolvedAt">
              <h4 class="text-sm font-medium text-muted mb-1">Resolved At</h4>
              <p>{{ format(parseISO(defect.resolvedAt), 'PPpp') }}</p>
            </div>
            <div v-if="defect.resolutionNotes" class="md:col-span-2">
              <h4 class="text-sm font-medium text-muted mb-1">Resolution Notes</h4>
              <p class="whitespace-pre-wrap">{{ defect.resolutionNotes }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <div v-else class="flex flex-col items-center justify-center h-96">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-muted mb-4" />
        <p class="text-lg text-muted">Defect not found</p>
        <UButton label="Go back" variant="link" class="mt-2" @click="router.back()" />
      </div>
    </template>

    <!-- Resolve Modal -->
    <UModal v-model:open="isResolveModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Resolve Defect</h3>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                @click="isResolveModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-muted">
              Add any notes about how this defect was resolved (optional).
            </p>
            <UTextarea
              v-model="resolutionNotes"
              placeholder="Describe how the defect was resolved..."
              :rows="4"
            />
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="outline"
                @click="isResolveModalOpen = false"
              />
              <UButton
                label="Resolve Defect"
                color="success"
                :loading="isResolving"
                @click="resolveDefect"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
