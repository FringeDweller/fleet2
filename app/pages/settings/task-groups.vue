<script setup lang="ts">
interface TaskTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  isActive: boolean
}

interface TaskGroupNode {
  id: string
  name: string
  description: string | null
  parentId: string | null
  sortOrder: number
  templates: TaskTemplate[]
  children: TaskGroupNode[]
}

const router = useRouter()
const toast = useToast()
const modalOpen = ref(false)
const isEditing = ref(false)
const loading = ref(false)
const expandedGroups = ref<Set<string>>(new Set())

const {
  data: groupTree,
  status,
  refresh,
} = await useFetch<TaskGroupNode[]>('/api/task-groups', {
  lazy: true,
  default: () => [],
})

// Flat list for parent selection
const { data: allGroups } = await useFetch<TaskGroupNode[]>('/api/task-groups', {
  lazy: true,
  default: () => [],
})

const currentGroup = ref({
  id: '',
  name: '',
  description: '',
  parentId: undefined as string | undefined,
  sortOrder: 0,
})

function flattenGroups(
  nodes: TaskGroupNode[],
  level = 0,
): Array<{ id: string; name: string; level: number }> {
  const result: Array<{ id: string; name: string; level: number }> = []
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, level })
    if (node.children.length > 0) {
      result.push(...flattenGroups(node.children, level + 1))
    }
  }
  return result
}

const parentOptions = computed(() => {
  const flat = flattenGroups(allGroups.value || [])
  return [
    { label: 'No Parent (Root Group)', value: '' },
    ...flat
      .filter((g) => g.id !== currentGroup.value.id)
      .map((g) => ({
        label: '\u00A0\u00A0'.repeat(g.level) + g.name,
        value: g.id,
      })),
  ]
})

function toggleExpand(id: string) {
  if (expandedGroups.value.has(id)) {
    expandedGroups.value.delete(id)
  } else {
    expandedGroups.value.add(id)
  }
}

function openCreateModal(parentId?: string) {
  isEditing.value = false
  currentGroup.value = {
    id: '',
    name: '',
    description: '',
    parentId: parentId || undefined,
    sortOrder: 0,
  }
  modalOpen.value = true
}

function openEditModal(group: TaskGroupNode) {
  isEditing.value = true
  currentGroup.value = {
    id: group.id,
    name: group.name,
    description: group.description || '',
    parentId: group.parentId ?? undefined,
    sortOrder: group.sortOrder,
  }
  modalOpen.value = true
}

async function saveGroup() {
  if (!currentGroup.value.name.trim()) return

  loading.value = true
  try {
    const body = {
      name: currentGroup.value.name.trim(),
      description: currentGroup.value.description.trim() || null,
      parentId: currentGroup.value.parentId || null,
      sortOrder: currentGroup.value.sortOrder,
    }

    if (isEditing.value) {
      await $fetch(`/api/task-groups/${currentGroup.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Group updated',
        description: 'The task group has been updated successfully.',
      })
    } else {
      await $fetch('/api/task-groups', {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Group created',
        description: 'The task group has been created successfully.',
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
        (isEditing.value ? 'Failed to update group.' : 'Failed to create group.'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function deleteGroup(group: TaskGroupNode) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/task-groups/${group.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Group deleted',
      description: `"${group.name}" has been deleted.`,
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to delete group.',
      color: 'error',
    })
  }
}

function editTemplate(template: TaskTemplate) {
  router.push(`/settings/task-templates/${template.id}`)
}

function getRowActions(group: TaskGroupNode) {
  return [
    [
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEditModal(group),
      },
      {
        label: 'Add Subgroup',
        icon: 'i-lucide-plus',
        onSelect: () => openCreateModal(group.id),
      },
    ],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteGroup(group),
      },
    ],
  ]
}

// Calculate totals
const totalGroups = computed(() => {
  function countGroups(nodes: TaskGroupNode[]): number {
    let count = nodes.length
    for (const node of nodes) {
      count += countGroups(node.children)
    }
    return count
  }
  return countGroups(groupTree.value || [])
})

const totalTemplatesInGroups = computed(() => {
  function countTemplates(nodes: TaskGroupNode[]): number {
    let count = 0
    for (const node of nodes) {
      count += node.templates?.length || 0
      count += countTemplates(node.children)
    }
    return count
  }
  return countTemplates(groupTree.value || [])
})
</script>

<template>
  <div>
    <UPageCard
      title="Task Groups"
      description="Organize your task templates into hierarchical groups for easier management and filtering."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <div class="flex items-center gap-2 w-fit lg:ms-auto">
        <UButton
          label="Task Templates"
          icon="i-lucide-clipboard-list"
          color="neutral"
          variant="outline"
          @click="router.push('/settings/task-templates')"
        />
        <UButton
          label="Create Group"
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
        header: 'p-4 mb-0 border-b border-default'
      }"
    >
      <template #header>
        <div class="flex items-center gap-4 text-sm text-muted">
          <span>{{ totalGroups }} group{{ totalGroups === 1 ? '' : 's' }}</span>
          <span>{{ totalTemplatesInGroups }} template{{ totalTemplatesInGroups === 1 ? '' : 's' }} in groups</span>
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="groupTree.length === 0" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-folder-tree" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="mb-2">
          No task groups found
        </p>
        <p class="text-sm mb-4">
          Create groups to organize your task templates
        </p>
        <UButton label="Create your first group" variant="link" @click="openCreateModal()" />
      </div>

      <div v-else class="divide-y divide-default">
        <TaskGroupTreeItem
          v-for="group in groupTree"
          :key="group.id"
          :group="group"
          :level="0"
          :expanded-groups="expandedGroups"
          :get-row-actions="getRowActions"
          @toggle-expand="toggleExpand"
          @edit-template="editTemplate"
        />
      </div>
    </UPageCard>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditing ? 'Edit Group' : 'Create Group' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="modalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="saveGroup">
            <UFormField label="Group Name" required>
              <UInput
                v-model="currentGroup.name"
                placeholder="e.g., Preventive Maintenance, Safety Inspections"
                autofocus
              />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="currentGroup.description"
                placeholder="Describe what templates belong in this group"
                :rows="2"
              />
            </UFormField>

            <UFormField label="Parent Group">
              <USelect
                v-model="currentGroup.parentId"
                :items="parentOptions"
                placeholder="Select parent group"
              />
            </UFormField>

            <UFormField label="Sort Order">
              <UInput
                v-model.number="currentGroup.sortOrder"
                type="number"
                :min="0"
                placeholder="0"
              />
              <template #hint>
                Lower numbers appear first
              </template>
            </UFormField>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="modalOpen = false" />
              <UButton
                type="submit"
                :label="isEditing ? 'Save Changes' : 'Create Group'"
                :loading="loading"
                :disabled="!currentGroup.name.trim()"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
