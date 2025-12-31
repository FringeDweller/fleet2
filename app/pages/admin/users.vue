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
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  name: string
  phone: string | null
  avatar: { src?: string }
  isActive: boolean
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  role: Role
}

interface UsersResponse {
  data: User[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
  }
}

type RoleItem = {
  id: string
  name: string
  displayName: string
  description: string | null
}

const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')

const toast = useToast()
const router = useRouter()
const { isAdmin, canWriteUsers } = usePermissions()

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
const selectedRoleFilter = ref<string>('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const page = ref(1)
const limit = ref(20)
const sortBy = ref<'name' | 'email' | 'role' | 'createdAt' | 'lastLoginAt'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

// Modals
const showCreateModal = ref(false)
const showEditModal = ref(false)
const selectedUser = ref<User | null>(null)

// Form states
const isCreating = ref(false)
const isUpdating = ref(false)

// Fetch roles for dropdown
const { data: rolesData } = await useFetch<RoleItem[]>('/api/roles', {
  default: () => [],
})

const roleOptions = computed(() => {
  const roles = rolesData.value || []
  return roles.map((r) => ({
    value: r.id,
    label: r.displayName || r.name,
  }))
})

const roleFilterOptions = computed(() => [{ value: '', label: 'All Roles' }, ...roleOptions.value])

// Build query params
const queryParams = computed(() => ({
  search: search.value || undefined,
  roleId: selectedRoleFilter.value || undefined,
  status: statusFilter.value,
  page: page.value,
  limit: limit.value,
  sortBy: sortBy.value,
  sortOrder: sortOrder.value,
}))

// Fetch users
const {
  data: usersData,
  status: usersStatus,
  refresh: refreshUsers,
} = await useFetch<UsersResponse>('/api/admin/users', {
  query: queryParams,
  watch: [queryParams],
  default: (): UsersResponse => ({
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

// Reset page when filters change
watch([selectedRoleFilter, statusFilter], () => {
  page.value = 1
})

// Table columns
const columns: TableColumn<User>[] = [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, {
          src: row.original.avatar?.src,
          alt: row.original.name,
          size: 'md',
        }),
        h('div', undefined, [
          h('p', { class: 'font-medium text-highlighted' }, row.original.name),
          h('p', { class: 'text-sm text-muted' }, row.original.email),
        ]),
      ]),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) =>
      h(
        UBadge,
        { variant: 'subtle', color: getRoleColor(row.original.role.name) },
        () => row.original.role.displayName,
      ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) =>
      h(UBadge, { variant: 'subtle', color: row.original.isActive ? 'success' : 'neutral' }, () =>
        row.original.isActive ? 'Active' : 'Inactive',
      ),
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Last Login',
    cell: ({ row }) => {
      const lastLogin = row.original.lastLoginAt
      if (!lastLogin) return h('span', { class: 'text-muted' }, 'Never')
      return h('span', undefined, formatDate(lastLogin))
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => h('span', undefined, formatDate(row.original.createdAt)),
  },
  {
    accessorKey: 'actions',
    header: '',
    cell: ({ row }) =>
      canWriteUsers.value
        ? h('div', { class: 'flex justify-end gap-1' }, [
            h(UButton, {
              icon: 'i-lucide-pencil',
              color: 'neutral',
              variant: 'ghost',
              size: 'sm',
              onClick: () => openEditModal(row.original),
            }),
          ])
        : null,
  },
]

// Helper functions
function getRoleColor(roleName: string): 'primary' | 'warning' | 'info' | 'neutral' {
  switch (roleName) {
    case 'super_admin':
      return 'primary'
    case 'admin':
      return 'warning'
    case 'fleet_manager':
    case 'supervisor':
      return 'info'
    default:
      return 'neutral'
  }
}

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
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    roleId: roleOptions.value[roleOptions.value.length - 1]?.value || '', // Default to lowest role
    password: '',
    sendWelcomeEmail: true,
  }
  showCreateModal.value = true
}

