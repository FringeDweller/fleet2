<script setup lang="ts">
interface CategoryNode {
  id: string
  name: string
  parentId: string | null
  children: CategoryNode[]
}

interface CheckpointDefinition {
  id: string
  organisationId: string
  assetCategoryId: string
  name: string
  description: string | null
  position: string
  qrCode: string | null
  nfcTag: string | null
  required: boolean
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  assetCategory: {
    id: string
    name: string
  }
}

// Predefined position options for walk-around inspection
const positionOptions = [
  { label: 'Front', value: 'front' },
  { label: 'Rear', value: 'rear' },
  { label: 'Left Side', value: 'left_side' },
  { label: 'Right Side', value: 'right_side' },
  { label: 'Engine Bay', value: 'engine_bay' },
  { label: 'Cab Interior', value: 'cab_interior' },
  { label: 'Undercarriage', value: 'undercarriage' },
  { label: 'Roof', value: 'roof' },
  { label: 'Fuel Tank', value: 'fuel_tank' },
  { label: 'Hydraulic System', value: 'hydraulic' },
  { label: 'Boom/Arm', value: 'boom_arm' },
  { label: 'Bucket/Attachment', value: 'bucket' },
  { label: 'Tracks/Wheels', value: 'tracks_wheels' },
  { label: 'Other', value: 'other' },
]

const toast = useToast()
const modalOpen = ref(false)
const isEditing = ref(false)
const loading = ref(false)
const showInactive = ref(false)
const selectedCategoryId = ref<string>('')

// Fetch asset categories for filtering and selection
const { data: categoryTree } = await useFetch<CategoryNode[]>('/api/asset-categories/tree', {
  lazy: true,
  default: () => [],
})

// Flatten categories for select options
function flattenCategories(
  nodes: CategoryNode[],
  level = 0,
): Array<{ id: string; name: string; level: number }> {
  const result: Array<{ id: string; name: string; level: number }> = []
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, level })
    if (node.children.length > 0) {
      result.push(...flattenCategories(node.children, level + 1))
    }
  }
  return result
}

const categoryOptions = computed(() => {
  const flat = flattenCategories(categoryTree.value || [])
  return [
    { label: 'All Categories', value: '' },
    ...flat.map((c) => ({
      label: '\u00A0\u00A0'.repeat(c.level) + c.name,
      value: c.id,
    })),
  ]
})

const categorySelectOptions = computed(() => {
  const flat = flattenCategories(categoryTree.value || [])
  return flat.map((c) => ({
    label: '\u00A0\u00A0'.repeat(c.level) + c.name,
    value: c.id,
  }))
})

// Fetch checkpoint definitions
const {
  data: checkpoints,
  status,
  refresh,
} = await useFetch<CheckpointDefinition[]>('/api/inspection-checkpoints/definitions', {
  query: computed(() => ({
    assetCategoryId: selectedCategoryId.value || undefined,
    includeInactive: showInactive.value ? 'true' : undefined,
  })),
  lazy: true,
  default: () => [],
})

// Group checkpoints by category
const checkpointsByCategory = computed(() => {
  const grouped = new Map<
    string,
    { category: { id: string; name: string }; checkpoints: CheckpointDefinition[] }
  >()

  for (const checkpoint of checkpoints.value) {
    const categoryId = checkpoint.assetCategoryId
    if (!grouped.has(categoryId)) {
      grouped.set(categoryId, {
        category: checkpoint.assetCategory,
        checkpoints: [],
      })
    }
    grouped.get(categoryId)!.checkpoints.push(checkpoint)
  }

  // Sort checkpoints within each category by displayOrder
  for (const group of grouped.values()) {
    group.checkpoints.sort((a, b) => a.displayOrder - b.displayOrder)
  }

  return Array.from(grouped.values())
})

// Form state
const currentCheckpoint = ref({
  id: '',
  assetCategoryId: '',
  name: '',
  description: '',
  position: '',
  qrCode: '',
  nfcTag: '',
  required: true,
  displayOrder: 0,
  isActive: true,
})

