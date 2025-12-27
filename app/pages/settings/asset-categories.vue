<script setup lang="ts">
interface CategoryMaintenanceTemplate {
  id: string
  name: string
  description?: string
  intervalDays?: number
  intervalHours?: number
  intervalMileage?: number
  estimatedDuration?: number
  checklistItems?: string[]
}

interface DefaultPart {
  id: string
  partName: string
  partNumber?: string
  quantity: number
  estimatedCost?: number
  notes?: string
}

interface CategoryNode {
  id: string
  name: string
  description: string | null
  parentId: string | null
  defaultMaintenanceSchedules: CategoryMaintenanceTemplate[]
  defaultParts: DefaultPart[]
  isActive: boolean
  assetCount: number
  children: CategoryNode[]
}

const toast = useToast()
const showInactive = ref(false)
const modalOpen = ref(false)
const isEditing = ref(false)
const loading = ref(false)
const expandedCategories = ref<Set<string>>(new Set())

const {
  data: categoryTree,
  status,
  refresh
} = await useFetch<CategoryNode[]>('/api/asset-categories/tree', {
  query: computed(() => ({
    includeInactive: showInactive.value ? 'true' : undefined
  })),
  lazy: true,
  default: () => []
})

// Flat list for parent selection
const { data: allCategories } = await useFetch<CategoryNode[]>('/api/asset-categories/tree', {
  lazy: true,
  default: () => []
})

const currentCategory = ref({
  id: '',
  name: '',
  description: '',
  parentId: null as string | null,
  defaultMaintenanceSchedules: [] as CategoryMaintenanceTemplate[],
  defaultParts: [] as DefaultPart[],
  isActive: true
})

const newSchedule = ref({
  name: '',
  description: '',
  intervalDays: null as number | null,
  intervalHours: null as number | null,
  intervalMileage: null as number | null,
  estimatedDuration: null as number | null,
  checklistItems: ''
})

const newPart = ref({
  partName: '',
  partNumber: '',
  quantity: 1,
  estimatedCost: null as number | null,
  notes: ''
})

function flattenCategories(
  nodes: CategoryNode[],
  level = 0
): Array<{ id: string, name: string, level: number }> {
  const result: Array<{ id: string, name: string, level: number }> = []
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, level })
    if (node.children.length > 0) {
      result.push(...flattenCategories(node.children, level + 1))
    }
  }
  return result
}

const parentOptions = computed(() => {
  const flat = flattenCategories(allCategories.value || [])
  return [
    { label: 'No Parent (Root Category)', value: '' },
    ...flat
      .filter(c => c.id !== currentCategory.value.id)
      .map(c => ({
        label: '\u00A0\u00A0'.repeat(c.level) + c.name,
        value: c.id
      }))
  ]
})

function toggleExpand(id: string) {
  if (expandedCategories.value.has(id)) {
    expandedCategories.value.delete(id)
  } else {
    expandedCategories.value.add(id)
  }
}

function openCreateModal(parentId?: string) {
  isEditing.value = false
  currentCategory.value = {
    id: '',
    name: '',
    description: '',
    parentId: parentId || null,
    defaultMaintenanceSchedules: [],
    defaultParts: [],
    isActive: true
  }
  modalOpen.value = true
}

function openEditModal(category: CategoryNode) {
  isEditing.value = true
  currentCategory.value = {
    id: category.id,
    name: category.name,
    description: category.description || '',
    parentId: category.parentId,
    defaultMaintenanceSchedules: [...(category.defaultMaintenanceSchedules || [])],
    defaultParts: [...(category.defaultParts || [])],
    isActive: category.isActive
  }
  modalOpen.value = true
}

function addSchedule() {
  if (!newSchedule.value.name.trim()) return

  currentCategory.value.defaultMaintenanceSchedules.push({
    id: crypto.randomUUID(),
    name: newSchedule.value.name.trim(),
    description: newSchedule.value.description.trim() || undefined,
    intervalDays: newSchedule.value.intervalDays || undefined,
    intervalHours: newSchedule.value.intervalHours || undefined,
    intervalMileage: newSchedule.value.intervalMileage || undefined,
    estimatedDuration: newSchedule.value.estimatedDuration || undefined,
    checklistItems: newSchedule.value.checklistItems
      ? newSchedule.value.checklistItems.split('\n').filter(i => i.trim())
      : undefined
  })

  newSchedule.value = {
    name: '',
    description: '',
    intervalDays: null,
    intervalHours: null,
    intervalMileage: null,
    estimatedDuration: null,
    checklistItems: ''
  }
}

function removeSchedule(id: string) {
  currentCategory.value.defaultMaintenanceSchedules
    = currentCategory.value.defaultMaintenanceSchedules.filter(s => s.id !== id)
}

function addPart() {
  if (!newPart.value.partName.trim()) return

  currentCategory.value.defaultParts.push({
    id: crypto.randomUUID(),
    partName: newPart.value.partName.trim(),
    partNumber: newPart.value.partNumber.trim() || undefined,
    quantity: newPart.value.quantity,
    estimatedCost: newPart.value.estimatedCost || undefined,
    notes: newPart.value.notes.trim() || undefined
  })

  newPart.value = { partName: '', partNumber: '', quantity: 1, estimatedCost: null, notes: '' }
}

