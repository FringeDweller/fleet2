<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import * as z from 'zod'

definePageMeta({
  middleware: 'auth',
})

// Types
interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  permissions: string[]
  permissionCount: number
  userCount: number
  createdAt: string
  updatedAt: string
}

interface RolesResponse {
  data: Role[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
  }
}

// Available permissions in the system
const AVAILABLE_PERMISSIONS = [
  { value: 'assets:read', label: 'View Assets', category: 'Assets' },
  { value: 'assets:write', label: 'Edit Assets', category: 'Assets' },
  { value: 'assets:delete', label: 'Delete Assets', category: 'Assets' },
  { value: 'work_orders:read', label: 'View Work Orders', category: 'Work Orders' },
  { value: 'work_orders:write', label: 'Edit Work Orders', category: 'Work Orders' },
  { value: 'work_orders:delete', label: 'Delete Work Orders', category: 'Work Orders' },
  { value: 'reports:read', label: 'View Reports', category: 'Reports' },
  { value: 'reports:write', label: 'Create Reports', category: 'Reports' },
  { value: 'users:read', label: 'View Users', category: 'Users' },
  { value: 'users:write', label: 'Edit Users', category: 'Users' },
  { value: 'users:delete', label: 'Delete Users', category: 'Users' },
  { value: 'settings:read', label: 'View Settings', category: 'Settings' },
  { value: 'settings:write', label: 'Edit Settings', category: 'Settings' },
  { value: 'parts:read', label: 'View Parts', category: 'Parts' },
  { value: 'parts:write', label: 'Edit Parts', category: 'Parts' },
  { value: 'parts:delete', label: 'Delete Parts', category: 'Parts' },
  { value: 'maintenance:read', label: 'View Maintenance', category: 'Maintenance' },
  { value: 'maintenance:write', label: 'Edit Maintenance', category: 'Maintenance' },
  { value: 'maintenance:delete', label: 'Delete Maintenance', category: 'Maintenance' },
  { value: 'organisations:read', label: 'View Organisations', category: 'Organisations' },
  { value: 'organisations:write', label: 'Edit Organisations', category: 'Organisations' },
  { value: 'organisations:delete', label: 'Delete Organisations', category: 'Organisations' },
] as const

// Group permissions by category
const permissionsByCategory = computed(() => {
  const grouped: Record<string, (typeof AVAILABLE_PERMISSIONS)[number][]> = {}
  for (const perm of AVAILABLE_PERMISSIONS) {
    if (!grouped[perm.category]) {
      grouped[perm.category] = []
    }
    grouped[perm.category]!.push(perm)
  }
  return grouped
})

// System roles that cannot be modified/deleted
const SYSTEM_ROLES = [
  'super_admin',
  'admin',
  'fleet_manager',
  'supervisor',
  'technician',
  'operator',
]

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()
const router = useRouter()
const { isAdmin, isSuperAdmin } = usePermissions()

// Redirect if not admin
watch(
  isAdmin,
  (val) => {
    if (val === false) {
      router.push('/')
    }
  },
  { immediate: true },
)

// State
const search = ref('')
const page = ref(1)
const limit = ref(20)
const sortBy = ref<'name' | 'displayName' | 'createdAt'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

// Modals
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const selectedRole = ref<Role | null>(null)

// Form states
const isCreating = ref(false)
const isUpdating = ref(false)
const isDeleting = ref(false)

// Build query params
const queryParams = computed(() => ({
  search: search.value || undefined,
  page: page.value,
  limit: limit.value,
  sortBy: sortBy.value,
  sortOrder: sortOrder.value,
}))

// Fetch roles
const {
  data: rolesData,
  status: rolesStatus,
  refresh: refreshRoles,
} = await useFetch<RolesResponse>('/api/admin/roles', {
  query: queryParams,
  watch: [queryParams],
  default: (): RolesResponse => ({
    data: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false },
  }),
})

// Debounced search
const debouncedSearch = useDebounceFn(() => {
  page.value = 1
}, 300)

watch(search, () => {
  debouncedSearch()
})

