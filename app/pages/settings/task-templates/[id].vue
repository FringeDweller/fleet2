<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface TemplateChecklistItem {
  id: string
  title: string
  description?: string
  isRequired: boolean
  order: number
}

interface TemplateRequiredPart {
  id: string
  partName: string
  partNumber?: string
  quantity: number
  estimatedCost?: number
  notes?: string
}

interface TaskTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  estimatedDuration: number | null
  estimatedCost: string | null
  skillLevel: 'entry' | 'intermediate' | 'advanced' | 'expert' | null
  checklistItems: TemplateChecklistItem[]
  requiredParts: TemplateRequiredPart[]
  version: number
  isActive: boolean
  groupId: string | null
  group?: {
    id: string
    name: string
  } | null
}

interface Asset {
  id: string
  assetNumber: string
  make: string | null
  model: string | null
  year: number | null
  status: string
}

interface Category {
  id: string
  name: string
}

interface TaskOverride {
  id: string
  taskTemplateId: string
  assetId: string | null
  categoryId: string | null
  partsOverride: TemplateRequiredPart[] | null
  checklistOverride: TemplateChecklistItem[] | null
  estimatedDurationOverride: number | null
  notes: string | null
  asset?: Asset | null
  category?: Category | null
}

interface AssetWithOverride {
  overrideId: string
  asset: Asset
  overrideType: 'asset'
}

interface CategoryWithOverride {
  overrideId: string
  category: Category & { assets?: Asset[] }
  affectedAssets: Asset[]
  overrideType: 'category'
}