function openEditModal(user: User) {
  selectedUser.value = user
  editForm.value = {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    roleId: user.role.id,
    password: '',
    isActive: user.isActive,
  }
  showEditModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function closeEditModal() {
  showEditModal.value = false
  selectedUser.value = null
}

// Create user form
const createFormSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  roleId: z.string().uuid('Please select a role'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  sendWelcomeEmail: z.boolean(),
})

const createForm = ref({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  roleId: '',
  password: '',
  sendWelcomeEmail: true,
})

async function handleCreateUser() {
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
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: createForm.value,
    })

    toast.add({
      title: 'User Created',
      description: `${createForm.value.firstName} ${createForm.value.lastName} has been added.`,
      color: 'success',
    })

    closeCreateModal()
    await refreshUsers()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || err.statusMessage || 'Failed to create user',
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

// Edit user form
const editFormSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  roleId: z.string().uuid('Please select a role'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean(),
})

const editForm = ref({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  roleId: '',
  password: '',
  isActive: true,
})

async function handleUpdateUser() {
  if (!selectedUser.value) return

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
    // Build update payload - only include changed fields
    const payload: Record<string, unknown> = {}
    if (editForm.value.email !== selectedUser.value.email) {
      payload.email = editForm.value.email
    }
    if (editForm.value.firstName !== selectedUser.value.firstName) {
      payload.firstName = editForm.value.firstName
    }
    if (editForm.value.lastName !== selectedUser.value.lastName) {
      payload.lastName = editForm.value.lastName
    }
    if (editForm.value.phone !== (selectedUser.value.phone || '')) {
      payload.phone = editForm.value.phone || null
    }
    if (editForm.value.roleId !== selectedUser.value.role.id) {
      payload.roleId = editForm.value.roleId
    }
    if (editForm.value.isActive !== selectedUser.value.isActive) {
      payload.isActive = editForm.value.isActive
    }
    if (editForm.value.password) {
      payload.password = editForm.value.password
    }

    await $fetch(`/api/admin/users/${selectedUser.value.id}`, {
      method: 'PUT',
      body: payload,
    })

    toast.add({
      title: 'User Updated',
      description: 'User details have been saved.',
      color: 'success',
    })

    closeEditModal()
    await refreshUsers()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || err.statusMessage || 'Failed to update user',
      color: 'error',
    })
  } finally {
    isUpdating.value = false
  }
}

// Generate random password
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function setGeneratedPassword(isCreate: boolean) {
  const password = generatePassword()
  if (isCreate) {
    createForm.value.password = password
  } else {
    editForm.value.password = password
  }
}
</script>