// Table columns
const columns: TableColumn<Role>[] = [
  {
    accessorKey: 'displayName',
    header: 'Role',
    cell: ({ row }) =>
      h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, row.original.displayName),
        h('p', { class: 'text-sm text-muted font-mono' }, row.original.name),
      ]),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => h('span', { class: 'text-muted' }, row.original.description || '-'),
  },
  {
    accessorKey: 'permissionCount',
    header: 'Permissions',
    cell: ({ row }) => {
      const perms = row.original.permissions || []
      if (perms.includes('**')) {
        return h(UBadge, { variant: 'subtle', color: 'error' }, () => 'Super Admin')
      }
      if (perms.includes('*')) {
        return h(UBadge, { variant: 'subtle', color: 'warning' }, () => 'All Permissions')
      }
      return h(
        UBadge,
        { variant: 'subtle', color: 'neutral' },
        () => `${row.original.permissionCount} permissions`,
      )
    },
  },
  {
    accessorKey: 'userCount',
    header: 'Users',
    cell: ({ row }) =>
      h(UBadge, { variant: 'subtle', color: row.original.userCount > 0 ? 'info' : 'neutral' }, () =>
        row.original.userCount.toString(),
      ),
  },
  {
    accessorKey: 'actions',
    header: '',
    cell: ({ row }) => {
      const isSystemRole = SYSTEM_ROLES.includes(row.original.name)
      const canEdit = !isSystemRole || isSuperAdmin.value
      const canDelete = !isSystemRole && row.original.userCount === 0

      return h('div', { class: 'flex justify-end gap-1' }, [
        h(UButton, {
          icon: 'i-lucide-pencil',
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          disabled: !canEdit,
          title: canEdit ? 'Edit role' : 'System roles cannot be edited',
          onClick: () => canEdit && openEditModal(row.original),
        }),
        h(UButton, {
          icon: 'i-lucide-trash-2',
          color: 'error',
          variant: 'ghost',
          size: 'sm',
          disabled: !canDelete,
          title: isSystemRole
            ? 'System roles cannot be deleted'
            : row.original.userCount > 0
              ? 'Cannot delete: users assigned'
              : 'Delete role',
          onClick: () => canDelete && openDeleteModal(row.original),
        }),
      ])
    },
  },
]

// Helper functions
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Modal handlers
function openCreateModal() {
  createForm.value = {
    name: '',
    displayName: '',
    description: '',
    permissions: [],
  }
  showCreateModal.value = true
}

function openEditModal(role: Role) {
  selectedRole.value = role
  editForm.value = {
    displayName: role.displayName,
    description: role.description || '',
    permissions: [...role.permissions],
  }
  showEditModal.value = true
}

function openDeleteModal(role: Role) {
  selectedRole.value = role
  showDeleteModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function closeEditModal() {
  showEditModal.value = false
  selectedRole.value = null
}

function closeDeleteModal() {
  showDeleteModal.value = false
  selectedRole.value = null
}

// Create role form
const createFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z_]+$/, 'Name must be lowercase with underscores only'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  permissions: z.array(z.string()),
})

const createForm = ref({
  name: '',
  displayName: '',
  description: '',
  permissions: [] as string[],
})

async function handleCreateRole() {
  const result = createFormSchema.safeParse(createForm.value)
  if (!result.success) {
    const errors = result.error.flatten()
    const firstError = Object.values(errors.fieldErrors)[0]?.[0]
    toast.add({
      title: 'Validation Error',
      description: firstError || 'Please check the form',
      color: 'error',
    })
    return
  }

  isCreating.value = true
  try {
    await $fetch('/api/admin/roles', {
      method: 'POST',
      body: createForm.value,
    })

    toast.add({
      title: 'Role Created',
      description: `${createForm.value.displayName} has been created.`,
      color: 'success',
    })

    closeCreateModal()
    await refreshRoles()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || err.statusMessage || 'Failed to create role',
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

// Edit role form
const editFormSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  permissions: z.array(z.string()),
})

const editForm = ref({
  displayName: '',
  description: '',
  permissions: [] as string[],
})

async function handleUpdateRole() {
  if (!selectedRole.value) return

  const result = editFormSchema.safeParse(editForm.value)
  if (!result.success) {
    const errors = result.error.flatten()
    const firstError = Object.values(errors.fieldErrors)[0]?.[0]
    toast.add({
      title: 'Validation Error',
      description: firstError || 'Please check the form',
      color: 'error',
    })
    return
  }

  isUpdating.value = true
  try {
    await $fetch(`/api/admin/roles/${selectedRole.value.id}`, {
      method: 'PUT',
      body: editForm.value,
    })

    toast.add({
      title: 'Role Updated',
      description: 'Role details have been saved.',
      color: 'success',
    })

    closeEditModal()
    await refreshRoles()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || err.statusMessage || 'Failed to update role',
      color: 'error',
    })
  } finally {
    isUpdating.value = false
  }
}

