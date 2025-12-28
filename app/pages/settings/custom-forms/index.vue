<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface CustomForm {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  version: number
  fieldCount: number
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    firstName: string
    lastName: string
  } | null
  updatedBy?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface FormsResponse {
  data: CustomForm[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const router = useRouter()
const toast = useToast()

// Filters
const search = ref('')
const selectedStatus = ref<string | undefined>(undefined)
const debouncedSearch = refDebounced(search, 300)

// Pagination
const page = ref(1)
const limit = 20

const {
  data: formsData,
  status,
  refresh,
} = await useFetch<FormsResponse>('/api/custom-forms', {
  query: computed(() => ({
    search: debouncedSearch.value || undefined,
    status: selectedStatus.value || undefined,
    limit,
    offset: (page.value - 1) * limit,
  })),
  lazy: true,
})

const forms = computed(() => formsData.value?.data || [])
const totalPages = computed(() => Math.ceil((formsData.value?.pagination.total || 0) / limit))

const statusOptions = [
  { label: 'All Status', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
]

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'success'
    case 'draft':
      return 'warning'
    case 'archived':
      return 'neutral'
    default:
      return 'neutral'
  }
}

async function deleteForm(form: CustomForm) {
  try {
    await $fetch(`/api/custom-forms/${form.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Form deleted',
      description: `"${form.name}" has been deleted.`,
    })
    refresh()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to delete form.',
      color: 'error',
    })
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <UDashboardPanel id="custom-forms">
    <template #header>
      <UDashboardNavbar title="Custom Forms">
        <template #right>
          <UButton
            label="Create Form"
            icon="i-lucide-plus"
            color="primary"
            @click="router.push('/settings/custom-forms/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex items-center gap-4 p-4 border-b border-default">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search forms..."
          class="w-64"
        />
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          placeholder="All Status"
          class="w-40"
        />
      </div>

      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="forms.length === 0"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-file-text" class="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
        <p class="text-lg font-medium mb-2">No custom forms yet</p>
        <p class="text-muted mb-4">
          Create your first custom form to collect data from your team.
        </p>
        <UButton
          label="Create Form"
          icon="i-lucide-plus"
          @click="router.push('/settings/custom-forms/new')"
        />
      </div>

      <!-- Forms list -->
      <div v-else class="divide-y divide-default">
        <div
          v-for="form in forms"
          :key="form.id"
          class="p-4 hover:bg-elevated/50 transition-colors cursor-pointer"
          @click="router.push(`/settings/custom-forms/${form.id}`)"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <h3 class="font-medium text-lg truncate">{{ form.name }}</h3>
                <UBadge :color="getStatusColor(form.status)" variant="subtle" size="sm">
                  {{ form.status }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="sm">
                  v{{ form.version }}
                </UBadge>
              </div>
              <p v-if="form.description" class="text-muted mt-1 truncate">
                {{ form.description }}
              </p>
              <div class="flex items-center gap-4 mt-2 text-sm text-muted">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-layout-list" class="w-4 h-4" />
                  {{ form.fieldCount }} field{{ form.fieldCount !== 1 ? 's' : '' }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="w-4 h-4" />
                  Updated {{ formatDate(form.updatedAt) }}
                </span>
                <span v-if="form.updatedBy" class="flex items-center gap-1">
                  <UIcon name="i-lucide-user" class="w-4 h-4" />
                  {{ form.updatedBy.firstName }} {{ form.updatedBy.lastName }}
                </span>
              </div>
            </div>

            <UDropdownMenu
              :items="[
                [
                  {
                    label: 'Edit',
                    icon: 'i-lucide-pencil',
                    onSelect: () => router.push(`/settings/custom-forms/${form.id}`),
                  },
                  {
                    label: 'View Versions',
                    icon: 'i-lucide-history',
                    onSelect: () => router.push(`/settings/custom-forms/${form.id}/versions`),
                  },
                ],
                [
                  {
                    label: 'Delete',
                    icon: 'i-lucide-trash-2',
                    color: 'error' as const,
                    onSelect: () => deleteForm(form),
                  },
                ],
              ]"
              @click.stop
            >
              <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" />
            </UDropdownMenu>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 p-4 border-t border-default"
      >
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          :disabled="page === 1"
          @click="page--"
        />
        <span class="text-sm text-muted">
          Page {{ page }} of {{ totalPages }}
        </span>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          :disabled="page >= totalPages"
          @click="page++"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
