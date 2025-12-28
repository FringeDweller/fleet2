<script setup lang="ts">
import { format, parseISO } from 'date-fns'

definePageMeta({
  middleware: 'auth',
})

interface Approval {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  requestNotes: string | null
  estimatedCostAtRequest: string | null
  isEmergencyOverride: boolean
  workOrder: {
    id: string
    workOrderNumber: string
    title: string
    status: string
    priority: string
    asset: {
      id: string
      assetNumber: string
      make: string | null
      model: string | null
    }
    assignedTo: {
      id: string
      firstName: string
      lastName: string
    } | null
  }
  requestedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
  }
}

interface PendingApprovalsResponse {
  approvals: Approval[]
  canApprove: boolean
  total: number
}

const router = useRouter()
const toast = useToast()
const { isManager } = usePermissions()

const { data, status, refresh } = await useFetch<PendingApprovalsResponse>(
  '/api/work-orders/pending-approval',
  {
    default: () => ({ approvals: [], canApprove: false, total: 0 }),
  },
)

const approvalLoading = ref<string | null>(null)
const showRejectDialog = ref(false)
const selectedApprovalId = ref<string | null>(null)
const selectedWorkOrderId = ref<string | null>(null)
const rejectReason = ref('')

const priorityColors = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
} as const

function formatDate(date: string) {
  return format(parseISO(date), 'PPp')
}

function formatCurrency(value: string | null): string {
  if (!value) return '-'
  const num = Number.parseFloat(value)
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

async function approveWorkOrder(workOrderId: string) {
  approvalLoading.value = workOrderId
  try {
    await $fetch(`/api/work-orders/${workOrderId}/approve`, {
      method: 'POST',
      body: {},
    })
    toast.add({
      title: 'Work order approved',
      description: 'The work order is now open and can be started.',
    })
    refresh()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to approve work order'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    approvalLoading.value = null
  }
}

function openRejectDialog(approvalId: string, workOrderId: string) {
  selectedApprovalId.value = approvalId
  selectedWorkOrderId.value = workOrderId
  rejectReason.value = ''
  showRejectDialog.value = true
}

async function rejectWorkOrder() {
  if (!selectedWorkOrderId.value || !rejectReason.value.trim()) return

  approvalLoading.value = selectedWorkOrderId.value
  try {
    await $fetch(`/api/work-orders/${selectedWorkOrderId.value}/reject`, {
      method: 'POST',
      body: { reason: rejectReason.value },
    })
    toast.add({
      title: 'Work order rejected',
      description: 'The work order has been returned to draft status.',
    })
    showRejectDialog.value = false
    selectedApprovalId.value = null
    selectedWorkOrderId.value = null
    rejectReason.value = ''
    refresh()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reject work order'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    approvalLoading.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="pending-approvals">
    <template #header>
      <UDashboardNavbar title="Pending Approvals">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/work-orders')"
          />
        </template>

        <template #right>
          <UBadge v-if="data?.total" color="warning" size="lg">
            {{ data.total }} pending
          </UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="!data?.approvals.length" class="text-center py-12">
        <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-success mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          No pending approvals
        </h3>
        <p class="text-muted mb-4">
          {{ isManager ? 'All work orders have been reviewed.' : 'You have no pending approval requests.' }}
        </p>
        <UButton label="Back to Work Orders" @click="router.push('/work-orders')" />
      </div>

      <div v-else class="space-y-4">
        <UCard
          v-for="approval in data.approvals"
          :key="approval.id"
          class="hover:bg-muted/50 transition-colors"
        >
          <div class="flex flex-col lg:flex-row lg:items-center gap-4">
            <!-- Work Order Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <NuxtLink
                  :to="`/work-orders/${approval.workOrder.id}`"
                  class="font-semibold hover:text-primary hover:underline"
                >
                  {{ approval.workOrder.workOrderNumber }}
                </NuxtLink>
                <UBadge
                  :color="priorityColors[approval.workOrder.priority as keyof typeof priorityColors]"
                  variant="subtle"
                  size="sm"
                  class="capitalize"
                >
                  {{ approval.workOrder.priority }}
                </UBadge>
              </div>
              <p class="text-sm font-medium text-highlighted truncate">
                {{ approval.workOrder.title }}
              </p>
              <p class="text-sm text-muted">
                {{ approval.workOrder.asset.assetNumber }} -
                {{ approval.workOrder.asset.make }} {{ approval.workOrder.asset.model }}
              </p>
            </div>

            <!-- Requested By -->
            <div class="flex items-center gap-2">
              <UAvatar
                :src="approval.requestedBy.avatarUrl || undefined"
                :alt="`${approval.requestedBy.firstName} ${approval.requestedBy.lastName}`"
                size="sm"
              />
              <div>
                <p class="text-sm font-medium">
                  {{ approval.requestedBy.firstName }} {{ approval.requestedBy.lastName }}
                </p>
                <p class="text-xs text-muted">
                  {{ formatDate(approval.requestedAt) }}
                </p>
              </div>
            </div>

            <!-- Estimated Cost -->
            <div class="text-right">
              <p class="text-xs text-muted">Estimated Cost</p>
              <p class="font-semibold">
                {{ formatCurrency(approval.estimatedCostAtRequest) }}
              </p>
            </div>

            <!-- Actions -->
            <div v-if="data.canApprove" class="flex gap-2">
              <UButton
                label="Approve"
                icon="i-lucide-check"
                color="success"
                size="sm"
                :loading="approvalLoading === approval.workOrder.id"
                @click="approveWorkOrder(approval.workOrder.id)"
              />
              <UButton
                label="Reject"
                icon="i-lucide-x"
                color="error"
                variant="outline"
                size="sm"
                :loading="approvalLoading === approval.workOrder.id"
                @click="openRejectDialog(approval.id, approval.workOrder.id)"
              />
            </div>
            <div v-else>
              <UBadge color="warning" variant="subtle">
                Awaiting Review
              </UBadge>
            </div>
          </div>

          <!-- Request Notes -->
          <div v-if="approval.requestNotes" class="mt-3 pt-3 border-t border-default">
            <p class="text-xs text-muted mb-1">Request Notes:</p>
            <p class="text-sm text-muted">{{ approval.requestNotes }}</p>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Reject Dialog -->
  <UModal v-model:open="showRejectDialog">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-x-circle" class="w-5 h-5 text-error" />
            <h3 class="font-semibold">Reject Work Order</h3>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-muted">
            Please provide a reason for rejecting this work order. It will be returned to draft status.
          </p>
          <UFormField label="Reason" required>
            <UTextarea
              v-model="rejectReason"
              placeholder="Enter the reason for rejection..."
              :rows="3"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showRejectDialog = false"
            />
            <UButton
              label="Reject"
              icon="i-lucide-x"
              color="error"
              :loading="!!approvalLoading"
              :disabled="!rejectReason.trim()"
              @click="rejectWorkOrder"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
