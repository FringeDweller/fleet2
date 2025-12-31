<script setup lang="ts">
/**
 * DTC Work Order Rules Settings Page (US-10.7)
 *
 * Configure rules for automatic work order creation from DTCs.
 */

definePageMeta({
  middleware: 'auth',
})

interface User {
  id: string
  firstName: string
  lastName: string
}

interface Template {
  id: string
  name: string
}

interface DtcRule {
  id: string
  name: string
  description: string | null
  dtcPattern: string
  isRegex: boolean
  shouldCreateWorkOrder: boolean
  priorityMapping: 'use_severity' | 'fixed'
  fixedPriority: string | null
  workOrderTitle: string | null
  workOrderDescription: string | null
  templateId: string | null
  autoAssignToId: string | null
  isActive: boolean
  createdById: string | null
  createdAt: string
  updatedAt: string
  createdBy: User | null
  autoAssignTo: User | null
  template: Template | null
}

const toast = useToast()

// Fetch rules
const {
  data: rulesData,
  status: rulesStatus,
  refresh: refreshRules,
} = await useFetch<{ data: DtcRule[]; total: number }>('/api/obd/dtc-rules', {
  lazy: true,
})

// Fetch technicians for auto-assign dropdown
const { data: techniciansData } = await useFetch<{ data: User[] }>('/api/technicians', {
  lazy: true,
})

// Fetch task templates for template dropdown
const { data: templatesData } = await useFetch<{ data: Template[] }>('/api/task-templates', {
  query: { limit: 100 },
  lazy: true,
})

const rules = computed(() => rulesData.value?.data ?? [])
const technicians = computed(() => techniciansData.value?.data ?? [])
const templates = computed(() => templatesData.value?.data ?? [])

// Modal state
const showRuleModal = ref(false)
const editingRule = ref<DtcRule | null>(null)
const isSubmitting = ref(false)

// Delete confirmation
const showDeleteModal = ref(false)
const deletingRule = ref<DtcRule | null>(null)
const isDeleting = ref(false)

// Form data
const formData = ref({
  name: '',
  description: '',
  dtcPattern: '',
  isRegex: false,
  shouldCreateWorkOrder: true,
  priorityMapping: 'use_severity' as 'use_severity' | 'fixed',
  fixedPriority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  workOrderTitle: '',
  workOrderDescription: '',
  templateId: undefined as string | undefined,
  autoAssignToId: undefined as string | undefined,
  isActive: true,
})

// Reset form
function resetForm() {
  formData.value = {
    name: '',
    description: '',
    dtcPattern: '',
    isRegex: false,
    shouldCreateWorkOrder: true,
    priorityMapping: 'use_severity',
    fixedPriority: 'medium',
    workOrderTitle: '',
    workOrderDescription: '',
    templateId: undefined,
    autoAssignToId: undefined,
    isActive: true,
  }
}

// Open modal for new rule
function openNewRuleModal() {
  resetForm()
  editingRule.value = null
  showRuleModal.value = true
}

// Open modal for editing
function openEditRuleModal(rule: DtcRule) {
  editingRule.value = rule
  formData.value = {
    name: rule.name,
    description: rule.description ?? '',
    dtcPattern: rule.dtcPattern,
    isRegex: rule.isRegex,
    shouldCreateWorkOrder: rule.shouldCreateWorkOrder,
    priorityMapping: rule.priorityMapping,
    fixedPriority: (rule.fixedPriority as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
    workOrderTitle: rule.workOrderTitle ?? '',
    workOrderDescription: rule.workOrderDescription ?? '',
    templateId: rule.templateId ?? undefined,
    autoAssignToId: rule.autoAssignToId ?? undefined,
    isActive: rule.isActive,
  }
  showRuleModal.value = true
}

// Submit form
async function submitForm() {
  if (!formData.value.name.trim() || !formData.value.dtcPattern.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Name and DTC pattern are required',
      color: 'error',
    })
    return
  }

  isSubmitting.value = true

  try {
    const body = {
      ...formData.value,
      description: formData.value.description || null,
      workOrderTitle: formData.value.workOrderTitle || null,
      workOrderDescription: formData.value.workOrderDescription || null,
      fixedPriority:
        formData.value.priorityMapping === 'fixed' ? formData.value.fixedPriority : null,
    }

    if (editingRule.value) {
      await $fetch(`/api/obd/dtc-rules/${editingRule.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Rule Updated',
        description: 'DTC work order rule has been updated',
        color: 'success',
      })
    } else {
      await $fetch('/api/obd/dtc-rules', {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Rule Created',
        description: 'DTC work order rule has been created',
        color: 'success',
      })
    }

    showRuleModal.value = false
    await refreshRules()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to save rule',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

// Confirm delete
function confirmDelete(rule: DtcRule) {
  deletingRule.value = rule
  showDeleteModal.value = true
}

// Delete rule
async function deleteRule() {
  if (!deletingRule.value) return

  isDeleting.value = true

  try {
    await $fetch(`/api/obd/dtc-rules/${deletingRule.value.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Rule Deleted',
      description: 'DTC work order rule has been deleted',
      color: 'success',
    })
    showDeleteModal.value = false
    deletingRule.value = null
    await refreshRules()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage ?? 'Failed to delete rule',
      color: 'error',
    })
  } finally {
    isDeleting.value = false
  }
}

