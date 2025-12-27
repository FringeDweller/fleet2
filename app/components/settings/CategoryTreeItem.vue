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

const props = defineProps<{
  category: CategoryNode
  level: number
  expandedCategories: Set<string>
  getRowActions: (
    category: CategoryNode
  ) => Array<Array<{ label: string; icon: string; color?: string; onSelect: () => void }>>
}>()

const emit = defineEmits<{
  toggleExpand: [id: string]
}>()

const hasChildren = computed(() => props.category.children.length > 0)
const isExpanded = computed(() => props.expandedCategories.has(props.category.id))
</script>

<template>
  <div>
    <div
      class="flex items-center gap-2 p-4 hover:bg-elevated/50 transition-colors"
      :style="{ paddingLeft: `${16 + level * 24}px` }"
    >
      <button
        v-if="hasChildren"
        class="p-1 rounded hover:bg-muted/50 transition-colors"
        @click="emit('toggleExpand', category.id)"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="w-4 h-4 text-muted"
        />
      </button>
      <div v-else class="w-6" />

      <UIcon
        :name="hasChildren ? 'i-lucide-folder' : 'i-lucide-folder-open'"
        class="w-5 h-5 text-muted"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="font-medium truncate" :class="{ 'text-muted': !category.isActive }">
            {{ category.name }}
          </h3>
          <UBadge v-if="category.assetCount > 0" color="info" variant="subtle" size="xs">
            {{ category.assetCount }} asset{{ category.assetCount === 1 ? '' : 's' }}
          </UBadge>
          <UBadge v-if="!category.isActive" color="warning" variant="subtle" size="xs">
            Inactive
          </UBadge>
        </div>
        <p v-if="category.description" class="text-sm text-muted truncate mt-1">
          {{ category.description }}
        </p>
        <div class="flex items-center gap-4 mt-1 text-xs text-muted flex-wrap">
          <span v-if="category.defaultMaintenanceSchedules?.length" class="flex items-center gap-1">
            <UIcon name="i-lucide-calendar" class="w-3 h-3" />
            {{ category.defaultMaintenanceSchedules.length }} schedule{{
              category.defaultMaintenanceSchedules.length === 1 ? '' : 's'
            }}
          </span>
          <span v-if="category.defaultParts?.length" class="flex items-center gap-1">
            <UIcon name="i-lucide-package" class="w-3 h-3" />
            {{ category.defaultParts.length }} part{{
              category.defaultParts.length === 1 ? '' : 's'
            }}
          </span>
          <span v-if="hasChildren" class="flex items-center gap-1">
            <UIcon name="i-lucide-folder-tree" class="w-3 h-3" />
            {{ category.children.length }} subcategor{{
              category.children.length === 1 ? 'y' : 'ies'
            }}
          </span>
        </div>
      </div>

      <UDropdownMenu :items="getRowActions(category)">
        <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" />
      </UDropdownMenu>
    </div>

    <template v-if="hasChildren && isExpanded">
      <CategoryTreeItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :level="level + 1"
        :expanded-categories="expandedCategories"
        :get-row-actions="getRowActions"
        @toggle-expand="emit('toggleExpand', $event)"
      />
    </template>
  </div>
</template>
