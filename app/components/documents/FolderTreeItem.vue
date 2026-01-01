<script setup lang="ts">
/**
 * Recursive folder tree item component for document sidebar navigation
 */

interface FolderNode {
  id: string
  name: string
  description: string | null
  path: string
  documentCount?: number
  children: FolderNode[]
}

const props = defineProps<{
  folder: FolderNode
  currentFolderId: string | null
  depth: number
}>()

const emit = defineEmits<{
  navigate: [folderId: string]
  delete: [folderId: string, folderName: string]
  createSubfolder: [parentId: string]
}>()

const isExpanded = ref(false)
const hasChildren = computed(() => props.folder.children.length > 0)
const isSelected = computed(() => props.currentFolderId === props.folder.id)

// Auto-expand if current folder is a descendant
const containsCurrentFolder = computed(() => {
  if (!props.currentFolderId) return false

  const checkChildren = (nodes: FolderNode[]): boolean => {
    for (const node of nodes) {
      if (node.id === props.currentFolderId) return true
      if (node.children.length > 0 && checkChildren(node.children)) return true
    }
    return false
  }

  return checkChildren(props.folder.children)
})

// Expand if contains current folder
watchEffect(() => {
  if (containsCurrentFolder.value) {
    isExpanded.value = true
  }
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function handleNavigate() {
  emit('navigate', props.folder.id)
}

function handleDelete() {
  emit('delete', props.folder.id, props.folder.name)
}

function handleCreateSubfolder() {
  emit('createSubfolder', props.folder.id)
}

const dropdownItems = [
  {
    label: 'Create subfolder',
    icon: 'i-lucide-folder-plus',
    onSelect: handleCreateSubfolder,
  },
  {
    type: 'separator' as const,
  },
  {
    label: 'Delete folder',
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: handleDelete,
  },
]
</script>

<template>
  <div>
    <div
      :class="[
        'group flex items-center gap-1 pr-2 rounded-lg transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
      ]"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
    >
      <!-- Expand/Collapse button -->
      <button
        v-if="hasChildren"
        type="button"
        class="w-5 h-5 flex items-center justify-center text-muted hover:text-default"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? 'Collapse folder' : 'Expand folder'"
        @click.stop="toggleExpand"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="w-3.5 h-3.5"
        />
      </button>
      <div v-else class="w-5" />

      <!-- Folder button -->
      <button
        type="button"
        class="flex-1 flex items-center gap-2 py-2 text-left min-w-0"
        @click="handleNavigate"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-folder-open' : 'i-lucide-folder'"
          :class="['w-4 h-4 flex-shrink-0', isSelected ? 'text-primary' : 'text-muted']"
        />
        <span
          :class="[
            'flex-1 truncate text-sm',
            isSelected ? 'font-medium text-primary' : 'text-default',
          ]"
        >
          {{ folder.name }}
        </span>
        <span v-if="folder.documentCount" class="text-xs text-muted">
          {{ folder.documentCount }}
        </span>
      </button>

      <!-- Actions dropdown -->
      <UDropdownMenu
        :items="dropdownItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-more-horizontal"
          color="neutral"
          variant="ghost"
          size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </UDropdownMenu>
    </div>

    <!-- Children -->
    <div v-if="hasChildren && isExpanded">
      <DocumentsFolderTreeItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :current-folder-id="currentFolderId"
        :depth="depth + 1"
        @navigate="emit('navigate', $event)"
        @delete="emit('delete', $event, child.name)"
        @create-subfolder="emit('createSubfolder', $event)"
      />
    </div>
  </div>
</template>