interface AssetsWithOverrides {
  assetOverrides: AssetWithOverride[]
  categoryOverrides: CategoryWithOverride[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const templateId = route.params.id as string

// Fetch template details
const {
  data: template,
  status: templateStatus,
  refresh: refreshTemplate,
} = await useFetch<TaskTemplate>(`/api/task-templates/${templateId}`, {
  lazy: true,
})

// Fetch overrides
const {
  data: overrides,
  status: overridesStatus,
  refresh: refreshOverrides,
} = await useFetch<TaskOverride[]>(`/api/task-templates/${templateId}/overrides`, {
  lazy: true,
  default: () => [],
})

// Fetch assets with overrides
const { data: assetsWithOverrides, refresh: refreshAssetsWithOverrides } =
  await useFetch<AssetsWithOverrides>(`/api/task-templates/${templateId}/assets-with-overrides`, {
    lazy: true,
    default: () => ({ assetOverrides: [], categoryOverrides: [] }),
  })

// Fetch available assets and categories for creating overrides
const { data: assets } = await useFetch<Asset[]>('/api/assets', {
  lazy: true,
  query: { limit: 1000 },
  default: () => [],
})

const { data: categories } = await useFetch<Category[]>('/api/asset-categories', {
  lazy: true,
  default: () => [],
})

// Modal state
const overrideModalOpen = ref(false)
const isEditingOverride = ref(false)
const overrideLoading = ref(false)
const effectiveConfigModalOpen = ref(false)
const selectedAssetId = ref('')

const currentOverride = ref({
  id: '',
  targetType: 'asset' as 'asset' | 'category',
  assetId: '',
  categoryId: '',
  partsOverride: [] as TemplateRequiredPart[],
  checklistOverride: [] as TemplateChecklistItem[],
  estimatedDurationOverride: null as number | null,
  notes: '',
})

// Effective config
const { data: effectiveConfig, refresh: refreshEffectiveConfig } = await useFetch<{
  templateId: string
  name: string
  description: string | null
  estimatedDuration: number | null
  checklistItems: TemplateChecklistItem[]
  requiredParts: TemplateRequiredPart[]
  overrideSource: string | null
  overrideLevel: 'asset' | 'category' | null
}>(`/api/task-templates/${templateId}/effective-config`, {
  lazy: true,
  query: computed(() => ({
    assetId: selectedAssetId.value || undefined,
  })),
  immediate: false,
})

// New part/checklist item forms
const newOverridePart = ref({
  partName: '',
  partNumber: '',
  quantity: 1,
  estimatedCost: null as number | null,
  notes: '',
})

const newOverrideChecklistItem = ref({
  title: '',
  description: '',
  isRequired: false,
})

// Asset/category options for dropdown
const assetOptions = computed(() => {
  return (assets.value || []).map((a: Asset) => ({
    label: `${a.assetNumber} - ${a.make || ''} ${a.model || ''}`.trim(),
    value: a.id,
  }))
})

const categoryOptions = computed(() => {
  return (categories.value || []).map((c: Category) => ({
    label: c.name,
    value: c.id,
  }))
})

function openCreateOverrideModal() {
  isEditingOverride.value = false
  currentOverride.value = {
    id: '',
    targetType: 'asset',
    assetId: '',
    categoryId: '',
    partsOverride: [],
    checklistOverride: [],
    estimatedDurationOverride: null,
    notes: '',
  }
  overrideModalOpen.value = true
}

function openEditOverrideModal(override: TaskOverride) {
  isEditingOverride.value = true
  currentOverride.value = {
    id: override.id,
    targetType: override.assetId ? 'asset' : 'category',
    assetId: override.assetId || '',
    categoryId: override.categoryId || '',
    partsOverride: override.partsOverride ? [...override.partsOverride] : [],
    checklistOverride: override.checklistOverride ? [...override.checklistOverride] : [],
    estimatedDurationOverride: override.estimatedDurationOverride,
    notes: override.notes || '',
  }
  overrideModalOpen.value = true
}

function addOverridePart() {
  if (!newOverridePart.value.partName.trim()) return

  currentOverride.value.partsOverride.push({
    id: crypto.randomUUID(),
    partName: newOverridePart.value.partName.trim(),
    partNumber: newOverridePart.value.partNumber.trim() || undefined,
    quantity: newOverridePart.value.quantity,
    estimatedCost: newOverridePart.value.estimatedCost || undefined,
    notes: newOverridePart.value.notes.trim() || undefined,
  })

  newOverridePart.value = {
    partName: '',
    partNumber: '',
    quantity: 1,
    estimatedCost: null,
    notes: '',
  }
}

function removeOverridePart(id: string) {
  currentOverride.value.partsOverride = currentOverride.value.partsOverride.filter(
    (p) => p.id !== id,
  )
}

function addOverrideChecklistItem() {
  if (!newOverrideChecklistItem.value.title.trim()) return

  currentOverride.value.checklistOverride.push({
    id: crypto.randomUUID(),
    title: newOverrideChecklistItem.value.title.trim(),
    description: newOverrideChecklistItem.value.description.trim() || undefined,
    isRequired: newOverrideChecklistItem.value.isRequired,
    order: currentOverride.value.checklistOverride.length,
  })

  newOverrideChecklistItem.value = {
    title: '',
    description: '',
    isRequired: false,
  }
}

function removeOverrideChecklistItem(id: string) {
  currentOverride.value.checklistOverride = currentOverride.value.checklistOverride.filter(
    (i) => i.id !== id,
  )
  // Reorder
  currentOverride.value.checklistOverride.forEach((item, idx) => {
    item.order = idx
  })
}

function copyFromTemplate() {
  if (!template.value) return

  currentOverride.value.partsOverride = template.value.requiredParts.map(
    (p: TemplateRequiredPart) => ({
      ...p,
      id: crypto.randomUUID(),
    }),
  )
  currentOverride.value.checklistOverride = template.value.checklistItems.map(
    (i: TemplateChecklistItem) => ({
      ...i,
      id: crypto.randomUUID(),
    }),
  )
  currentOverride.value.estimatedDurationOverride = template.value.estimatedDuration

  toast.add({
    title: 'Copied from template',
    description: 'Default values copied. You can now modify them for this override.',
  })
}

async function saveOverride() {
  const targetId =
    currentOverride.value.targetType === 'asset'
      ? currentOverride.value.assetId
      : currentOverride.value.categoryId

  if (!targetId) {
    toast.add({
      title: 'Error',
      description: `Please select ${currentOverride.value.targetType === 'asset' ? 'an asset' : 'a category'}.`,
      color: 'error',
    })
    return
  }

  overrideLoading.value = true
  try {
    const body = {
      assetId: currentOverride.value.targetType === 'asset' ? currentOverride.value.assetId : null,
      categoryId:
        currentOverride.value.targetType === 'category' ? currentOverride.value.categoryId : null,
      partsOverride:
        currentOverride.value.partsOverride.length > 0 ? currentOverride.value.partsOverride : null,
      checklistOverride:
        currentOverride.value.checklistOverride.length > 0
          ? currentOverride.value.checklistOverride
          : null,
      estimatedDurationOverride: currentOverride.value.estimatedDurationOverride,
      notes: currentOverride.value.notes.trim() || null,
    }

    if (isEditingOverride.value) {
      await $fetch(`/api/task-templates/${templateId}/overrides/${currentOverride.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Override updated',
        description: 'The task override has been updated.',
      })
    } else {
      await $fetch(`/api/task-templates/${templateId}/overrides`, {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Override created',
        description: 'The task override has been created.',
      })
    }

    overrideModalOpen.value = false
    refreshOverrides()
    refreshAssetsWithOverrides()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to save override.',
      color: 'error',
    })
  } finally {
    overrideLoading.value = false
  }
}

async function deleteOverride(override: TaskOverride) {
  try {
    await $fetch(`/api/task-templates/${templateId}/overrides/${override.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Override deleted',
      description: 'The task override has been deleted.',
    })
    refreshOverrides()
    refreshAssetsWithOverrides()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to delete override.',
      color: 'error',
    })
  }
}

async function viewEffectiveConfig(assetId: string) {
  selectedAssetId.value = assetId
  effectiveConfigModalOpen.value = true
  await refreshEffectiveConfig()
}

function getOverrideTargetLabel(override: TaskOverride): string {
  if (override.asset) {
    return `${override.asset.assetNumber} - ${override.asset.make || ''} ${override.asset.model || ''}`.trim()
  }
  if (override.category) {
    return override.category.name
  }
  return 'Unknown'
}
</script>

<template>
  <UDashboardPanel id="task-template-detail">
    <template #header>
      <UDashboardNavbar :title="template?.name || 'Task Template'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/settings/task-templates')"
          />
        </template>

