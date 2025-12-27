<script setup lang="ts">
import type { Member } from '~/types'

const { canReadUsers, canWriteUsers } = usePermissions()

const {
  data: members,
  refresh,
  status,
} = await useFetch<Member[]>('/api/members', { default: () => [] })

const q = ref('')

const filteredMembers = computed(() => {
  return members.value.filter((member) => {
    const searchTerm = new RegExp(q.value, 'i')
    return member.name.search(searchTerm) !== -1 || member.email.search(searchTerm) !== -1
  })
})

function handleUpdate(member: Member) {
  // TODO: Open edit modal
  console.log('Edit member:', member)
}
</script>

<template>
  <div>
    <UPageCard
      title="Members"
      description="Manage team members and their roles."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <PermissionGate permission="users:write">
        <UButton label="Invite people" color="neutral" class="w-fit lg:ms-auto" />
      </PermissionGate>
    </UPageCard>

    <PermissionGate permission="users:read">
      <UPageCard
        variant="subtle"
        :ui="{
          container: 'p-0 sm:p-0 gap-y-0',
          wrapper: 'items-stretch',
          header: 'p-4 mb-0 border-b border-default',
        }"
      >
        <template #header>
          <UInput
            v-model="q"
            icon="i-lucide-search"
            placeholder="Search members"
            autofocus
            class="w-full"
          />
        </template>

        <div v-if="status === 'pending'" class="p-8 text-center text-muted">
          Loading members...
        </div>

        <div v-else-if="filteredMembers.length === 0" class="p-8 text-center text-muted">
          No members found
        </div>

        <SettingsMembersList
          v-else
          :members="filteredMembers"
          @update="handleUpdate"
          @refresh="refresh"
        />
      </UPageCard>

      <template #fallback>
        <UPageCard variant="subtle" class="text-center py-8">
          <p class="text-muted">You don't have permission to view team members.</p>
        </UPageCard>
      </template>
    </PermissionGate>
  </div>
</template>
