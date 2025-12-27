<script setup lang="ts">
import { formatDistanceToNow, parseISO } from 'date-fns'

interface ChecklistItem {
  id: string
  title: string
  description: string | null
  isRequired: boolean
  isCompleted: boolean
  completedAt: string | null
  completedBy: { id: string; firstName: string; lastName: string } | null
  notes: string | null
  order: number
}

const props = defineProps<{
  workOrderId: string
  items: ChecklistItem[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const addModalOpen = ref(false)
const loading = ref<Record<string, boolean>>({})

const newItem = ref({
  title: '',
  description: '',
  isRequired: false,
})

const progress = computed(() => {
  if (!props.items.length) return null
  const completed = props.items.filter((i) => i.isCompleted).length
  const total = props.items.length
  return { completed, total, percentage: Math.round((completed / total) * 100) }
})

async function toggleComplete(item: ChecklistItem) {
  if (props.readonly) return
  loading.value[item.id] = true
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/checklist/${item.id}`, {
      method: 'PUT',
      body: { isCompleted: !item.isCompleted },
    })
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update checklist item.',
      color: 'error',
    })
  } finally {
    loading.value[item.id] = false
  }
}

async function addItem() {
  if (!newItem.value.title.trim()) return
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/checklist`, {
      method: 'POST',
      body: {
        title: newItem.value.title.trim(),
        description: newItem.value.description.trim() || null,
        isRequired: newItem.value.isRequired,
      },
    })
    toast.add({
      title: 'Item added',
      description: 'Checklist item has been added.',
    })
    newItem.value = { title: '', description: '', isRequired: false }
    addModalOpen.value = false
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to add checklist item.',
      color: 'error',
    })
  }
}

async function deleteItem(item: ChecklistItem) {
  loading.value[item.id] = true
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/checklist/${item.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Item removed',
      description: 'Checklist item has been removed.',
    })
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to remove checklist item.',
      color: 'error',
    })
  } finally {
    loading.value[item.id] = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-medium">
          Checklist Items
        </h3>
        <div class="flex items-center gap-3">
          <span v-if="progress" class="text-sm text-muted">
            {{ progress.percentage }}% complete
          </span>
          <UButton
            v-if="!readonly"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            label="Add Item"
            @click="addModalOpen = true"
          />
        </div>
      </div>
    </template>

    <div v-if="items.length === 0" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-check-square" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No checklist items</p>
      <UButton
        v-if="!readonly"
        label="Add first item"
        variant="link"
        class="mt-2"
        @click="addModalOpen = true"
      />
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-start gap-3 p-3 rounded-lg group"
        :class="item.isCompleted ? 'bg-success/10' : 'bg-muted/50'"
      >
        <button
          v-if="!readonly"
          :disabled="loading[item.id]"
          class="mt-0.5 focus:outline-none"
          @click="toggleComplete(item)"
        >
          <UIcon
            v-if="loading[item.id]"
            name="i-lucide-loader-2"
            class="w-5 h-5 animate-spin text-muted"
          />
          <UIcon
            v-else
            :name="item.isCompleted ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
            :class="item.isCompleted ? 'text-success' : 'text-muted hover:text-primary'"
            class="w-5 h-5 transition-colors"
          />
        </button>
        <UIcon
          v-else
          :name="item.isCompleted ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
          :class="item.isCompleted ? 'text-success' : 'text-muted'"
          class="w-5 h-5 mt-0.5"
        />

        <div class="flex-1 min-w-0">
          <p :class="item.isCompleted ? 'line-through text-muted' : 'font-medium'">
            {{ item.title }}
            <span v-if="item.isRequired" class="text-error">*</span>
          </p>
          <p v-if="item.description" class="text-sm text-muted mt-1">
            {{ item.description }}
          </p>
          <p v-if="item.completedBy && item.completedAt" class="text-xs text-muted mt-2">
            Completed by {{ item.completedBy.firstName }} {{ item.completedBy.lastName }}
            {{ formatDistanceToNow(parseISO(item.completedAt), { addSuffix: true }) }}
          </p>
        </div>

        <UButton
          v-if="!readonly"
          icon="i-lucide-trash-2"
          size="xs"
          color="error"
          variant="ghost"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          :loading="loading[item.id]"
          @click="deleteItem(item)"
        />
      </div>
    </div>

    <UModal v-model:open="addModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                Add Checklist Item
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="addModalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="addItem">
            <UFormField label="Title" required>
              <UInput v-model="newItem.title" placeholder="Enter item title" autofocus />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="newItem.description"
                placeholder="Optional description"
                :rows="2"
              />
            </UFormField>

            <UCheckbox v-model="newItem.isRequired" label="Required item" />

            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="addModalOpen = false" />
              <UButton type="submit" label="Add Item" :disabled="!newItem.title.trim()" />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </UCard>
</template>