        <template #right>
          <UButton
            label="Add Override"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreateOverrideModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="templateStatus === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="!template" class="text-center py-12">
        <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
        <p class="text-lg font-medium mb-2">Template not found</p>
        <UButton label="Back to Templates" @click="router.push('/settings/task-templates')" />
      </div>

      <div v-else class="space-y-6">
        <!-- Template Info -->
        <UPageCard variant="subtle">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-xl font-semibold">{{ template.name }}</h2>
              <p v-if="template.description" class="text-muted mt-1">{{ template.description }}</p>
              <div class="flex items-center gap-4 mt-3 text-sm text-muted">
                <span v-if="template.category" class="flex items-center gap-1">
                  <UIcon name="i-lucide-tag" class="w-4 h-4" />
                  {{ template.category }}
                </span>
                <span v-if="template.estimatedDuration" class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="w-4 h-4" />
                  {{ template.estimatedDuration }} min
                </span>
                <span v-if="template.skillLevel" class="flex items-center gap-1 capitalize">
                  <UIcon name="i-lucide-user" class="w-4 h-4" />
                  {{ template.skillLevel }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-check-square" class="w-4 h-4" />
                  {{ template.checklistItems.length }} checklist items
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-package" class="w-4 h-4" />
                  {{ template.requiredParts.length }} parts
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UBadge :color="template.isActive ? 'success' : 'warning'" variant="subtle">
                {{ template.isActive ? 'Active' : 'Inactive' }}
              </UBadge>
              <UBadge color="neutral" variant="subtle">
                v{{ template.version }}
              </UBadge>
            </div>
          </div>
        </UPageCard>

        <!-- Overrides Section -->
        <UPageCard
          title="Asset-Specific Overrides"
          description="Customize this template's parts, checklist, and duration for specific assets or categories."
          variant="subtle"
          :ui="{
            container: 'p-0 sm:p-0 gap-y-0',
            header: 'p-4 mb-0 border-b border-default'
          }"
        >
          <div v-if="overridesStatus === 'pending'" class="flex items-center justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
          </div>

          <div v-else-if="overrides.length === 0" class="text-center py-8 text-muted">
            <UIcon name="i-lucide-settings-2" class="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p class="mb-2">No overrides configured</p>
            <p class="text-sm mb-4">
              Overrides let you customize this template for specific assets or asset categories.
            </p>
            <UButton label="Create Override" icon="i-lucide-plus" variant="soft" @click="openCreateOverrideModal" />
          </div>

