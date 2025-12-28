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

const props = defineProps<{
  group: TaskGroupNode
  level: number
  expandedGroups: Set<string>
  getRowActions: (
    group: TaskGroupNode,
  ) => Array<Array<{ label: string; icon: string; color?: string; onSelect: () => void }>>
}>()

const emit = defineEmits<{
  toggleExpand: [id: string]
  editTemplate: [template: TaskTemplate]
}>()

const hasChildren = computed(() => props.group.children.length > 0)
const isExpanded = computed(() => props.expandedGroups.has(props.group.id))
const templateCount = computed(() => props.group.templates?.length || 0)
</script>

<template>
  <div>
    <div
      class="flex items-center gap-2 p-4 hover:bg-elevated/50 transition-colors"
      :style="{ paddingLeft: `${16 + level * 24}px` }"
    >
      <button
        v-if="hasChildren || templateCount > 0"
        type="button"
        class="p-1 rounded hover:bg-muted/50 transition-colors"
        @click="emit('toggleExpand', group.id)"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="w-4 h-4 text-muted"
        />
      </button>
      <div v-else class="w-6" />

      <UIcon
        :name="hasChildren ? 'i-lucide-folder' : 'i-lucide-folder-open'"
        class="w-5 h-5 text-primary"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="font-medium truncate">
            {{ group.name }}
          </h3>
          <UBadge
            v-if="templateCount > 0"
            color="info"
            variant="subtle"
            size="xs"
          >
            {{ templateCount }} template{{ templateCount === 1 ? '' : 's' }}
          </UBadge>
          <UBadge
            v-if="hasChildren"
            color="neutral"
            variant="subtle"
            size="xs"
          >
            {{ group.children.length }} subgroup{{ group.children.length === 1 ? '' : 's' }}
          </UBadge>
        </div>
        <p v-if="group.description" class="text-sm text-muted truncate mt-1">
          {{ group.description }}
        </p>
      </div>

      <UDropdownMenu :items="getRowActions(group)">
        <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" />
      </UDropdownMenu>
    </div>

    <!-- Templates in this group -->
    <template v-if="isExpanded && templateCount > 0">
      <div
        v-for="template in group.templates"
        :key="template.id"
        class="flex items-center gap-2 p-3 hover:bg-elevated/30 transition-colors cursor-pointer"
        :style="{ paddingLeft: `${48 + level * 24}px` }"
        @click="emit('editTemplate', template)"
      >
        <UIcon name="i-lucide-clipboard-list" class="w-4 h-4 text-muted" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium truncate">{{ template.name }}</span>
            <UBadge
              v-if="template.category"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ template.category }}
            </UBadge>
            <UBadge
              v-if="!template.isActive"
              color="warning"
              variant="subtle"
              size="xs"
            >
              Inactive
            </UBadge>
          </div>
        </div>
        <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-muted" />
      </div>
    </template>

    <!-- Child groups -->
    <template v-if="hasChildren && isExpanded">
      <TaskGroupTreeItem
        v-for="child in group.children"
        :key="child.id"
        :group="child"
        :level="level + 1"
        :expanded-groups="expandedGroups"
        :get-row-actions="getRowActions"
        @toggle-expand="emit('toggleExpand', $event)"
        @edit-template="emit('editTemplate', $event)"
      />
    </template>
  </div>
</template>
