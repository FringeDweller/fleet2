<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface SubmitterUser {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface FormVersion {
  id: string
  version: number
  name: string
  fields: Array<{
    id: string
    label: string
    fieldType: string
  }>
}

interface FormSubmission {
  id: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  submittedAt: string
  submittedBy: SubmitterUser | null
  reviewedBy: SubmitterUser | null
  reviewedAt: string | null
  submitterNotes: string | null
  reviewNotes: string | null
  contextType: string | null
  contextId: string | null
  responses: Record<string, unknown>
  version: FormVersion | null
}

interface FormField {
  id: string
  label: string
  fieldType: string
  options?: Array<{ label: string; value: string }>
}

interface ResponsesData {
  form: {
    id: string
    name: string
    fields: FormField[]
  }
  data: FormSubmission[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const formId = route.params.id as string

// Filters
const search = ref('')
const selectedStatus = ref<string | undefined>(undefined)
const dateFrom = ref<string | undefined>(undefined)
const dateTo = ref<string | undefined>(undefined)
const debouncedSearch = refDebounced(search, 300)

// Field filters
const selectedFieldId = ref<string | undefined>(undefined)
const selectedFieldValue = ref<string | undefined>(undefined)

// Pagination
const page = ref(1)
const limit = 20

// Build field filters object
const fieldFiltersJson = computed(() => {
  if (selectedFieldId.value && selectedFieldValue.value) {
    return JSON.stringify({ [selectedFieldId.value]: selectedFieldValue.value })
  }
  return undefined
})

const {
  data: responseData,
  status,
  refresh,
} = await useFetch<ResponsesData>(`/api/custom-forms/${formId}/responses`, {
  query: computed(() => ({
    search: debouncedSearch.value || undefined,
    status: selectedStatus.value || undefined,
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
    fieldFilters: fieldFiltersJson.value || undefined,
    limit,
    offset: (page.value - 1) * limit,
  })),
  lazy: true,
})

const submissions = computed(() => responseData.value?.data || [])
const form = computed(() => responseData.value?.form)
const totalPages = computed(() => Math.ceil((responseData.value?.pagination.total || 0) / limit))

// Get filterable fields (dropdowns, radios, multi-selects)
const filterableFields = computed(() => {
  if (!form.value?.fields) return []
  return form.value.fields.filter((f: FormField) =>
    ['dropdown', 'radio', 'multi_select', 'checkbox'].includes(f.fieldType),
  )
})

// Get options for selected field
const selectedFieldOptions = computed(() => {
  if (!selectedFieldId.value || !form.value?.fields) return []
  const field = form.value.fields.find((f: FormField) => f.id === selectedFieldId.value)
  if (field?.fieldType === 'checkbox') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ]
  }
  return field?.options || []
})

const statusOptions = [
  { label: 'All Status', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

function getStatusColor(status: string) {
  switch (status) {
    case 'submitted':
      return 'info'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    case 'draft':
      return 'warning'
    default:
      return 'neutral'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  if (typeof value === 'object') {
    if ('latitude' in value && 'longitude' in value) {
      const loc = value as { latitude: number; longitude: number }
      return `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
    }
    return JSON.stringify(value)
  }

  return String(value)
}

// Export handlers
const isExporting = ref(false)

async function exportCsv() {
  isExporting.value = true
  try {
    const queryParams = new URLSearchParams()
    queryParams.set('format', 'csv')

    if (selectedStatus.value) {
      queryParams.set('status', selectedStatus.value)
    }
    if (dateFrom.value) {
      queryParams.set('dateFrom', dateFrom.value)
    }
    if (dateTo.value) {
      queryParams.set('dateTo', dateTo.value)
    }
    if (fieldFiltersJson.value) {
      queryParams.set('fieldFilters', fieldFiltersJson.value)
    }

    // Trigger download - get CSV text and convert to blob
    const csvText = await $fetch<string>(
      `/api/custom-forms/${formId}/responses/export?${queryParams}`,
    )

    // Create download link
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.value?.name || 'form'}_responses.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.add({
      title: 'Export complete',
      description: 'Your CSV file has been downloaded.',
    })
  } catch {
    toast.add({
      title: 'Export failed',
      description: 'Failed to export responses.',
      color: 'error',
    })
  } finally {
    isExporting.value = false
  }
}

// View submission details
const selectedSubmission = ref<FormSubmission | null>(null)
const detailsModalOpen = ref(false)

function viewSubmission(submission: FormSubmission) {
  selectedSubmission.value = submission
  detailsModalOpen.value = true
}

// Clear field filter when field changes
watch(selectedFieldId, () => {
  selectedFieldValue.value = undefined
})

// Reset page when filters change
watch([debouncedSearch, selectedStatus, dateFrom, dateTo, fieldFiltersJson], () => {
  page.value = 1
})
</script>

<template>
  <UDashboardPanel id="form-responses">
    <template #header>
      <UDashboardNavbar :title="`${form?.name || 'Form'} Responses`">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push(`/settings/custom-forms/${formId}`)"
          />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="Analytics"
              icon="i-lucide-bar-chart-3"
              color="neutral"
              variant="soft"
              @click="router.push(`/settings/custom-forms/${formId}/analytics`)"
            />
            <UButton
              label="Export CSV"
              icon="i-lucide-download"
              color="neutral"
              variant="soft"
              :loading="isExporting"
              @click="exportCsv"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="p-4 border-b border-default space-y-4">
        <div class="flex flex-wrap items-center gap-4">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search notes..."
            class="w-64"
          />
          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            placeholder="All Status"
            class="w-40"
          />
          <div class="flex items-center gap-2">
            <UInput
              v-model="dateFrom"
              type="date"
              placeholder="From date"
              class="w-40"
            />
            <span class="text-muted">to</span>
            <UInput
              v-model="dateTo"
              type="date"
              placeholder="To date"
              class="w-40"
            />
          </div>
        </div>

        <!-- Field Filters -->
        <div v-if="filterableFields.length > 0" class="flex items-center gap-4">
          <span class="text-sm text-muted">Filter by field:</span>
          <USelect
            v-model="selectedFieldId"
            :items="[
              { label: 'Select field...', value: undefined },
              ...filterableFields.map((f: FormField) => ({ label: f.label, value: f.id }))
            ]"
            class="w-48"
          />
          <USelect
            v-if="selectedFieldId && selectedFieldOptions.length > 0"
            v-model="selectedFieldValue"
            :items="[
              { label: 'Select value...', value: undefined },
              ...selectedFieldOptions
            ]"
            class="w-48"
          />
          <UButton
            v-if="selectedFieldId"
            icon="i-lucide-x"
            variant="ghost"
            size="xs"
            @click="selectedFieldId = undefined; selectedFieldValue = undefined"
          />
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="submissions.length === 0"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
        <p class="text-lg font-medium mb-2">No responses yet</p>
        <p class="text-muted">
          When users submit this form, their responses will appear here.
        </p>
      </div>

      <!-- Responses table -->
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-default">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Submitted
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Submitted By
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Status
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Version
              </th>
              <th
                v-for="field in (form?.fields || []).slice(0, 3)"
                :key="field.id"
                class="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider max-w-[200px]"
              >
                {{ field.label }}
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-default divide-y divide-default">
            <tr
              v-for="submission in submissions"
              :key="submission.id"
              class="hover:bg-elevated/50 cursor-pointer"
              @click="viewSubmission(submission)"
            >
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                {{ formatDate(submission.submittedAt) }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span v-if="submission.submittedBy">
                  {{ submission.submittedBy.firstName }} {{ submission.submittedBy.lastName }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <UBadge :color="getStatusColor(submission.status)" variant="subtle" size="sm">
                  {{ submission.status }}
                </UBadge>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-muted">
                v{{ submission.version?.version || '-' }}
              </td>
              <td
                v-for="field in (form?.fields || []).slice(0, 3)"
                :key="field.id"
                class="px-4 py-3 text-sm max-w-[200px] truncate"
              >
                {{ formatFieldValue(submission.responses?.[field.id]) }}
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  icon="i-lucide-eye"
                  variant="ghost"
                  size="xs"
                  @click.stop="viewSubmission(submission)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-default"
      >
        <div class="text-sm text-muted">
          Showing {{ (page - 1) * limit + 1 }} to
          {{ Math.min(page * limit, responseData?.pagination.total || 0) }}
          of {{ responseData?.pagination.total || 0 }} responses
        </div>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            variant="ghost"
            :disabled="page === 1"
            @click="page--"
          />
          <span class="text-sm">
            Page {{ page }} of {{ totalPages }}
          </span>
          <UButton
            icon="i-lucide-chevron-right"
            variant="ghost"
            :disabled="page >= totalPages"
            @click="page++"
          />
        </div>
      </div>
    </template>

    <!-- Submission Details Modal -->
    <UModal v-model:open="detailsModalOpen" :ui="{ content: 'sm:max-w-3xl' }">
      <template #content>
        <UCard v-if="selectedSubmission">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <h3 class="font-medium">Submission Details</h3>
                <UBadge :color="getStatusColor(selectedSubmission.status)" variant="subtle">
                  {{ selectedSubmission.status }}
                </UBadge>
              </div>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="detailsModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-6">
            <!-- Metadata -->
            <div class="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <span class="text-sm text-muted">Submitted At</span>
                <p class="font-medium">{{ formatDate(selectedSubmission.submittedAt) }}</p>
              </div>
              <div>
                <span class="text-sm text-muted">Submitted By</span>
                <p class="font-medium">
                  <template v-if="selectedSubmission.submittedBy">
                    {{ selectedSubmission.submittedBy.firstName }}
                    {{ selectedSubmission.submittedBy.lastName }}
                  </template>
                  <template v-else>-</template>
                </p>
              </div>
              <div>
                <span class="text-sm text-muted">Form Version</span>
                <p class="font-medium">v{{ selectedSubmission.version?.version || '-' }}</p>
              </div>
              <div v-if="selectedSubmission.contextType">
                <span class="text-sm text-muted">Context</span>
                <p class="font-medium">
                  {{ selectedSubmission.contextType }}: {{ selectedSubmission.contextId }}
                </p>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="selectedSubmission.submitterNotes" class="p-4 bg-muted/50 rounded-lg">
              <span class="text-sm text-muted">Submitter Notes</span>
              <p class="mt-1">{{ selectedSubmission.submitterNotes }}</p>
            </div>

            <!-- Field Responses -->
            <div>
              <h4 class="font-medium mb-4">Responses</h4>
              <div class="space-y-3">
                <div
                  v-for="field in (selectedSubmission.version?.fields || form?.fields || [])"
                  :key="field.id"
                  class="flex flex-col border-b border-default pb-3 last:border-0"
                >
                  <span class="text-sm text-muted">{{ field.label }}</span>
                  <span class="font-medium mt-1">
                    {{ formatFieldValue(selectedSubmission.responses?.[field.id]) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Review Info -->
            <div
              v-if="selectedSubmission.reviewedAt"
              class="p-4 bg-muted/50 rounded-lg"
            >
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-lucide-check-circle" class="w-5 h-5 text-success" />
                <span class="font-medium">Reviewed</span>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted">Reviewed At</span>
                  <p>{{ formatDate(selectedSubmission.reviewedAt) }}</p>
                </div>
                <div v-if="selectedSubmission.reviewedBy">
                  <span class="text-muted">Reviewed By</span>
                  <p>
                    {{ selectedSubmission.reviewedBy.firstName }}
                    {{ selectedSubmission.reviewedBy.lastName }}
                  </p>
                </div>
              </div>
              <div v-if="selectedSubmission.reviewNotes" class="mt-2">
                <span class="text-sm text-muted">Review Notes</span>
                <p class="mt-1">{{ selectedSubmission.reviewNotes }}</p>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton label="Close" variant="ghost" @click="detailsModalOpen = false" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
