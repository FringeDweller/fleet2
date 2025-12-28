<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
})

interface CustomForm {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
}

interface AssetCategory {
  id: string
  name: string
}

interface FormAssignment {
  id: string
  organisationId: string
  formId: string
  targetType: 'asset' | 'work_order' | 'inspection' | 'operator'
  categoryFilterId: string | null
  isRequired: boolean
  position: number
  createdAt: string
  updatedAt: string
  form: CustomForm | null
  categoryFilter: AssetCategory | null
  createdBy: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface AssignmentsResponse {
  data: FormAssignment[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

interface FormsResponse {
  data: CustomForm[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

interface CategoriesResponse {
  data: AssetCategory[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()

// Filters
const targetTypeFilter = ref('')

// Modal state
const modalOpen = ref(false)
const isEditing = ref(false)
const loading = ref(false)

type TargetType = 'asset' | 'work_order' | 'inspection' | 'operator'

const currentAssignment = ref({
  id: '',
  formId: '',
  targetType: 'asset' as TargetType,
  categoryFilterId: '',
  isRequired: false,
  position: 0,
})

// Fetch assignments
const queryParams = computed(() => ({
  targetType: targetTypeFilter.value || undefined,
  limit: '100',
}))

const {
  data: assignmentsResponse,
  status,
  refresh,
} = await useFetch<AssignmentsResponse>('/api/custom-form-assignments', {
  query: queryParams,
  lazy: true,
})

const assignments = computed(() => assignmentsResponse.value?.data || [])

// Fetch forms for dropdown
const { data: formsResponse } = await useFetch<FormsResponse>('/api/custom-forms', {
  query: { status: 'active', limit: '100' },
  lazy: true,
})

const forms = computed(() => formsResponse.value?.data || [])

// Fetch categories for dropdown
const { data: categoriesResponse } = await useFetch<CategoriesResponse>('/api/asset-categories', {
  query: { limit: '100' },
  lazy: true,
})

const categories = computed(() => {
  const data = categoriesResponse.value
  // Handle both formats: { data: [...] } and direct array
  if (Array.isArray(data)) {
    return data as AssetCategory[]
  }
  return (data as CategoriesResponse)?.data || []
})

const targetTypeOptions = [
  { label: 'All Target Types', value: '' },
  { label: 'Asset', value: 'asset' },
  { label: 'Work Order', value: 'work_order' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Operator', value: 'operator' },
]

const targetTypeColors: Record<string, string> = {
  asset: 'primary',
  work_order: 'warning',
  inspection: 'info',
  operator: 'success',
}

const targetTypeLabels: Record<string, string> = {
  asset: 'Asset',
  work_order: 'Work Order',
  inspection: 'Inspection',
  operator: 'Operator',
}

const formOptions = computed(() => {
  return forms.value.map((form) => ({
    label: form.name,
    value: form.id,
  }))
})

const categoryOptions = computed(() => {
  return [
    { label: 'All (No Category Filter)', value: '' },
    ...categories.value.map((cat) => ({
      label: cat.name,
      value: cat.id,
    })),
  ]
})

function openCreateModal() {
  isEditing.value = false
  currentAssignment.value = {
    id: '',
    formId: '',
    targetType: 'asset' as TargetType,
    categoryFilterId: '',
    isRequired: false,
    position: 0,
  }
  modalOpen.value = true
}

function openEditModal(assignment: FormAssignment) {
  isEditing.value = true
  currentAssignment.value = {
    id: assignment.id,
    formId: assignment.formId,
    targetType: assignment.targetType,
    categoryFilterId: assignment.categoryFilterId || '',
    isRequired: assignment.isRequired,
    position: assignment.position,
  }
  modalOpen.value = true
}

async function saveAssignment() {
  if (!currentAssignment.value.formId) {
    toast.add({
      title: 'Error',
      description: 'Please select a form.',
      color: 'error',
    })
    return
  }

  loading.value = true
  try {
    const body = {
      formId: currentAssignment.value.formId,
      targetType: currentAssignment.value.targetType,
      categoryFilterId: currentAssignment.value.categoryFilterId || null,
      isRequired: currentAssignment.value.isRequired,
      position: currentAssignment.value.position,
    }

    if (isEditing.value) {
      await $fetch(`/api/custom-form-assignments/${currentAssignment.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Assignment updated',
        description: 'The form assignment has been updated successfully.',
        color: 'success',
      })
    } else {
      await $fetch('/api/custom-form-assignments', {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Assignment created',
        description: 'The form assignment has been created successfully.',
        color: 'success',
      })
    }

    modalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description:
        err.data?.statusMessage ||
        (isEditing.value ? 'Failed to update assignment.' : 'Failed to create assignment.'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function deleteAssignment(assignment: FormAssignment) {
  if (!confirm(`Are you sure you want to remove this form assignment?`)) {
    return
  }

  try {
    await $fetch(`/api/custom-form-assignments/${assignment.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Assignment removed',
      description: `The form assignment has been removed.`,
      color: 'success',
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to remove assignment.',
      color: 'error',
    })
  }
}

function getRowActions(assignment: FormAssignment) {
  return [
    [
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEditModal(assignment),
      },
    ],
    [
      {
        label: 'Remove',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteAssignment(assignment),
      },
    ],
  ]
}

// Category filter only applies to asset and work_order
const showCategoryFilter = computed(() => {
  return ['asset', 'work_order'].includes(currentAssignment.value.targetType)
})

const columns: TableColumn<FormAssignment>[] = [
  {
    accessorKey: 'form',
    header: 'Form',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'font-medium' }, row.original.form?.name || 'Unknown Form'),
        row.original.form?.status === 'draft'
          ? h(UBadge, { color: 'warning', variant: 'subtle', size: 'xs' }, () => 'Draft')
          : null,
      ]),
  },
  {
    accessorKey: 'targetType',
    header: 'Target Type',
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: (targetTypeColors[row.original.targetType] as any) || 'neutral',
          variant: 'subtle',
          size: 'sm',
        },
        () => targetTypeLabels[row.original.targetType] || row.original.targetType,
      ),
  },
  {
    accessorKey: 'categoryFilter',
    header: 'Category Filter',
    cell: ({ row }) =>
      row.original.categoryFilter
        ? h('span', {}, row.original.categoryFilter.name)
        : h('span', { class: 'text-muted' }, 'All'),
  },
  {
    accessorKey: 'isRequired',
    header: 'Required',
    cell: ({ row }) =>
      row.original.isRequired
        ? h(UBadge, { color: 'error', variant: 'subtle', size: 'sm' }, () => 'Required')
        : h('span', { class: 'text-muted' }, 'Optional'),
  },
  {
    accessorKey: 'position',
    header: 'Order',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm' }, String(row.original.position)),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'flex justify-end' },
        h(
          resolveComponent('UDropdownMenu'),
          {
            items: getRowActions(row.original),
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-more-horizontal',
              color: 'neutral',
              variant: 'ghost',
              size: 'sm',
            }),
        ),
      ),
  },
]