          <div v-else class="divide-y divide-default">
            <div
              v-for="override in overrides"
              :key="override.id"
              class="p-4 hover:bg-elevated/50 transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <UIcon
                      :name="override.assetId ? 'i-lucide-truck' : 'i-lucide-folder'"
                      class="w-5 h-5 text-primary"
                    />
                    <span class="font-medium">{{ getOverrideTargetLabel(override) }}</span>
                    <UBadge :color="override.assetId ? 'info' : 'warning'" variant="subtle" size="xs">
                      {{ override.assetId ? 'Asset' : 'Category' }}
                    </UBadge>
                  </div>

                  <div class="flex items-center gap-4 mt-2 text-sm text-muted">
                    <span v-if="override.partsOverride?.length" class="flex items-center gap-1">
                      <UIcon name="i-lucide-package" class="w-3 h-3" />
                      {{ override.partsOverride.length }} custom parts
                    </span>
                    <span v-if="override.checklistOverride?.length" class="flex items-center gap-1">
                      <UIcon name="i-lucide-check-square" class="w-3 h-3" />
                      {{ override.checklistOverride.length }} custom checklist items
                    </span>
                    <span v-if="override.estimatedDurationOverride" class="flex items-center gap-1">
                      <UIcon name="i-lucide-clock" class="w-3 h-3" />
                      {{ override.estimatedDurationOverride }} min
                    </span>
                  </div>

                  <p v-if="override.notes" class="text-sm text-muted mt-2 italic">
                    {{ override.notes }}
                  </p>
                </div>