// Delete role
async function handleDeleteRole() {
  if (!selectedRole.value) return

  isDeleting.value = true
  try {
    await $fetch(`/api/admin/roles/${selectedRole.value.id}`, {
      method: 'DELETE',
    })

    toast.add({
      title: 'Role Deleted',
      description: `${selectedRole.value.displayName} has been deleted.`,
      color: 'success',
    })

    closeDeleteModal()
    await refreshRoles()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || err.statusMessage || 'Failed to delete role',
      color: 'error',
    })
  } finally {
    isDeleting.value = false
  }
}

// Permission toggle helpers
function togglePermission(form: { permissions: string[] }, permission: string) {
  const index = form.permissions.indexOf(permission)
  if (index > -1) {
    form.permissions.splice(index, 1)
  } else {
    form.permissions.push(permission)
  }
}

function toggleCategoryPermissions(form: { permissions: string[] }, category: string) {
  const categoryPerms = permissionsByCategory.value[category] || []
  const allSelected = categoryPerms.every((p) => form.permissions.includes(p.value))

  if (allSelected) {
    // Remove all from category
    for (const perm of categoryPerms) {
      const index = form.permissions.indexOf(perm.value)
      if (index > -1) {
        form.permissions.splice(index, 1)
      }
    }
  } else {
    // Add all from category
    for (const perm of categoryPerms) {
      if (!form.permissions.includes(perm.value)) {
        form.permissions.push(perm.value)
      }
    }
  }
}

function isCategoryFullySelected(permissions: string[], category: string): boolean {
  const categoryPerms = permissionsByCategory.value[category] || []
  return categoryPerms.every((p) => permissions.includes(p.value))
}

function isCategoryPartiallySelected(permissions: string[], category: string): boolean {
  const categoryPerms = permissionsByCategory.value[category] || []
  const selectedCount = categoryPerms.filter((p) => permissions.includes(p.value)).length
  return selectedCount > 0 && selectedCount < categoryPerms.length
}
</script>