function openCreateModal() {
  isEditing.value = false
  currentCheckpoint.value = {
    id: '',
    assetCategoryId: selectedCategoryId.value || '',
    name: '',
    description: '',
    position: '',
    qrCode: '',
    nfcTag: '',
    required: true,
    displayOrder: 0,
    isActive: true,
  }
  modalOpen.value = true
}

function openEditModal(checkpoint: CheckpointDefinition) {
  isEditing.value = true
  currentCheckpoint.value = {
    id: checkpoint.id,
    assetCategoryId: checkpoint.assetCategoryId,
    name: checkpoint.name,
    description: checkpoint.description || '',
    position: checkpoint.position,
    qrCode: checkpoint.qrCode || '',
    nfcTag: checkpoint.nfcTag || '',
    required: checkpoint.required,
    displayOrder: checkpoint.displayOrder,
    isActive: checkpoint.isActive,
  }
  modalOpen.value = true
}

async function saveCheckpoint() {
  if (!currentCheckpoint.value.name.trim() || !currentCheckpoint.value.assetCategoryId) return

  loading.value = true
  try {
    const body = {
      assetCategoryId: currentCheckpoint.value.assetCategoryId,
      name: currentCheckpoint.value.name.trim(),
      description: currentCheckpoint.value.description.trim() || null,
      position: currentCheckpoint.value.position,
      qrCode: currentCheckpoint.value.qrCode.trim() || null,
      nfcTag: currentCheckpoint.value.nfcTag.trim() || null,
      required: currentCheckpoint.value.required,
      displayOrder: currentCheckpoint.value.displayOrder,
      isActive: currentCheckpoint.value.isActive,
    }

    if (isEditing.value) {
      await $fetch(`/api/inspection-checkpoints/definitions/${currentCheckpoint.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Checkpoint updated',
        description: 'The inspection checkpoint has been updated successfully.',
      })
    } else {
      await $fetch('/api/inspection-checkpoints/definitions', {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Checkpoint created',
        description: 'The inspection checkpoint has been created successfully.',
      })
    }

    modalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to save checkpoint.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function toggleActive(checkpoint: CheckpointDefinition) {
  try {
    await $fetch(`/api/inspection-checkpoints/definitions/${checkpoint.id}`, {
      method: 'PUT',
      body: { isActive: !checkpoint.isActive },
    })
    toast.add({
      title: checkpoint.isActive ? 'Checkpoint deactivated' : 'Checkpoint activated',
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update checkpoint status.',
      color: 'error',
    })
  }
}

async function deleteCheckpoint(checkpoint: CheckpointDefinition) {
  try {
    await $fetch(`/api/inspection-checkpoints/definitions/${checkpoint.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Checkpoint deleted',
      description: `"${checkpoint.name}" has been deleted.`,
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to delete checkpoint.',
      color: 'error',
    })
  }
}

function generateQrCode() {
  // Generate a unique QR code identifier
  currentCheckpoint.value.qrCode = `CP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

function getRowActions(checkpoint: CheckpointDefinition) {
  return [
    [
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEditModal(checkpoint),
      },
      {
        label: checkpoint.isActive ? 'Deactivate' : 'Activate',
        icon: checkpoint.isActive ? 'i-lucide-toggle-right' : 'i-lucide-toggle-left',
        onSelect: () => toggleActive(checkpoint),
      },
    ],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteCheckpoint(checkpoint),
      },
    ],
  ]
}

function getPositionLabel(position: string): string {
  const option = positionOptions.find((o) => o.value === position)
  return option?.label || position
}
</script>

<template>
  <div>
    <UPageCard
      title="Inspection Checkpoints"
      description="Configure walk-around NFC/QR checkpoints for each asset category. Operators must scan these checkpoints during pre-start inspections."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Add Checkpoint"
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
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <USelect
            v-model="selectedCategoryId"
            :items="categoryOptions"
            placeholder="Filter by category"
            class="w-full sm:w-64"
          />
          <UCheckbox v-model="showInactive" label="Show inactive" />
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="checkpoints.length === 0" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-scan" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="mb-2">
          No inspection checkpoints found
        </p>
        <p class="text-sm mb-4">
          Add checkpoints to require operators to scan NFC/QR tags at specific positions during inspections.
        </p>
        <UButton label="Add your first checkpoint" variant="link" @click="openCreateModal()" />
      </div>

      <div v-else class="divide-y divide-default">
        <div
          v-for="group in checkpointsByCategory"
          :key="group.category.id"
          class="p-4"
        >
          <h3 class="font-medium text-sm text-muted mb-3">
            {{ group.category.name }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="checkpoint in group.checkpoints"
              :key="checkpoint.id"
              class="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
              :class="{ 'opacity-50': !checkpoint.isActive }"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                :class="checkpoint.required ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'"
              >
                {{ checkpoint.displayOrder + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ checkpoint.name }}</span>
                  <UBadge v-if="checkpoint.required" color="primary" variant="subtle" size="xs">
                    Required
                  </UBadge>
                  <UBadge v-if="!checkpoint.isActive" color="warning" variant="subtle" size="xs">
                    Inactive
                  </UBadge>
                </div>
                <div class="flex items-center gap-4 text-sm text-muted mt-1">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-map-pin" class="w-3 h-3" />
                    {{ getPositionLabel(checkpoint.position) }}
                  </span>
                  <span v-if="checkpoint.qrCode" class="flex items-center gap-1">
                    <UIcon name="i-lucide-qr-code" class="w-3 h-3" />
                    {{ checkpoint.qrCode }}
                  </span>
                  <span v-if="checkpoint.nfcTag" class="flex items-center gap-1">
                    <UIcon name="i-lucide-nfc" class="w-3 h-3" />
                    {{ checkpoint.nfcTag }}
                  </span>
                </div>
                <p v-if="checkpoint.description" class="text-sm text-muted mt-1">
                  {{ checkpoint.description }}
                </p>
              </div>
              <UDropdownMenu :items="getRowActions(checkpoint)">
                <UButton icon="i-lucide-more-vertical" color="neutral" variant="ghost" size="sm" />
              </UDropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </UPageCard>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditing ? 'Edit Checkpoint' : 'Add Checkpoint' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="modalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="saveCheckpoint">
            <UFormField label="Asset Category" required>
              <USelect
                v-model="currentCheckpoint.assetCategoryId"
                :items="categorySelectOptions"
                placeholder="Select category"
                :disabled="isEditing"
              />
            </UFormField>

            <UFormField label="Checkpoint Name" required>
              <UInput
                v-model="currentCheckpoint.name"
                placeholder="e.g., Front Lights Check"
                autofocus
              />
            </UFormField>

            <UFormField label="Position" required>
              <USelect
                v-model="currentCheckpoint.position"
                :items="positionOptions"
                placeholder="Select position on asset"
              />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="currentCheckpoint.description"
                placeholder="Instructions for the operator at this checkpoint"
                :rows="2"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="QR Code">
                <div class="flex gap-2">
                  <UInput
                    v-model="currentCheckpoint.qrCode"
                    placeholder="CP-XXXXXXXX"
                    class="flex-1"
                  />
                  <UButton
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="outline"
                    title="Generate QR Code"
                    @click="generateQrCode"
                  />
                </div>
              </UFormField>

              <UFormField label="NFC Tag ID">
                <UInput
                  v-model="currentCheckpoint.nfcTag"
                  placeholder="NFC tag identifier"
                />
              </UFormField>
            </div>

            <UFormField label="Display Order">
              <UInput
                v-model.number="currentCheckpoint.displayOrder"
                type="number"
                :min="0"
                placeholder="0"
              />
            </UFormField>

            <div class="flex items-center gap-6">
              <UCheckbox
                v-model="currentCheckpoint.required"
                label="Required checkpoint"
              />
              <UCheckbox
                v-model="currentCheckpoint.isActive"
                label="Active"
              />
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="modalOpen = false" />
              <UButton
                type="submit"
                :label="isEditing ? 'Save Changes' : 'Add Checkpoint'"
                :loading="loading"
                :disabled="!currentCheckpoint.name.trim() || !currentCheckpoint.assetCategoryId || !currentCheckpoint.position"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
