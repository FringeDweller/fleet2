<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  middleware: 'auth',
})

interface PartCategory {
  id: string
  name: string
  description: string | null
  parentId: string | null
  isActive: boolean
  createdAt: string
}

const router = useRouter()
const toast = useToast()

const {
  data: categories,
  status,
  refresh,
} = await useFetch<PartCategory[]>('/api/part-categories', {
  lazy: true,
})

// Modal state
const showModal = ref(false)
const editingCategory = ref<PartCategory | null>(null)
const loading = ref(false)

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

const parentOptions = computed(() => {
  const options =
    categories.value
      ?.filter((c) => c.id !== editingCategory.value?.id)
      .map((c) => ({ label: c.name, value: c.id })) || []
  return [{ label: 'None (Top-level)', value: '' }, ...options]
})

function openCreate() {
  editingCategory.value = null
  state.name = ''
  state.description = undefined
  state.parentId = undefined
  showModal.value = true
}

function openEdit(category: PartCategory) {
  editingCategory.value = category
  state.name = category.name
  state.description = category.description ?? undefined
  state.parentId = category.parentId ?? undefined
  showModal.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    if (editingCategory.value) {
      // Update existing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ($fetch as any)(`/api/part-categories/${editingCategory.value.id}`, {
        method: 'PUT',
        body: {
          ...event.data,
          parentId: event.data.parentId || null,
        },
      })
      toast.add({
        title: 'Category updated',
        description: 'The category has been updated successfully.',
        color: 'success',
      })
    } else {
      // Create new
      await $fetch('/api/part-categories', {
        method: 'POST',
        body: {
          ...event.data,
          parentId: event.data.parentId || null,
        },
      })
      toast.add({
        title: 'Category created',
        description: 'The category has been created successfully.',
        color: 'success',
      })
    }
    showModal.value = false
    refresh()
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save category.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function deleteCategory(category: PartCategory) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ($fetch as any)(`/api/part-categories/${category.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Category deleted',
      description: 'The category has been deleted successfully.',
    })
    refresh()
  } catch (err: unknown) {
    const error = err as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete category.',
      color: 'error',
    })
  }
}

// Build tree structure for display
interface CategoryNode extends PartCategory {
  children: CategoryNode[]
  level: number
}

const categoryTree = computed<CategoryNode[]>(() => {
  if (!categories.value) return []

  const buildTree = (parentId: string | null, level: number): CategoryNode[] => {
    return categories
      .value!.filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        level,
        children: buildTree(c.id, level + 1),
      }))
  }

  return buildTree(null, 0)
})

// Flatten tree for table display
const flattenedCategories = computed<CategoryNode[]>(() => {
  const result: CategoryNode[] = []

  const flatten = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      result.push(node)
      flatten(node.children)
    }
  }

  flatten(categoryTree.value)
  return result
})
</script>

<template>
  <UDashboardPanel id="part-categories">
    <template #header>
      <UDashboardNavbar title="Part Categories">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/inventory/parts')"
          />
        </template>

        <template #right>
          <UButton
            label="New Category"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="flattenedCategories.length === 0" class="text-center py-12">
        <UIcon name="i-lucide-folder-tree" class="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">
          No categories yet
        </h3>
        <p class="text-muted mb-4">
          Create categories to organize your parts inventory.
        </p>
        <UButton label="Create First Category" icon="i-lucide-plus" @click="openCreate" />
      </div>

      <div v-else>
        <UCard>
          <div class="divide-y divide-default">
            <div
              v-for="category in flattenedCategories"
              :key="category.id"
              class="py-3 first:pt-0 last:pb-0 flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <div
                  :style="{ marginLeft: `${category.level * 24}px` }"
                  class="flex items-center gap-3"
                >
                  <UIcon
                    :name="
                      category.children.length > 0 ? 'i-lucide-folder-open' : 'i-lucide-folder'
                    "
                    class="w-5 h-5 text-muted"
                  />
                  <div>
                    <p class="font-medium">
                      {{ category.name }}
                    </p>
                    <p v-if="category.description" class="text-sm text-muted">
                      {{ category.description }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="openEdit(category)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="deleteCategory(category)"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Create/Edit Modal -->
      <UModal v-model:open="showModal">
        <template #content>
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium">
                  {{ editingCategory ? 'Edit Category' : 'New Category' }}
                </h3>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="showModal = false"
                />
              </div>
            </template>

            <UForm
              :schema="schema"
              :state="state"
              class="space-y-4"
              @submit="onSubmit"
            >
              <UFormField label="Name" name="name" required>
                <UInput v-model="state.name" placeholder="Filters" class="w-full" />
              </UFormField>

              <UFormField label="Description" name="description">
                <UTextarea
                  v-model="state.description"
                  placeholder="Category description..."
                  class="w-full"
                  :rows="2"
                />
              </UFormField>

              <UFormField label="Parent Category" name="parentId">
                <USelect
                  v-model="state.parentId"
                  :items="parentOptions"
                  placeholder="Select parent category"
                  class="w-full"
                />
              </UFormField>

              <div class="flex justify-end gap-2 pt-4">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="showModal = false"
                />
                <UButton
                  :label="editingCategory ? 'Save Changes' : 'Create Category'"
                  color="primary"
                  type="submit"
                  :loading="loading"
                />
              </div>
            </UForm>
          </UCard>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
