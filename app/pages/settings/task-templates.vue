<script setup lang="ts">
interface TemplateChecklistItem {
  id: string
  title: string
  description?: string
  isRequired: boolean
  order: number
}

interface TaskTemplate {
  id: string
  name: string
  description: string | null
  estimatedDuration: number | null
  checklistItems: TemplateChecklistItem[]
  isActive: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

const toast = useToast()
const search = ref('')
const showArchived = ref(false)
const modalOpen = ref(false)
const isEditing = ref(false)
const loading = ref(false)

const { data: templates, status, refresh } = await useFetch<TaskTemplate[]>('/api/task-templates', {
  query: computed(() => ({
    search: search.value || undefined,
    includeArchived: showArchived.value ? 'true' : undefined
  })),
  lazy: true,
  default: () => []
})

const currentTemplate = ref({
  id: '',
  name: '',
  description: '',
  estimatedDuration: null as number | null,
  checklistItems: [] as TemplateChecklistItem[],
  isActive: true
})

const newChecklistItem = ref({
  title: '',
  description: '',
  isRequired: false
})

function openCreateModal() {
  isEditing.value = false
  currentTemplate.value = {
    id: '',
    name: '',
    description: '',
    estimatedDuration: null,
    checklistItems: [],
    isActive: true
  }
  modalOpen.value = true
}

function openEditModal(template: TaskTemplate) {
  isEditing.value = true
  currentTemplate.value = {
    id: template.id,
    name: template.name,
    description: template.description || '',
    estimatedDuration: template.estimatedDuration,
    checklistItems: [...template.checklistItems],
    isActive: template.isActive
  }
  modalOpen.value = true
}

function addChecklistItem() {
  if (!newChecklistItem.value.title.trim()) return

  currentTemplate.value.checklistItems.push({
    id: crypto.randomUUID(),
    title: newChecklistItem.value.title.trim(),
    description: newChecklistItem.value.description.trim() || undefined,
    isRequired: newChecklistItem.value.isRequired,
    order: currentTemplate.value.checklistItems.length
  })

  newChecklistItem.value = { title: '', description: '', isRequired: false }
}

function removeChecklistItem(id: string) {
  currentTemplate.value.checklistItems = currentTemplate.value.checklistItems.filter(i => i.id !== id)
  // Reorder
  currentTemplate.value.checklistItems.forEach((item, idx) => {
    item.order = idx
  })
}

function moveChecklistItem(index: number, direction: 'up' | 'down') {
  const items = currentTemplate.value.checklistItems
  if (direction === 'up' && index > 0) {
    const temp = items[index]
    const prev = items[index - 1]
    if (temp && prev) {
      items[index] = prev
      items[index - 1] = temp
    }
  } else if (direction === 'down' && index < items.length - 1) {
    const temp = items[index]
    const next = items[index + 1]
    if (temp && next) {
      items[index] = next
      items[index + 1] = temp
    }
  }
  // Reorder
  items.forEach((item, idx) => {
    item.order = idx
  })
}

async function saveTemplate() {
  if (!currentTemplate.value.name.trim()) return

  loading.value = true
  try {
    const body = {
      name: currentTemplate.value.name.trim(),
      description: currentTemplate.value.description.trim() || null,
      estimatedDuration: currentTemplate.value.estimatedDuration,
      checklistItems: currentTemplate.value.checklistItems,
      isActive: currentTemplate.value.isActive
    }

    if (isEditing.value) {
      await $fetch(`/api/task-templates/${currentTemplate.value.id}`, {
        method: 'PUT',
        body
      })
      toast.add({
        title: 'Template updated',
        description: 'The task template has been updated successfully.'
      })
    } else {
      await $fetch('/api/task-templates', {
        method: 'POST',
        body
      })
      toast.add({
        title: 'Template created',
        description: 'The task template has been created successfully.'
      })
    }

    modalOpen.value = false
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: isEditing.value ? 'Failed to update template.' : 'Failed to create template.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function toggleActive(template: TaskTemplate) {
  try {
    await $fetch(`/api/task-templates/${template.id}`, {
      method: 'PUT',
      body: { isActive: !template.isActive }
    })
    toast.add({
      title: template.isActive ? 'Template deactivated' : 'Template activated',
      description: `The template "${template.name}" has been ${template.isActive ? 'deactivated' : 'activated'}.`
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update template status.',
      color: 'error'
    })
  }
}

async function archiveTemplate(template: TaskTemplate) {
  try {
    await $fetch(`/api/task-templates/${template.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Template archived',
      description: `The template "${template.name}" has been archived.`
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to archive template.',
      color: 'error'
    })
  }
}

function getRowActions(template: TaskTemplate) {
  return [
    [
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEditModal(template)
      },
      {
        label: template.isActive ? 'Deactivate' : 'Activate',
        icon: template.isActive ? 'i-lucide-toggle-right' : 'i-lucide-toggle-left',
        onSelect: () => toggleActive(template)
      }
    ],
    [
      {
        label: 'Archive',
        icon: 'i-lucide-archive',
        color: 'error' as const,
        onSelect: () => archiveTemplate(template)
      }
    ]
  ]
}
</script>

<template>
  <div>
    <UPageCard
      title="Task Templates"
      description="Create reusable templates with predefined checklists for common maintenance tasks."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Create Template"
        icon="i-lucide-plus"
        color="primary"
        class="w-fit lg:ms-auto"
        @click="openCreateModal"
      />
    </UPageCard>

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'p-4 mb-0 border-b border-default' }">
      <template #header>
        <div class="flex items-center gap-4">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search templates..."
            class="flex-1"
          />
          <UCheckbox v-model="showArchived" label="Show archived" />
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="templates.length === 0" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-clipboard-list" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="mb-2">
          No task templates found
        </p>
        <UButton
          label="Create your first template"
          variant="link"
          @click="openCreateModal"
        />
      </div>

      <div v-else class="divide-y divide-default">
        <div
          v-for="template in templates"
          :key="template.id"
          class="flex items-center gap-4 p-4 hover:bg-elevated/50 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-medium truncate" :class="{ 'text-muted line-through': template.isArchived }">
                {{ template.name }}
              </h3>
              <UBadge
                v-if="!template.isActive && !template.isArchived"
                color="warning"
                variant="subtle"
                size="xs"
              >
                Inactive
              </UBadge>
              <UBadge
                v-if="template.isArchived"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                Archived
              </UBadge>
            </div>
            <p v-if="template.description" class="text-sm text-muted truncate mt-1">
              {{ template.description }}
            </p>
            <div class="flex items-center gap-4 mt-2 text-xs text-muted">
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-check-square" class="w-3 h-3" />
                {{ template.checklistItems.length }} items
              </span>
              <span v-if="template.estimatedDuration" class="flex items-center gap-1">
                <UIcon name="i-lucide-clock" class="w-3 h-3" />
                {{ template.estimatedDuration }} min
              </span>
            </div>
          </div>

          <UDropdownMenu :items="getRowActions(template)">
            <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" />
          </UDropdownMenu>
        </div>
      </div>
    </UPageCard>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditing ? 'Edit Template' : 'Create Template' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="modalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-6" @submit.prevent="saveTemplate">
            <div class="space-y-4">
              <UFormField label="Template Name" required>
                <UInput
                  v-model="currentTemplate.name"
                  placeholder="e.g., Oil Change, Tire Rotation"
                  autofocus
                />
              </UFormField>

              <UFormField label="Description">
                <UTextarea
                  v-model="currentTemplate.description"
                  placeholder="Describe what this template is for"
                  :rows="2"
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-4">
                <UFormField label="Estimated Duration (minutes)">
                  <UInput
                    v-model.number="currentTemplate.estimatedDuration"
                    type="number"
                    :min="1"
                    placeholder="e.g., 30"
                  />
                </UFormField>

                <UFormField label="Status">
                  <div class="flex items-center h-full pt-1">
                    <UCheckbox v-model="currentTemplate.isActive" label="Active template" />
                  </div>
                </UFormField>
              </div>
            </div>

            <div class="border-t border-default pt-6">
              <h4 class="font-medium mb-4">
                Checklist Items
              </h4>

              <div v-if="currentTemplate.checklistItems.length > 0" class="space-y-2 mb-4">
                <div
                  v-for="(item, index) in currentTemplate.checklistItems"
                  :key="item.id"
                  class="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  <div class="flex flex-col gap-1">
                    <UButton
                      icon="i-lucide-chevron-up"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === 0"
                      @click="moveChecklistItem(index, 'up')"
                    />
                    <UButton
                      icon="i-lucide-chevron-down"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === currentTemplate.checklistItems.length - 1"
                      @click="moveChecklistItem(index, 'down')"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium">
                      {{ item.title }}
                      <span v-if="item.isRequired" class="text-error">*</span>
                    </p>
                    <p v-if="item.description" class="text-sm text-muted">
                      {{ item.description }}
                    </p>
                  </div>
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="removeChecklistItem(item.id)"
                  />
                </div>
              </div>

              <div class="p-4 border border-dashed border-default rounded-lg space-y-3">
                <UFormField label="Item Title">
                  <UInput
                    v-model="newChecklistItem.title"
                    placeholder="e.g., Drain old oil"
                    @keyup.enter.prevent="addChecklistItem"
                  />
                </UFormField>
                <UFormField label="Description (optional)">
                  <UInput
                    v-model="newChecklistItem.description"
                    placeholder="Additional instructions"
                  />
                </UFormField>
                <div class="flex items-center justify-between">
                  <UCheckbox v-model="newChecklistItem.isRequired" label="Required item" />
                  <UButton
                    label="Add Item"
                    icon="i-lucide-plus"
                    size="sm"
                    variant="soft"
                    :disabled="!newChecklistItem.title.trim()"
                    @click="addChecklistItem"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton
                label="Cancel"
                variant="ghost"
                @click="modalOpen = false"
              />
              <UButton
                type="submit"
                :label="isEditing ? 'Save Changes' : 'Create Template'"
                :loading="loading"
                :disabled="!currentTemplate.name.trim()"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