// Toggle rule active state
async function toggleRuleActive(rule: DtcRule) {
  try {
    await $fetch(`/api/obd/dtc-rules/${rule.id}`, {
      method: 'PUT',
      body: {
        isActive: !rule.isActive,
      },
    })
    await refreshRules()
    toast.add({
      title: rule.isActive ? 'Rule Disabled' : 'Rule Enabled',
      description: `Rule "${rule.name}" has been ${rule.isActive ? 'disabled' : 'enabled'}`,
      color: 'success',
    })
  } catch (error) {
    console.error('Failed to toggle rule:', error)
  }
}

// Priority badge colors
const priorityColors = {
  low: 'info',
  medium: 'warning',
  high: 'error',
  critical: 'error',
} as const

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const priorityMappingOptions = [
  { value: 'use_severity', label: 'Map from DTC Severity' },
  { value: 'fixed', label: 'Use Fixed Priority' },
]
</script>

<template>
  <UDashboardPanel id="dtc-rules-settings">
    <template #header>
      <UDashboardNavbar title="DTC Work Order Rules">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/settings"
          />
        </template>
        <template #trailing>
          <UButton
            icon="i-lucide-plus"
            label="Add Rule"
            color="primary"
            @click="openNewRuleModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-5xl mx-auto py-6 px-4">
        <!-- Info banner -->
        <UAlert
          color="info"
          icon="i-lucide-info"
          class="mb-6"
        >
          <template #title>Automatic Work Order Creation from DTCs</template>
          <template #description>
            Configure rules to automatically create work orders when specific Diagnostic Trouble Codes (DTCs) are detected via OBD.
            Rules can match exact codes or use patterns for categories of codes.
          </template>
        </UAlert>

        <!-- Loading state -->
        <div v-if="rulesStatus === 'pending'" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
        </div>

        <!-- Empty state -->
        <div v-else-if="!rules.length" class="text-center py-12">
          <UIcon name="i-lucide-clipboard-list" class="w-12 h-12 text-muted mx-auto mb-4" />
          <h3 class="text-lg font-medium mb-2">No DTC Rules Configured</h3>
          <p class="text-muted mb-6">
            Create rules to automatically generate work orders when DTCs are detected.
          </p>
          <UButton
            icon="i-lucide-plus"
            label="Create First Rule"
            color="primary"
            @click="openNewRuleModal"
          />
        </div>

        <!-- Rules list -->
        <div v-else class="space-y-4">
          <UCard v-for="rule in rules" :key="rule.id">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-medium">{{ rule.name }}</h3>
                  <UBadge
                    :color="rule.isActive ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ rule.isActive ? 'Active' : 'Inactive' }}
                  </UBadge>
                  <UBadge
                    v-if="!rule.shouldCreateWorkOrder"
                    color="warning"
                    variant="subtle"
                    size="xs"
                  >
                    WO Disabled
                  </UBadge>
                </div>

                <p v-if="rule.description" class="text-sm text-muted mb-2">
                  {{ rule.description }}
                </p>

                <div class="flex flex-wrap items-center gap-4 text-sm">
                  <div class="flex items-center gap-1">
                    <span class="text-muted">Pattern:</span>
                    <code class="px-2 py-0.5 bg-muted rounded text-xs">{{ rule.dtcPattern }}</code>
                    <UBadge v-if="rule.isRegex" color="info" variant="subtle" size="xs">Regex</UBadge>
                  </div>

                  <div class="flex items-center gap-1">
                    <span class="text-muted">Priority:</span>
                    <span v-if="rule.priorityMapping === 'use_severity'">From Severity</span>
                    <UBadge
                      v-else
                      :color="priorityColors[rule.fixedPriority as keyof typeof priorityColors] ?? 'neutral'"
                      variant="subtle"
                      size="xs"
                      class="capitalize"
                    >
                      {{ rule.fixedPriority }}
                    </UBadge>
                  </div>

                  <div v-if="rule.autoAssignTo" class="flex items-center gap-1">
                    <span class="text-muted">Assign to:</span>
                    <span>{{ rule.autoAssignTo.firstName }} {{ rule.autoAssignTo.lastName }}</span>
                  </div>

                  <div v-if="rule.template" class="flex items-center gap-1">
                    <span class="text-muted">Template:</span>
                    <span>{{ rule.template.name }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <USwitch
                  :model-value="rule.isActive"
                  size="sm"
                  @update:model-value="() => toggleRuleActive(rule)"
                />
                <UDropdownMenu>
                  <UButton
                    icon="i-lucide-more-vertical"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                  />
                  <template #content>
                    <UDropdownItem
                      icon="i-lucide-pencil"
                      label="Edit Rule"
                      @click="openEditRuleModal(rule)"
                    />
                    <UDropdownItem
                      icon="i-lucide-trash-2"
                      label="Delete Rule"
                      color="error"
                      @click="confirmDelete(rule)"
                    />
                  </template>
                </UDropdownMenu>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add/Edit Rule Modal -->
  <UModal v-model:open="showRuleModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-medium">
              {{ editingRule ? 'Edit DTC Rule' : 'Create DTC Rule' }}
            </h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showRuleModal = false"
            />
          </div>
        </template>

        <div class="space-y-4">
          <!-- Name -->
          <UFormField label="Rule Name" required>
            <UInput
              v-model="formData.name"
              placeholder="e.g., Critical Engine Codes"
            />
          </UFormField>

          <!-- Description -->
          <UFormField label="Description">
            <UTextarea
              v-model="formData.description"
              placeholder="Optional description of what this rule does..."
              :rows="2"
            />
          </UFormField>

          <!-- DTC Pattern -->
          <UFormField label="DTC Pattern" required>
            <UInput
              v-model="formData.dtcPattern"
              placeholder="e.g., P0300 or P03.*"
            />
            <template #hint>
              Enter exact code (e.g., P0300) or regex pattern (e.g., P03.*)
            </template>
          </UFormField>

          <!-- Is Regex -->
          <div class="flex items-center gap-3">
            <UCheckbox v-model="formData.isRegex" />
            <div>
              <p class="font-medium text-sm">Use Regular Expression</p>
              <p class="text-xs text-muted">Enable pattern matching for multiple codes</p>
            </div>
          </div>

          <!-- Should Create Work Order -->
          <div class="flex items-center gap-3">
            <UCheckbox v-model="formData.shouldCreateWorkOrder" />
            <div>
              <p class="font-medium text-sm">Create Work Order</p>
              <p class="text-xs text-muted">Automatically create work order when DTC matches</p>
            </div>
          </div>

          <template v-if="formData.shouldCreateWorkOrder">
            <!-- Priority Mapping -->
            <UFormField label="Priority Setting">
              <USelect
                v-model="formData.priorityMapping"
                :items="priorityMappingOptions"
              />
            </UFormField>

            <!-- Fixed Priority (if selected) -->
            <UFormField v-if="formData.priorityMapping === 'fixed'" label="Work Order Priority">
              <USelect
                v-model="formData.fixedPriority"
                :items="priorityOptions"
              />
            </UFormField>

            <!-- Work Order Title -->
            <UFormField label="Work Order Title">
              <UInput
                v-model="formData.workOrderTitle"
                placeholder="Leave blank to auto-generate from DTC"
              />
            </UFormField>

            <!-- Work Order Description -->
            <UFormField label="Work Order Description">
              <UTextarea
                v-model="formData.workOrderDescription"
                placeholder="Leave blank to auto-generate from DTC details"
                :rows="3"
              />
            </UFormField>

            <!-- Template -->
            <UFormField label="Task Template">
              <USelect
                v-model="formData.templateId"
                :items="templates.map((t: Template) => ({ value: t.id, label: t.name }))"
                placeholder="Optional - Select template for checklist/parts"
              />
            </UFormField>

            <!-- Auto Assign -->
            <UFormField label="Auto-Assign To">
              <USelect
                v-model="formData.autoAssignToId"
                :items="technicians.map((t: User) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))"
                placeholder="Optional - Auto-assign to technician"
              />
            </UFormField>
          </template>

          <!-- Is Active -->
          <div class="flex items-center gap-3">
            <UCheckbox v-model="formData.isActive" />
            <div>
              <p class="font-medium text-sm">Rule Active</p>
              <p class="text-xs text-muted">Inactive rules will not trigger work order creation</p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showRuleModal = false"
            />
            <UButton
              :label="editingRule ? 'Update Rule' : 'Create Rule'"
              color="primary"
              :loading="isSubmitting"
              @click="submitForm"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Delete Confirmation Modal -->
  <UModal v-model:open="showDeleteModal">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-medium text-error">Delete DTC Rule</h3>
        </template>

        <p>
          Are you sure you want to delete the rule
          <strong>"{{ deletingRule?.name }}"</strong>?
        </p>
        <p class="text-sm text-muted mt-2">
          This action cannot be undone. Existing work orders created by this rule will not be affected.
        </p>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showDeleteModal = false"
            />
            <UButton
              label="Delete"
              color="error"
              :loading="isDeleting"
              @click="deleteRule"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