<template>
  <UDashboardPanel id="admin-users">
    <template #header>
      <UDashboardNavbar title="User Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            v-if="canWriteUsers"
            label="Add User"
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
          Manage organisation users, roles, and access permissions.
        </p>
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row gap-4 mb-6">
        <UInput
          v-model="search"
          placeholder="Search by name or email..."
          icon="i-lucide-search"
          class="w-full sm:w-80"
        />

        <USelect
          v-model="selectedRoleFilter"
          :items="roleFilterOptions"
          placeholder="Filter by role"
          class="w-full sm:w-48"
        />

        <USelect
          v-model="statusFilter"
          :items="[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]"
          class="w-full sm:w-40"
        />
      </div>

      <!-- Users Table -->
      <UCard>
        <div v-if="usersStatus === 'pending'" class="p-8 text-center text-muted">
          Loading users...
        </div>

        <template v-else-if="usersData?.data?.length">
          <UTable
            :data="usersData.data"
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
            v-if="usersData.pagination.totalPages > 1"
            class="flex items-center justify-between px-4 py-3 border-t border-default"
          >
            <p class="text-sm text-muted">
              Showing {{ (page - 1) * limit + 1 }} to
              {{ Math.min(page * limit, usersData.pagination.total) }} of
              {{ usersData.pagination.total }} users
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
                :disabled="!usersData.pagination.hasMore"
                @click="page++"
              />
            </div>
          </div>
        </template>

        <div v-else class="p-8 text-center">
          <i class="i-lucide-users text-4xl text-muted mb-4" />
          <p class="text-muted">No users found</p>
          <UButton
            v-if="canWriteUsers && !search && !selectedRoleFilter && statusFilter === 'all'"
            label="Add First User"
            icon="i-lucide-plus"
            color="primary"
            class="mt-4"
            @click="openCreateModal"
          />
        </div>
      </UCard>
    </template>
  </UDashboardPanel>

  <!-- Create User Modal -->
  <UModal v-model:open="showCreateModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Add New User</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closeCreateModal"
            />
          </div>
        </template>

        <form class="space-y-4" @submit.prevent="handleCreateUser">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="First Name" required>
              <UInput
                v-model="createForm.firstName"
                placeholder="John"
              />
            </UFormField>

            <UFormField label="Last Name" required>
              <UInput
                v-model="createForm.lastName"
                placeholder="Doe"
              />
            </UFormField>
          </div>

          <UFormField label="Email" required>
            <UInput
              v-model="createForm.email"
              type="email"
              placeholder="john.doe@company.com"
            />
          </UFormField>

          <UFormField label="Phone">
            <UInput
              v-model="createForm.phone"
              type="tel"
              placeholder="+1 234 567 8900"
            />
          </UFormField>

          <UFormField label="Role" required>
            <USelect
              v-model="createForm.roleId"
              :items="roleOptions"
              placeholder="Select role"
            />
          </UFormField>

          <UFormField label="Password" required>
            <div class="flex gap-2">
              <UInput
                v-model="createForm.password"
                type="password"
                placeholder="Minimum 8 characters"
                class="flex-1"
              />
              <UButton
                type="button"
                icon="i-lucide-wand-2"
                color="neutral"
                variant="outline"
                title="Generate password"
                @click="setGeneratedPassword(true)"
              />
            </div>
          </UFormField>

          <div class="flex items-center gap-2">
            <UCheckbox
              v-model="createForm.sendWelcomeEmail"
            />
            <span class="text-sm">Send welcome email with login instructions</span>
          </div>
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
              label="Create User"
              color="primary"
              :loading="isCreating"
              @click="handleCreateUser"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Edit User Modal -->
  <UModal v-model:open="showEditModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Edit User</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closeEditModal"
            />
          </div>
        </template>

        <form class="space-y-4" @submit.prevent="handleUpdateUser">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="First Name" required>
              <UInput
                v-model="editForm.firstName"
                placeholder="John"
              />
            </UFormField>

            <UFormField label="Last Name" required>
              <UInput
                v-model="editForm.lastName"
                placeholder="Doe"
              />
            </UFormField>
          </div>

          <UFormField label="Email" required>
            <UInput
              v-model="editForm.email"
              type="email"
              placeholder="john.doe@company.com"
            />
          </UFormField>

          <UFormField label="Phone">
            <UInput
              v-model="editForm.phone"
              type="tel"
              placeholder="+1 234 567 8900"
            />
          </UFormField>

          <UFormField label="Role" required>
            <USelect
              v-model="editForm.roleId"
              :items="roleOptions"
              placeholder="Select role"
            />
          </UFormField>

          <UFormField label="New Password" hint="Leave empty to keep current password">
            <div class="flex gap-2">
              <UInput
                v-model="editForm.password"
                type="password"
                placeholder="Enter new password"
                class="flex-1"
              />
              <UButton
                type="button"
                icon="i-lucide-wand-2"
                color="neutral"
                variant="outline"
                title="Generate password"
                @click="setGeneratedPassword(false)"
              />
            </div>
          </UFormField>

          <div class="flex items-center gap-2">
            <UCheckbox
              v-model="editForm.isActive"
            />
            <span class="text-sm">Account is active</span>
          </div>
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
              @click="handleUpdateUser"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
