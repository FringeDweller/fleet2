<script setup lang="ts">
import type { AssignedForm, TargetType } from '~/composables/useAssignedForms'

const props = defineProps<{
  targetType: TargetType
  entityId?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  formSubmitted: [formId: string, submissionId: string | undefined]
}>()

const { assignedForms, hasAssignedForms, status, refresh } = useAssignedForms(
  toRef(() => props.targetType),
  toRef(() => props.entityId),
)

// Fetch existing submissions for this context
// Only fetch when entityId is defined to prevent requests with undefined values
const submissionsQuery = computed(() => {
  if (!props.entityId) return undefined
  return {
    contextType: props.targetType,
    contextId: props.entityId,
  }
})

const { data: existingSubmissions, refresh: refreshSubmissions } = useFetch<{
  data: Array<{
    id: string
    formId: string
    status: 'draft' | 'submitted' | 'approved' | 'rejected'
    submittedAt: string
    form: { id: string; name: string } | null
    submittedBy: { firstName: string; lastName: string } | null
  }>
}>('/api/custom-form-submissions/for-context', {
  query: submissionsQuery,
  lazy: true,
  immediate: !!props.entityId,
})

// Track expanded forms and active form modal
const expandedForms = ref<Set<string>>(new Set())
const activeFormId = ref<string | null>(null)
const showFormModal = ref(false)

// Get the active form's assignment
const activeAssignment = computed(() => {
  if (!activeFormId.value) return null
  return assignedForms.value.find((a: AssignedForm) => a.form?.id === activeFormId.value)
})

// Submission type from the fetch response
type FormSubmission = {
  id: string
  formId: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  submittedAt: string
  form: { id: string; name: string } | null
  submittedBy: { firstName: string; lastName: string } | null
}

// Get submissions for a specific form
function getSubmissionsForForm(formId: string) {
  return (existingSubmissions.value?.data || []).filter((s: FormSubmission) => s.formId === formId)
}

// Check if form has a draft submission
function hasDraftSubmission(formId: string): boolean {
  return getSubmissionsForForm(formId).some((s: FormSubmission) => s.status === 'draft')
}

// Check if form has been submitted
function hasSubmittedSubmission(formId: string): boolean {
  return getSubmissionsForForm(formId).some((s: FormSubmission) => s.status === 'submitted')
}

function toggleForm(formId: string) {
  if (expandedForms.value.has(formId)) {
    expandedForms.value.delete(formId)
  } else {
    expandedForms.value.add(formId)
  }
}

function isExpanded(formId: string): boolean {
  return expandedForms.value.has(formId)
}

function openForm(formId: string) {
  activeFormId.value = formId
  showFormModal.value = true
}

function closeForm() {
  activeFormId.value = null
  showFormModal.value = false
}

function handleFormSubmitted(submissionId: string | undefined) {
  if (activeFormId.value) {
    emit('formSubmitted', activeFormId.value, submissionId)
  }
  closeForm()
  refreshSubmissions()
}

// Get field type icon
function getFieldTypeIcon(fieldType: string): string {
  const icons: Record<string, string> = {
    text: 'i-lucide-type',
    number: 'i-lucide-hash',
    date: 'i-lucide-calendar',
    time: 'i-lucide-clock',
    datetime: 'i-lucide-calendar-clock',
    dropdown: 'i-lucide-chevron-down-square',
    multi_select: 'i-lucide-list-checks',
    checkbox: 'i-lucide-check-square',
    radio: 'i-lucide-circle-dot',
    file: 'i-lucide-file',
    photo: 'i-lucide-camera',
    signature: 'i-lucide-pen-tool',
    location: 'i-lucide-map-pin',
    barcode: 'i-lucide-barcode',
    calculated: 'i-lucide-calculator',
    lookup: 'i-lucide-search',
    section: 'i-lucide-layout-list',
    textarea: 'i-lucide-align-left',
    email: 'i-lucide-mail',
    phone: 'i-lucide-phone',
    url: 'i-lucide-link',
  }
  return icons[fieldType] || 'i-lucide-form-input'
}

// Format field type for display
function formatFieldType(fieldType: string): string {
  return fieldType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Get submission status badge color
function getStatusColor(status: string): 'neutral' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'draft':
      return 'warning'
    case 'submitted':
      return 'success'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    default:
      return 'neutral'
  }
}
</script>

