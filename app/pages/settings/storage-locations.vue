<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
})

interface StorageLocation {
  id: string
  name: string
  description: string | null
  type: 'warehouse' | 'bin' | 'shelf' | 'truck' | 'building' | 'room' | 'other'
  code: string | null
  parentId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  parent: StorageLocation | null
}

interface LocationsResponse {
  data: StorageLocation[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()

// Filters
const search = ref('')
const typeFilter = ref('')
const showInactive = ref(false)

// Modal state
const modalOpen = ref(false)
const isEditing = ref(false)
const loading = ref(false)

type LocationType = 'warehouse' | 'bin' | 'shelf' | 'truck' | 'building' | 'room' | 'other'

const currentLocation = ref({
  id: '',
  name: '',
  description: '',
  type: 'warehouse' as LocationType,
  code: '',
  parentId: '', // Empty string means no parent
  isActive: true,
})

// Fetch locations
const queryParams = computed(() => ({
  search: search.value || undefined,
  type: typeFilter.value || undefined,
  includeInactive: showInactive.value ? 'true' : undefined,
  limit: '100',
}))

const {
  data: locationsResponse,
  status,
  refresh,
} = await useFetch<LocationsResponse>('/api/storage-locations', {
  query: queryParams,
  lazy: true,
})

const locations = computed(() => locationsResponse.value?.data || [])

const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Bin', value: 'bin' },
  { label: 'Shelf', value: 'shelf' },
  { label: 'Truck', value: 'truck' },
  { label: 'Building', value: 'building' },
  { label: 'Room', value: 'room' },
  { label: 'Other', value: 'other' },
]

const typeColors: Record<string, string> = {
  warehouse: 'primary',
  bin: 'info',
  shelf: 'success',
  truck: 'warning',
  building: 'neutral',
  room: 'neutral',
  other: 'neutral',
}

const typeLabels: Record<string, string> = {
  warehouse: 'Warehouse',
  bin: 'Bin',
  shelf: 'Shelf',
  truck: 'Truck',
  building: 'Building',
  room: 'Room',
  other: 'Other',
}

// Parent options for dropdown
const parentOptions = computed(() => {
  const options = [{ label: 'No Parent (Root Location)', value: '' }]
  locations.value
    .filter((loc: StorageLocation) => loc.id !== currentLocation.value.id)
    .forEach((loc: StorageLocation) => {
      const parentName = loc.parent?.name ? ` (in ${loc.parent.name})` : ''
      options.push({
        label: `${loc.name}${parentName}`,
        value: loc.id,
      })
    })
  return options
})

function openCreateModal(parentId?: string) {
  isEditing.value = false
  currentLocation.value = {
    id: '',
    name: '',
    description: '',
    type: 'warehouse' as LocationType,
    code: '',
    parentId: parentId || '',
    isActive: true,
  }
  modalOpen.value = true
}

function openEditModal(location: StorageLocation) {
  isEditing.value = true
  currentLocation.value = {
    id: location.id,
    name: location.name,
    description: location.description || '',
    type: location.type,
    code: location.code || '',
    parentId: location.parentId || '',
    isActive: location.isActive,
  }
  modalOpen.value = true
}

async function saveLocation() {
  if (!currentLocation.value.name.trim()) {
    toast.add({
      title: 'Error',
      description: 'Location name is required.',
      color: 'error',
    })
    return
  }

  loading.value = true
  try {
    const body = {
      name: currentLocation.value.name.trim(),
      description: currentLocation.value.description.trim() || null,
      type: currentLocation.value.type,
      code: currentLocation.value.code.trim() || null,
      parentId: currentLocation.value.parentId || null,
      isActive: currentLocation.value.isActive,
    }

    if (isEditing.value) {
      await $fetch(`/api/storage-locations/${currentLocation.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Location updated',
        description: 'The storage location has been updated successfully.',
        color: 'success',
      })
    } else {
      await $fetch('/api/storage-locations', {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Location created',
        description: 'The storage location has been created successfully.',
        color: 'success',
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
        (isEditing.value ? 'Failed to update location.' : 'Failed to create location.'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function toggleActive(location: StorageLocation) {
  try {
    await $fetch(`/api/storage-locations/${location.id}`, {
      method: 'PUT',
      body: { isActive: !location.isActive },
    })
    toast.add({
      title: location.isActive ? 'Location deactivated' : 'Location activated',
      color: 'success',
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update location status.',
      color: 'error',
    })
  }
}

async function deleteLocation(location: StorageLocation) {
  if (!confirm(`Are you sure you want to delete "${location.name}"?`)) {
    return
  }

  try {
    await $fetch(`/api/storage-locations/${location.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Location deleted',
      description: `"${location.name}" has been deleted.`,
      color: 'success',
    })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to delete location.',
      color: 'error',
    })
  }
}