<template>
  <UDashboardPanel id="admin-roles">
    <template #header>
      <UDashboardNavbar title="Role Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Add Role"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Description -->
      <div class="mb-6">
        <p class="text-muted">
          Manage roles and their permissions. System roles (Admin, Fleet Manager, etc.) cannot be deleted.
        </p>
      </div>

      <!-- Search -->
      <div class="flex flex-col sm:flex-row gap-4 mb-6">
        <UInput
          v-model="search"
          placeholder="Search roles..."
          icon="i-lucide-search"
          class="w-full sm:w-80"
        />
      </div>

      <!-- Roles Table -->
      <UCard>
        <div v-if="rolesStatus === 'pending'" class="p-8 text-center text-muted">
          Loading roles...
        </div>

        <template v-else-if="rolesData?.data?.length">
          <UTable
            :data="rolesData.data"
            :columns="columns"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default',
            }"
          />

          <!-- Pagination -->
          <div
            v-if="rolesData.pagination.totalPages > 1"
            class="flex items-center justify-between px-4 py-3 border-t border-default"
          >
            <p class="text-sm text-muted">
              Showing {{ (page - 1) * limit + 1 }} to
              {{ Math.min(page * limit, rolesData.pagination.total) }} of
              {{ rolesData.pagination.total }} roles
            </p>
            <div class="flex gap-2">
              <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="page <= 1"
                @click="page--"
              />
              <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="!rolesData.pagination.hasMore"
                @click="page++"
              />
            </div>
          </div>
        </template>

        <div v-else class="p-8 text-center">
          <i class="i-lucide-shield text-4xl text-muted mb-4" />
          <p class="text-muted">No roles found</p>
          <UButton
            v-if="!search"
            label="Create First Role"
            icon="i-lucide-plus"
            color="primary"
            class="mt-4"
            @click="openCreateModal"
          />
        </div>
      </UCard>
    </template>
  </UDashboardPanel>

  <!-- Create Role Modal -->
  <UModal v-model:open="showCreateModal">
    <template #content>
      <UCard class="max-h-[90vh] overflow-hidden flex flex-col">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Create New Role</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closeCreateModal"
            />
          </div>
        </template>

        <form class="space-y-4 overflow-y-auto flex-1" @submit.prevent="handleCreateRole">
          <UFormField label="Internal Name" required hint="Lowercase with underscores (e.g., custom_manager)">
            <UInput
              v-model="createForm.name"
              placeholder="custom_role"
            />
          </UFormField>

          <UFormField label="Display Name" required>
            <UInput
              v-model="createForm.displayName"
              placeholder="Custom Role"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="createForm.description"
              placeholder="Describe the purpose of this role..."
              :rows="2"
            />
          </UFormField>

          <UFormField label="Permissions">
            <div class="border border-default rounded-lg p-4 space-y-4 max-h-60 overflow-y-auto">
              <div v-for="(perms, category) in permissionsByCategory" :key="category" class="space-y-2">
                <div class="flex items-center gap-2">
                  <UCheckbox
                    :model-value="isCategoryFullySelected(createForm.permissions, category)"
                    :indeterminate="isCategoryPartiallySelected(createForm.permissions, category)"
                    @update:model-value="toggleCategoryPermissions(createForm, category)"
                  />
                  <span class="font-medium text-sm">{{ category }}</span>
                </div>
                <div class="pl-6 grid grid-cols-2 gap-2">
                  <div v-for="perm in perms" :key="perm.value" class="flex items-center gap-2">
                    <UCheckbox
                      :model-value="createForm.permissions.includes(perm.value)"
                      @update:model-value="togglePermission(createForm, perm.value)"
                    />
                    <span class="text-sm">{{ perm.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </UFormField>
        </form>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="closeCreateModal"
            />
            <UButton
              label="Create Role"
              color="primary"
              :loading="isCreating"
              @click="handleCreateRole"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Edit Role Modal -->
  <UModal v-model:open="showEditModal">
    <template #content>
      <UCard class="max-h-[90vh] overflow-hidden flex flex-col">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Edit Role: {{ selectedRole?.displayName }}</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closeEditModal"
            />
          </div>
        </template>

        <form class="space-y-4 overflow-y-auto flex-1" @submit.prevent="handleUpdateRole">
          <UFormField label="Internal Name">
            <UInput
              :model-value="selectedRole?.name"
              disabled
              class="opacity-50"
            />
            <template #hint>
              <span class="text-muted">Role names cannot be changed after creation</span>
            </template>
          </UFormField>

          <UFormField label="Display Name" required>
            <UInput
              v-model="editForm.displayName"
              placeholder="Custom Role"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="editForm.description"
              placeholder="Describe the purpose of this role..."
              :rows="2"
            />
          </UFormField>

          <UFormField label="Permissions">
            <div class="border border-default rounded-lg p-4 space-y-4 max-h-60 overflow-y-auto">
              <div v-for="(perms, category) in permissionsByCategory" :key="category" class="space-y-2">
                <div class="flex items-center gap-2">
                  <UCheckbox
                    :model-value="isCategoryFullySelected(editForm.permissions, category)"
                    :indeterminate="isCategoryPartiallySelected(editForm.permissions, category)"
                    @update:model-value="toggleCategoryPermissions(editForm, category)"
                  />
                  <span class="font-medium text-sm">{{ category }}</span>
                </div>
                <div class="pl-6 grid grid-cols-2 gap-2">
                  <div v-for="perm in perms" :key="perm.value" class="flex items-center gap-2">
                    <UCheckbox
                      :model-value="editForm.permissions.includes(perm.value)"
                      @update:model-value="togglePermission(editForm, perm.value)"
                    />
                    <span class="text-sm">{{ perm.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </UFormField>
        </form>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="closeEditModal"
            />
            <UButton
              label="Save Changes"
              color="primary"
              :loading="isUpdating"
              @click="handleUpdateRole"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Delete Confirmation Modal -->
  <UModal v-model:open="showDeleteModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-error">Delete Role</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closeDeleteModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <p>
            Are you sure you want to delete the role
            <strong>{{ selectedRole?.displayName }}</strong>?
          </p>
          <p class="text-sm text-muted">
            This action cannot be undone.
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="closeDeleteModal"
            />
            <UButton
              label="Delete Role"
              color="error"
              :loading="isDeleting"
              @click="handleDeleteRole"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