<template>
  <div v-if="status === 'pending'" class="flex items-center justify-center py-8">
    <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
  </div>

  <UCard v-else-if="hasAssignedForms">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-file-text" class="w-5 h-5 text-muted" />
          <h3 class="font-medium">Custom Forms</h3>
        </div>
        <UBadge color="neutral" variant="subtle" size="xs">
          {{ assignedForms.length }} form{{ assignedForms.length === 1 ? '' : 's' }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-3">
      <div
        v-for="assignment in assignedForms"
        :key="assignment.id"
        class="border border-default rounded-lg overflow-hidden"
      >
        <!-- Form header -->
        <button
          type="button"
          class="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
          @click="assignment.form && toggleForm(assignment.form.id)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              :name="isExpanded(assignment.form?.id || '') ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="w-4 h-4 text-muted"
            />
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium">{{ assignment.form?.name || 'Unknown Form' }}</span>
                <UBadge
                  v-if="assignment.isRequired"
                  color="error"
                  variant="subtle"
                  size="xs"
                >
                  Required
                </UBadge>
                <UBadge
                  v-if="assignment.form?.status === 'draft'"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >
                  Form Draft
                </UBadge>
                <!-- Show submission status if exists -->
                <template v-if="assignment.form">
                  <UBadge
                    v-if="hasSubmittedSubmission(assignment.form.id)"
                    color="success"
                    variant="subtle"
                    size="xs"
                  >
                    Submitted
                  </UBadge>
                  <UBadge
                    v-else-if="hasDraftSubmission(assignment.form.id)"
                    color="warning"
                    variant="subtle"
                    size="xs"
                  >
                    Draft Saved
                  </UBadge>
                </template>
              </div>
              <p v-if="assignment.form?.description" class="text-sm text-muted mt-0.5">
                {{ assignment.form.description }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">
              {{ assignment.form?.fields?.length || 0 }} field{{ (assignment.form?.fields?.length || 0) === 1 ? '' : 's' }}
            </span>
          </div>
        </button>

        <!-- Form details (expanded) -->
        <div
          v-if="assignment.form && isExpanded(assignment.form.id)"
          class="border-t border-default bg-muted/30 p-3"
        >
          <!-- Previous submissions -->
          <div v-if="getSubmissionsForForm(assignment.form.id).length > 0" class="mb-4">
            <p class="text-xs text-muted uppercase tracking-wide mb-2">Previous Submissions</p>
            <div class="space-y-2">
              <div
                v-for="submission in getSubmissionsForForm(assignment.form.id)"
                :key="submission.id"
                class="flex items-center justify-between p-2 bg-default rounded border border-default"
              >
                <div class="flex items-center gap-2">
                  <UBadge :color="getStatusColor(submission.status)" variant="subtle" size="xs">
                    {{ submission.status }}
                  </UBadge>
                  <span class="text-sm">
                    {{ submission.submittedBy?.firstName }} {{ submission.submittedBy?.lastName }}
                  </span>
                </div>
                <span class="text-xs text-muted">
                  {{ new Date(submission.submittedAt).toLocaleDateString() }}
                </span>
              </div>
            </div>
          </div>

          <!-- Form fields preview -->
          <p class="text-xs text-muted uppercase tracking-wide mb-3">Form Fields</p>
          <div class="space-y-2">
            <div
              v-for="field in assignment.form.fields"
              :key="field.id"
              class="flex items-start gap-2 text-sm"
            >
              <UIcon
                :name="getFieldTypeIcon(field.fieldType)"
                class="w-4 h-4 text-muted mt-0.5"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span>{{ field.label }}</span>
                  <UBadge
                    v-if="field.required"
                    color="error"
                    variant="subtle"
                    size="xs"
                  >
                    Required
                  </UBadge>
                </div>
                <p class="text-xs text-muted">
                  {{ formatFieldType(field.fieldType) }}
                  <span v-if="field.helpText"> - {{ field.helpText }}</span>
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-default flex gap-2">
            <UButton
              v-if="!readonly && assignment.form.status === 'active'"
              :label="hasDraftSubmission(assignment.form.id) ? 'Continue Draft' : 'Fill Out Form'"
              icon="i-lucide-edit"
              color="primary"
              size="sm"
              @click.stop="openForm(assignment.form.id)"
            />
            <UButton
              v-else-if="assignment.form.status !== 'active'"
              label="Form Not Active"
              icon="i-lucide-lock"
              color="neutral"
              variant="ghost"
              size="sm"
              disabled
            />
          </div>
        </div>
      </div>
    </div>
  </UCard>

  <!-- Form Modal -->
  <UModal
    v-model:open="showFormModal"
    :title="activeAssignment?.form?.name || 'Custom Form'"
    fullscreen
  >
    <template #content>
      <div class="p-6 max-w-4xl mx-auto">
        <CustomFormRenderer
          v-if="activeAssignment?.form"
          :form-id="activeAssignment.form.id"
          :fields="activeAssignment.form.fields"
          :settings="activeAssignment.form.settings"
          :context-type="targetType"
          :context-id="entityId"
          :readonly="readonly"
          @submitted="handleFormSubmitted"
          @cancel="closeForm"
        />
      </div>
    </template>
  </UModal>
</template>