function getRowActions(location: StorageLocation) {
  return [
    [
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEditModal(location),
      },
      {
        label: 'Add Child Location',
        icon: 'i-lucide-plus',
        onSelect: () => openCreateModal(location.id),
      },
      {
        label: location.isActive ? 'Deactivate' : 'Activate',
        icon: location.isActive ? 'i-lucide-toggle-right' : 'i-lucide-toggle-left',
        onSelect: () => toggleActive(location),
      },
    ],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteLocation(location),
      },
    ],
  ]
}

// Build hierarchical tree for display
interface LocationNode extends StorageLocation {
  children: LocationNode[]
  level: number
}

function buildLocationTree(locations: StorageLocation[]): LocationNode[] {
  const map = new Map<string, LocationNode>()
  const roots: LocationNode[] = []

  // First pass: create nodes
  for (const loc of locations) {
    map.set(loc.id, { ...loc, children: [], level: 0 })
  }

  // Second pass: build tree
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!
      node.level = parent.level + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// Flatten tree for table display
function flattenTree(nodes: LocationNode[]): LocationNode[] {
  const result: LocationNode[] = []
  function traverse(node: LocationNode) {
    result.push(node)
    for (const child of node.children) {
      traverse(child)
    }
  }
  for (const root of nodes) {
    traverse(root)
  }
  return result
}

const locationTree = computed(() => buildLocationTree(locations.value))
const flatLocations = computed(() => flattenTree(locationTree.value))

const columns: TableColumn<LocationNode>[] = [
  {
    accessorKey: 'name',
    header: 'Location',
    cell: ({ row }) => {
      const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(row.original.level)
      const prefix = row.original.level > 0 ? '\u2514\u2500 ' : ''
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'text-muted font-mono text-xs' }, indent + prefix),
        h('span', { class: 'font-medium' }, row.original.name),
        !row.original.isActive
          ? h(UBadge, { color: 'neutral', variant: 'subtle', size: 'xs' }, () => 'Inactive')
          : null,
      ])
    },
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) =>
      row.original.code
        ? h('span', { class: 'font-mono text-sm' }, row.original.code)
        : h('span', { class: 'text-muted' }, '-'),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: (typeColors[row.original.type] as any) || 'neutral',
          variant: 'subtle',
          size: 'sm',
        },
        () => typeLabels[row.original.type] || row.original.type,
      ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) =>
      row.original.description
        ? h(
            'p',
            { class: 'text-sm truncate max-w-[200px]', title: row.original.description },
            row.original.description,
          )
        : h('span', { class: 'text-muted' }, '-'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'flex justify-end' },
        h(
          resolveComponent('UDropdownMenu'),
          {
            items: getRowActions(row.original),
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-more-horizontal',
              color: 'neutral',
              variant: 'ghost',
              size: 'sm',
            }),
        ),
      ),
  },
]
</script>

<template>
  <div>
    <UPageCard
      title="Storage Locations"
      description="Manage storage locations for parts inventory. Create hierarchical structures like warehouses, bins, and shelves."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Create Location"
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
        header: 'p-4 mb-0 border-b border-default',
      }"
    >
      <template #header>
        <div class="flex flex-wrap items-center gap-4">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search locations..."
            class="w-64"
          />
          <USelect
            v-model="typeFilter"
            :items="typeOptions"
            placeholder="Filter by type"
            class="w-40"
          />
          <UCheckbox v-model="showInactive" label="Show inactive" />
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="flatLocations.length === 0" class="text-center py-12 text-muted">
        <UIcon name="i-lucide-warehouse" class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="mb-2">No storage locations found</p>
        <UButton label="Create your first location" variant="link" @click="openCreateModal()" />
      </div>

      <UTable
        v-else
        :data="flatLocations"
        :columns="columns"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
        }"
      />
    </UPageCard>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                {{ isEditing ? 'Edit Location' : 'Create Location' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="modalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="saveLocation">
            <UFormField label="Location Name" required>
              <UInput
                v-model="currentLocation.name"
                placeholder="e.g., Main Warehouse, Bin A-01"
                autofocus
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Type">
                <USelect
                  v-model="currentLocation.type"
                  :items="typeOptions.slice(1)"
                />
              </UFormField>

              <UFormField label="Code">
                <UInput v-model="currentLocation.code" placeholder="e.g., WH-01" />
              </UFormField>
            </div>

            <UFormField label="Parent Location">
              <USelect
                v-model="currentLocation.parentId"
                :items="parentOptions"
                placeholder="Select parent location"
              />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="currentLocation.description"
                placeholder="Describe this location"
                :rows="2"
              />
            </UFormField>

            <div class="flex items-center pt-2">
              <UCheckbox v-model="currentLocation.isActive" label="Active location" />
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="modalOpen = false" />
              <UButton
                type="submit"
                :label="isEditing ? 'Save Changes' : 'Create Location'"
                :loading="loading"
                :disabled="!currentLocation.name.trim()"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