                <UDropdownMenu
                  :items="[
                    [
                      {
                        label: 'Edit',
                        icon: 'i-lucide-pencil',
                        onSelect: () => openEditOverrideModal(override),
                      },
                      ...(override.assetId
                        ? [
                            {
                              label: 'View Effective Config',
                              icon: 'i-lucide-eye',
                              onSelect: () => viewEffectiveConfig(override.assetId!),
                            },
                          ]
                        : []),
                    ],
                    [
                      {
                        label: 'Delete',
                        icon: 'i-lucide-trash-2',
                        color: 'error' as const,
                        onSelect: () => deleteOverride(override),
                      },
                    ],
                  ]"
                >
                  <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" />
                </UDropdownMenu>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- Assets with Overrides Summary -->
        <UPageCard
          title="Affected Assets"
          description="Overview of assets that have custom configurations for this template."
          variant="subtle"
          :ui="{
            container: 'p-0 sm:p-0 gap-y-0',
            header: 'p-4 mb-0 border-b border-default'
          }"
        >
          <div class="divide-y divide-default">
            <!-- Asset-level overrides -->
            <div v-if="assetsWithOverrides?.assetOverrides?.length">
              <div class="p-3 bg-muted/30">
                <h4 class="text-sm font-medium">Direct Asset Overrides</h4>
              </div>
              <div
                v-for="ao in assetsWithOverrides.assetOverrides"
                :key="ao.overrideId"
                class="p-3 flex items-center justify-between hover:bg-elevated/30 cursor-pointer"
                @click="viewEffectiveConfig(ao.asset.id)"
              >
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-truck" class="w-4 h-4 text-muted" />
                  <span>{{ ao.asset.assetNumber }}</span>
                  <span class="text-muted text-sm">
                    {{ ao.asset.make }} {{ ao.asset.model }}
                  </span>
                </div>
                <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-muted" />
              </div>
            </div>

            <!-- Category-level overrides -->
            <div v-if="assetsWithOverrides?.categoryOverrides?.length">
              <div class="p-3 bg-muted/30">
                <h4 class="text-sm font-medium">Category Overrides</h4>
              </div>
              <div v-for="co in assetsWithOverrides.categoryOverrides" :key="co.overrideId">
                <div class="p-3 flex items-center gap-2">
                  <UIcon name="i-lucide-folder" class="w-4 h-4 text-warning" />
                  <span class="font-medium">{{ co.category.name }}</span>
                  <UBadge v-if="co.affectedAssets.length" color="neutral" variant="subtle" size="xs">
                    {{ co.affectedAssets.length }} asset{{ co.affectedAssets.length === 1 ? '' : 's' }}
                  </UBadge>
                </div>
                <div
                  v-for="asset in co.affectedAssets"
                  :key="asset.id"
                  class="p-2 pl-10 flex items-center justify-between hover:bg-elevated/30 cursor-pointer"
                  @click="viewEffectiveConfig(asset.id)"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <UIcon name="i-lucide-truck" class="w-3 h-3 text-muted" />
                    <span>{{ asset.assetNumber }}</span>
                    <span class="text-muted">{{ asset.make }} {{ asset.model }}</span>
                  </div>
                  <UIcon name="i-lucide-chevron-right" class="w-3 h-3 text-muted" />
                </div>
              </div>
            </div>

            <!-- No overrides -->
            <div
              v-if="!assetsWithOverrides?.assetOverrides?.length && !assetsWithOverrides?.categoryOverrides?.length"
              class="p-6 text-center text-muted text-sm"
            >
              No assets are affected by overrides yet.
            </div>
          </div>
        </UPageCard>
      </div>
    </template>

    <!-- Create/Edit Override Modal -->
    <UModal v-model:open="overrideModalOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard :ui="{ body: 'max-h-[70vh] overflow-y-auto' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditingOverride ? 'Edit Override' : 'Create Override' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="overrideModalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-6" @submit.prevent="saveOverride">
            <!-- Target Selection -->
            <div class="space-y-4">
              <UFormField label="Override Type">
                <div class="flex items-center gap-4">
                  <URadio
                    v-model="currentOverride.targetType"
                    value="asset"
                    label="Specific Asset"
                    :disabled="isEditingOverride"
                  />
                  <URadio
                    v-model="currentOverride.targetType"
                    value="category"
                    label="Asset Category"
                    :disabled="isEditingOverride"
                  />
                </div>
              </UFormField>

              <UFormField
                v-if="currentOverride.targetType === 'asset'"
                label="Select Asset"
                required
              >
                <USelect
                  v-model="currentOverride.assetId"
                  :items="assetOptions"
                  placeholder="Search for an asset..."
                  :disabled="isEditingOverride"
                  searchable
                />
              </UFormField>

              <UFormField
                v-if="currentOverride.targetType === 'category'"
                label="Select Category"
                required
              >
                <USelect
                  v-model="currentOverride.categoryId"
                  :items="categoryOptions"
                  placeholder="Select a category..."
                  :disabled="isEditingOverride"
                />
              </UFormField>
            </div>

            <!-- Copy from template button -->
            <div class="flex justify-end">
              <UButton
                type="button"
                label="Copy from Template"
                icon="i-lucide-copy"
                variant="soft"
                color="neutral"
                size="sm"
                @click="copyFromTemplate"
              />
            </div>

            <!-- Duration Override -->
            <UFormField label="Estimated Duration (minutes)">
              <UInput
                v-model.number="currentOverride.estimatedDurationOverride"
                type="number"
                :min="1"
                placeholder="Leave empty to use template default"
              />
            </UFormField>

            <!-- Checklist Override -->
            <div class="border-t border-default pt-4">
              <h4 class="font-medium mb-3">Custom Checklist Items</h4>
              <p class="text-sm text-muted mb-4">
                Define custom checklist items for this override. Leave empty to use template defaults.
              </p>

              <div v-if="currentOverride.checklistOverride.length > 0" class="space-y-2 mb-4">
                <div
                  v-for="item in currentOverride.checklistOverride"
                  :key="item.id"
                  class="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                >
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
                    @click="removeOverrideChecklistItem(item.id)"
                  />
                </div>
              </div>

              <div class="p-3 border border-dashed border-default rounded-lg space-y-2">
                <UInput
                  v-model="newOverrideChecklistItem.title"
                  placeholder="Checklist item title"
                  @keyup.enter.prevent="addOverrideChecklistItem"
                />
                <UInput
                  v-model="newOverrideChecklistItem.description"
                  placeholder="Description (optional)"
                />
                <div class="flex items-center justify-between">
                  <UCheckbox v-model="newOverrideChecklistItem.isRequired" label="Required" />
                  <UButton
                    type="button"
                    label="Add Item"
                    icon="i-lucide-plus"
                    size="xs"
                    variant="soft"
                    :disabled="!newOverrideChecklistItem.title.trim()"
                    @click="addOverrideChecklistItem"
                  />
                </div>
              </div>
            </div>

            <!-- Parts Override -->
            <div class="border-t border-default pt-4">
              <h4 class="font-medium mb-3">Custom Parts</h4>
              <p class="text-sm text-muted mb-4">
                Define custom parts for this override. Leave empty to use template defaults.
              </p>

              <div v-if="currentOverride.partsOverride.length > 0" class="space-y-2 mb-4">
                <div
                  v-for="part in currentOverride.partsOverride"
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
                  </div>
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="removeOverridePart(part.id)"
                  />
                </div>
              </div>

              <div class="p-3 border border-dashed border-default rounded-lg space-y-2">
                <div class="grid grid-cols-2 gap-2">
                  <UInput v-model="newOverridePart.partName" placeholder="Part name" />
                  <UInput v-model="newOverridePart.partNumber" placeholder="Part number (optional)" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <UInput v-model.number="newOverridePart.quantity" type="number" :min="1" placeholder="Qty" />
                  <UInput
                    v-model.number="newOverridePart.estimatedCost"
                    type="number"
                    :min="0"
                    :step="0.01"
                    placeholder="Est. cost ($)"
                  />
                </div>
                <div class="flex justify-end">
                  <UButton
                    type="button"
                    label="Add Part"
                    icon="i-lucide-plus"
                    size="xs"
                    variant="soft"
                    :disabled="!newOverridePart.partName.trim()"
                    @click="addOverridePart"
                  />
                </div>
              </div>
            </div>

            <!-- Notes -->
            <UFormField label="Notes">
              <UTextarea
                v-model="currentOverride.notes"
                placeholder="Additional notes about this override..."
                :rows="2"
              />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="overrideModalOpen = false" />
              <UButton
                type="submit"
                :label="isEditingOverride ? 'Save Changes' : 'Create Override'"
                :loading="overrideLoading"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>

    <!-- Effective Config Modal -->
    <UModal v-model:open="effectiveConfigModalOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Effective Configuration</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="effectiveConfigModalOpen = false"
              />
            </div>
          </template>

          <div v-if="effectiveConfig" class="space-y-4">
            <div v-if="effectiveConfig.overrideLevel" class="p-3 rounded-lg bg-info/10 border border-info/30">
              <div class="flex items-center gap-2 text-sm">
                <UIcon name="i-lucide-info" class="w-4 h-4 text-info" />
                <span>
                  Using
                  <strong>{{ effectiveConfig.overrideLevel }}-level</strong>
                  override
                </span>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <span class="text-sm text-muted">Template:</span>
                <p class="font-medium">{{ effectiveConfig.name }}</p>
              </div>

              <div v-if="effectiveConfig.estimatedDuration">
                <span class="text-sm text-muted">Estimated Duration:</span>
                <p class="font-medium">{{ effectiveConfig.estimatedDuration }} minutes</p>
              </div>

              <div v-if="effectiveConfig.checklistItems.length">
                <span class="text-sm text-muted">Checklist Items ({{ effectiveConfig.checklistItems.length }}):</span>
                <ul class="mt-1 space-y-1">
                  <li
                    v-for="item in effectiveConfig.checklistItems"
                    :key="item.id"
                    class="text-sm flex items-center gap-2"
                  >
                    <UIcon name="i-lucide-check-square" class="w-3 h-3 text-muted" />
                    {{ item.title }}
                    <span v-if="item.isRequired" class="text-error">*</span>
                  </li>
                </ul>
              </div>

              <div v-if="effectiveConfig.requiredParts.length">
                <span class="text-sm text-muted">Required Parts ({{ effectiveConfig.requiredParts.length }}):</span>
                <ul class="mt-1 space-y-1">
                  <li
                    v-for="part in effectiveConfig.requiredParts"
                    :key="part.id"
                    class="text-sm flex items-center gap-2"
                  >
                    <UIcon name="i-lucide-package" class="w-3 h-3 text-muted" />
                    {{ part.quantity }}x {{ part.partName }}
                    <span v-if="part.partNumber" class="text-muted">({{ part.partNumber }})</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-else class="flex items-center justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
          </div>
        </UCard>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
