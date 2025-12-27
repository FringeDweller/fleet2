<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Member } from '~/types'

interface Role {
  id: string
  name: string
  displayName: string
}

const props = defineProps<{
  members: Member[]
}>()

const emit = defineEmits<{
  (e: 'update', member: Member): void
  (e: 'refresh'): void
}>()

const { canWriteUsers, canDeleteUsers, isAdmin } = usePermissions()
const toast = useToast()

// Fetch available roles
const { data: roles } = await useFetch<Role[]>('/api/roles', {
  default: () => [],
})

// Role options for dropdown
const roleOptions = computed(() =>
  roles.value.map((role) => ({
    label: role.displayName,
    value: role.id,
  })),
)

// Update member role
async function updateMemberRole(member: Member, roleId: string) {
  try {
    await $fetch(`/api/members/${member.id}/role`, {
      method: 'PUT',
      body: { roleId },
    })
    toast.add({
      title: 'Role updated',
      description: `${member.name}'s role has been updated`,
      color: 'success',
    })
    emit('refresh')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update role'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  }
}

// Deactivate member
async function deactivateMember(member: Member) {
  if (!confirm(`Are you sure you want to deactivate ${member.name}?`)) {
    return
  }

  try {
    await $fetch(`/api/members/${member.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Member deactivated',
      description: `${member.name} has been deactivated`,
      color: 'success',
    })
    emit('refresh')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate member'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  }
}

// Build menu items for each member
function getMenuItems(member: Member): DropdownMenuItem[] {
  const items: DropdownMenuItem[] = []

  if (canWriteUsers.value) {
    items.push({
      label: 'Edit member',
      icon: 'i-lucide-pencil',
      onSelect: () => emit('update', member),
    })
  }

  if (canDeleteUsers.value && member.isActive) {
    items.push({
      label: 'Deactivate member',
      icon: 'i-lucide-user-x',
      color: 'error' as const,
      onSelect: () => deactivateMember(member),
    })
  }

  return items
}
</script>

<template>
  <ul role="list" class="divide-y divide-default">
    <li
      v-for="member in members"
      :key="member.id"
      class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
      :class="{ 'opacity-50': !member.isActive }"
    >
      <div class="flex items-center gap-3 min-w-0">
        <UAvatar v-bind="member.avatar" size="md" />

        <div class="text-sm min-w-0">
          <p class="text-highlighted font-medium truncate">
            {{ member.name }}
            <UBadge v-if="!member.isActive" color="neutral" size="xs" class="ml-1">
              Inactive
            </UBadge>
          </p>
          <p class="text-muted truncate">
            {{ member.email }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Role selector - only editable by users with write permission -->
        <PermissionGate permission="users:write">
          <USelect
            :model-value="member.roleId"
            :items="roleOptions"
            value-key="value"
            color="neutral"
            :disabled="member.roleName === 'admin' && !isAdmin"
            @update:model-value="(roleId: string) => updateMemberRole(member, roleId)"
          />
          <template #fallback>
            <UBadge color="neutral" variant="subtle">
              {{ member.role }}
            </UBadge>
          </template>
        </PermissionGate>

        <!-- Actions menu - only show if user has write or delete permission -->
        <PermissionGate :any-permission="['users:write', 'users:delete']">
          <UDropdownMenu :items="getMenuItems(member)" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" />
          </UDropdownMenu>
        </PermissionGate>
      </div>
    </li>
  </ul>
</template>