// Group assignments by target type for summary
const assignmentsByType = computed(() => {
  const grouped: Record<string, number> = {}
  for (const assignment of assignments.value) {
    grouped[assignment.targetType] = (grouped[assignment.targetType] || 0) + 1
  }
  return grouped
})
</script>

<template>
  <div>
    <UPageCard
      title="Form Assignments"
      description="Assign custom forms to assets, work orders, inspections, or operators. Forms will appear on the detail pages of assigned entities."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <div class="flex items-center gap-2 w-fit lg:ms-auto">
        <UButton
          label="Custom Forms"
          icon="i-lucide-file-text"
          color="neutral"
          variant="outline"
          to="/settings/custom-forms"
        />
        <UButton
          label="Create Assignment"
          icon="i-lucide-plus"
          color="primary"
          @click="openCreateModal()"
        />
      </div>
    </UPageCard>

    <UPageCard
      variant="subtle"
      :ui="{
        container: 'p-0 sm:p-0 gap-y-0',
        wrapper: 'items-stretch',
        header: 'p-4 mb-0 border-b border-default',
      }"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-4">
            <USelect
              v-model="targetTypeFilter"
              :items="targetTypeOptions"
              placeholder="Filter by target"
              class="w-48"
            />
          </div>
          <div class="flex items-center gap-4 text-sm text-muted">
            <span v-for="(count, type) in assignmentsByType" :key="type" class="flex items-center gap-1">
              <UBadge
                :color="(targetTypeColors[type as string] as any) || 'neutral'"
                variant="subtle"
                size="xs"
              >
                {{ targetTypeLabels[type as string] || type }}
              </UBadge>
              <span>{{ count }}</span>
            </span>
          </div>
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="assignments.length === 0" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-file-plus-2" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="mb-2">No form assignments found</p>
        <p class="text-sm mb-4">Assign forms to show them on entity detail pages</p>
        <UButton label="Create your first assignment" variant="link" @click="openCreateModal()" />
      </div>

      <UTable
        v-else
        :data="assignments"
        :columns="columns"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
        }"
      />
    </UPageCard>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditing ? 'Edit Assignment' : 'Create Form Assignment' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="modalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="saveAssignment">
            <UFormField label="Form" required>
              <USelect
                v-model="currentAssignment.formId"
                :items="formOptions"
                placeholder="Select a form"
              />
              <template #hint>
                <span class="text-xs">Only active forms are shown</span>
              </template>
            </UFormField>

            <UFormField label="Target Type" required>
              <USelect
                v-model="currentAssignment.targetType"
                :items="targetTypeOptions.slice(1)"
              />
              <template #hint>
                <span class="text-xs">The type of entity this form will appear on</span>
              </template>
            </UFormField>

            <UFormField v-if="showCategoryFilter" label="Category Filter">
              <USelect
                v-model="currentAssignment.categoryFilterId"
                :items="categoryOptions"
                placeholder="Apply to all or specific category"
              />
              <template #hint>
                <span class="text-xs">Optionally limit form to specific asset categories</span>
              </template>
            </UFormField>

            <div class="flex items-center gap-4">
              <UCheckbox v-model="currentAssignment.isRequired" label="Required form" />
              <span class="text-xs text-muted">(Must be completed before entity can be saved)</span>
            </div>

            <UFormField label="Display Order">
              <UInput
                v-model.number="currentAssignment.position"
                type="number"
                :min="0"
                placeholder="0"
              />
              <template #hint>
                <span class="text-xs">Lower numbers appear first</span>
              </template>
            </UFormField>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="modalOpen = false" />
              <UButton
                type="submit"
                :label="isEditing ? 'Save Changes' : 'Create Assignment'"
                :loading="loading"
                :disabled="!currentAssignment.formId"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