function removePart(id: string) {
  currentCategory.value.defaultParts = currentCategory.value.defaultParts.filter(p => p.id !== id)
}

async function saveCategory() {
  if (!currentCategory.value.name.trim()) return

  loading.value = true
  try {
    const body = {
      name: currentCategory.value.name.trim(),
      description: currentCategory.value.description.trim() || null,
      parentId: currentCategory.value.parentId || null,
      defaultMaintenanceSchedules: currentCategory.value.defaultMaintenanceSchedules,
      defaultParts: currentCategory.value.defaultParts,
      isActive: currentCategory.value.isActive
    }

    if (isEditing.value) {
      await $fetch(`/api/asset-categories/${currentCategory.value.id}`, {
        method: 'PUT',
        body
      })
      toast.add({
        title: 'Category updated',
        description: 'The asset category has been updated successfully.'
      })
    } else {
      await $fetch('/api/asset-categories', {
        method: 'POST',
        body
      })
      toast.add({
        title: 'Category created',
        description: 'The asset category has been created successfully.'
      })
    }

    modalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description:
        err.data?.statusMessage
        || (isEditing.value ? 'Failed to update category.' : 'Failed to create category.'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function toggleActive(category: CategoryNode) {
  try {
    await $fetch(`/api/asset-categories/${category.id}`, {
      method: 'PUT',
      body: { isActive: !category.isActive }
    })
    toast.add({
      title: category.isActive ? 'Category deactivated' : 'Category activated'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update category status.',
      color: 'error'
    })
  }
}

async function deleteCategory(category: CategoryNode) {
  try {
    await $fetch(`/api/asset-categories/${category.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Category deleted',
      description: `"${category.name}" has been deleted.`
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to delete category.',
      color: 'error'
    })
  }
}

function getRowActions(category: CategoryNode) {
  return [
    [
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEditModal(category)
      },
      {
        label: 'Add Subcategory',
        icon: 'i-lucide-plus',
        onSelect: () => openCreateModal(category.id)
      },
      {
        label: category.isActive ? 'Deactivate' : 'Activate',
        icon: category.isActive ? 'i-lucide-toggle-right' : 'i-lucide-toggle-left',
        onSelect: () => toggleActive(category)
      }
    ],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteCategory(category)
      }
    ]
  ]
}
</script>

<template>
  <div>
    <UPageCard
      title="Asset Categories"
      description="Organize assets with hierarchical categories. Set default maintenance schedules and parts for each category."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Create Category"
        icon="i-lucide-plus"
        color="primary"
        class="w-fit lg:ms-auto"
        @click="openCreateModal()"
      />
    </UPageCard>

    <UPageCard
      variant="subtle"
      :ui="{
        container: 'p-0 sm:p-0 gap-y-0',
        wrapper: 'items-stretch',
        header: 'p-4 mb-0 border-b border-default'
      }"
    >
      <template #header>
        <div class="flex items-center gap-4">
          <UCheckbox v-model="showInactive" label="Show inactive categories" />
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="categoryTree.length === 0" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-folder-tree" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="mb-2">
          No asset categories found
        </p>
        <UButton label="Create your first category" variant="link" @click="openCreateModal()" />
      </div>

      <div v-else class="divide-y divide-default">
        <template v-for="category in categoryTree" :key="category.id">
          <CategoryTreeItem
            :category="category"
            :level="0"
            :expanded-categories="expandedCategories"
            :get-row-actions="getRowActions"
            @toggle-expand="toggleExpand"
          />
        </template>
      </div>
    </UPageCard>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditing ? 'Edit Category' : 'Create Category' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="modalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-6" @submit.prevent="saveCategory">
            <div class="space-y-4">
              <UFormField label="Category Name" required>
                <UInput
                  v-model="currentCategory.name"
                  placeholder="e.g., Heavy Equipment, Vehicles"
                  autofocus
                />
              </UFormField>

              <UFormField label="Description">
                <UTextarea
                  v-model="currentCategory.description"
                  placeholder="Describe this category"
                  :rows="2"
                />
              </UFormField>

              <UFormField label="Parent Category">
                <USelect
                  v-model="currentCategory.parentId"
                  :items="parentOptions"
                  placeholder="Select parent category"
                />
              </UFormField>

              <div class="flex items-center pt-2">
                <UCheckbox v-model="currentCategory.isActive" label="Active category" />
              </div>
            </div>

            <!-- Default Maintenance Schedules -->
            <div class="border-t border-default pt-6">
              <h4 class="font-medium mb-4">
                Default Maintenance Schedules
              </h4>
              <p class="text-sm text-muted mb-4">
                Define maintenance schedules that will be suggested for assets in this category.
              </p>

              <div
                v-if="currentCategory.defaultMaintenanceSchedules.length > 0"
                class="space-y-2 mb-4"
              >
                <div
                  v-for="schedule in currentCategory.defaultMaintenanceSchedules"
                  :key="schedule.id"
                  class="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  <div class="flex-1 min-w-0">
                    <p class="font-medium">
                      {{ schedule.name }}
                    </p>
                    <p v-if="schedule.description" class="text-sm text-muted">
                      {{ schedule.description }}
                    </p>
                    <div class="flex items-center gap-4 text-xs text-muted mt-1 flex-wrap">
                      <span v-if="schedule.intervalDays">Every {{ schedule.intervalDays }} days</span>
                      <span v-if="schedule.intervalHours">Every {{ schedule.intervalHours }} hours</span>
                      <span v-if="schedule.intervalMileage">Every {{ schedule.intervalMileage }} km</span>
                      <span v-if="schedule.estimatedDuration">~{{ schedule.estimatedDuration }} min</span>
                      <span v-if="schedule.checklistItems?.length">{{ schedule.checklistItems.length }} checklist items</span>
                    </div>
                  </div>
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="removeSchedule(schedule.id)"
                  />
                </div>
              </div>

              <div class="p-4 border border-dashed border-default rounded-lg space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="Schedule Name">
                    <UInput v-model="newSchedule.name" placeholder="e.g., Oil Change" />
                  </UFormField>
                  <UFormField label="Est. Duration (min)">
                    <UInput
                      v-model.number="newSchedule.estimatedDuration"
                      type="number"
                      :min="1"
                      placeholder="30"
                    />
                  </UFormField>
                </div>
                <UFormField label="Description">
                  <UInput v-model="newSchedule.description" placeholder="Optional description" />
                </UFormField>
                <div class="grid grid-cols-3 gap-3">
                  <UFormField label="Every N Days">
                    <UInput
                      v-model.number="newSchedule.intervalDays"
                      type="number"
                      :min="1"
                      placeholder="90"
                    />
                  </UFormField>
                  <UFormField label="Every N Hours">
                    <UInput
                      v-model.number="newSchedule.intervalHours"
                      type="number"
                      :min="1"
                      placeholder="500"
                    />
                  </UFormField>
                  <UFormField label="Every N km">
                    <UInput
                      v-model.number="newSchedule.intervalMileage"
                      type="number"
                      :min="1"
                      placeholder="10000"
                    />
                  </UFormField>
                </div>
                <UFormField label="Checklist Items (one per line)">
                  <UTextarea
                    v-model="newSchedule.checklistItems"
                    placeholder="Drain old oil&#10;Replace filter&#10;Add new oil"
                    :rows="3"
                  />
                </UFormField>
                <div class="flex justify-end">
                  <UButton
                    label="Add Schedule"
                    icon="i-lucide-plus"
                    size="sm"
                    variant="soft"
                    :disabled="!newSchedule.name.trim()"
                    @click="addSchedule"
                  />
                </div>
              </div>
            </div>

            <!-- Default Parts -->
            <div class="border-t border-default pt-6">
              <h4 class="font-medium mb-4">
                Default Parts
              </h4>
              <p class="text-sm text-muted mb-4">
                Common parts used for assets in this category.
              </p>

              <div v-if="currentCategory.defaultParts.length > 0" class="space-y-2 mb-4">
                <div
                  v-for="part in currentCategory.defaultParts"
                  :key="part.id"
                  class="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  <div class="flex-1 min-w-0">
                    <p class="font-medium">
                      {{ part.partName }}
                      <span v-if="part.partNumber" class="text-muted font-normal">
                        ({{ part.partNumber }})
                      </span>
                    </p>
                    <div class="flex items-center gap-4 text-sm text-muted mt-1">
                      <span>Qty: {{ part.quantity }}</span>
                      <span v-if="part.estimatedCost">${{ part.estimatedCost.toFixed(2) }}</span>
                    </div>
                    <p v-if="part.notes" class="text-sm text-muted mt-1">
                      {{ part.notes }}
                    </p>
                  </div>
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="removePart(part.id)"
                  />
                </div>
              </div>

              <div class="p-4 border border-dashed border-default rounded-lg space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="Part Name">
                    <UInput v-model="newPart.partName" placeholder="e.g., Oil Filter" />
                  </UFormField>
                  <UFormField label="Part Number">
                    <UInput v-model="newPart.partNumber" placeholder="e.g., OF-123" />
                  </UFormField>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="Quantity">
                    <UInput v-model.number="newPart.quantity" type="number" :min="1" />
                  </UFormField>
                  <UFormField label="Est. Cost ($)">
                    <UInput
                      v-model.number="newPart.estimatedCost"
                      type="number"
                      :min="0"
                      :step="0.01"
                      placeholder="0.00"
                    />
                  </UFormField>
                </div>
                <UFormField label="Notes">
                  <UInput v-model="newPart.notes" placeholder="Optional notes" />
                </UFormField>
                <div class="flex justify-end">
                  <UButton
                    label="Add Part"
                    icon="i-lucide-plus"
                    size="sm"
                    variant="soft"
                    :disabled="!newPart.partName.trim()"
                    @click="addPart"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="modalOpen = false" />
              <UButton
                type="submit"
                :label="isEditing ? 'Save Changes' : 'Create Category'"
                :loading="loading"
                :disabled="!currentCategory.name.trim()"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
