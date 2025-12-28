<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

interface CustomFormVersion {
  id: string
  formId: string
  version: number
  name: string
  description: string | null
  fields: Array<{
    id: string
    fieldType: string
    label: string
    required: boolean
  }>
  settings: Record<string, unknown>
  changelog: string | null
  publishedAt: string
  fieldCount: number
  submissionCount?: number
  publishedBy?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface VersionsResponse {
  data: CustomFormVersion[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

interface CustomForm {
  id: string
  name: string
  version: number
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const formId = route.params.id as string

// Fetch form info
const { data: form } = await useFetch<CustomForm>(`/api/custom-forms/${formId}`, {
  lazy: true,
})

// Fetch versions
const {
  data: versionsData,
  status,
  refresh,
} = await useFetch<VersionsResponse>(`/api/custom-forms/${formId}/versions`, {
  lazy: true,
})

const versions = computed(() => versionsData.value?.data || [])

// State
const rollbackModalOpen = ref(false)
const selectedVersion = ref<CustomFormVersion | null>(null)
const isRollingBack = ref(false)
const rollbackChangelog = ref('')
const viewVersionModalOpen = ref(false)

function viewVersion(version: CustomFormVersion) {
  selectedVersion.value = version
  viewVersionModalOpen.value = true
}

function startRollback(version: CustomFormVersion) {
  selectedVersion.value = version
  rollbackChangelog.value = ''
  rollbackModalOpen.value = true
}

async function confirmRollback() {
  if (!selectedVersion.value) return

  isRollingBack.value = true
  try {
    await $fetch(`/api/custom-forms/${formId}/rollback`, {
      method: 'POST',
      body: {
        targetVersion: selectedVersion.value.version,
        changelog: rollbackChangelog.value || undefined,
      },
    })
    toast.add({
      title: 'Rollback successful',
      description: `Form has been rolled back to version ${selectedVersion.value.version}.`,
    })
    rollbackModalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || 'Failed to rollback.',
      color: 'error',
    })
  } finally {
    isRollingBack.value = false
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isCurrentVersion(version: CustomFormVersion) {
  return version.version === form.value?.version
}
</script>

<template>
  <UDashboardPanel id="custom-form-versions">
    <template #header>
      <UDashboardNavbar :title="`Version History: ${form?.name || 'Form'}`">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push(`/settings/custom-forms/${formId}`)"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="versions.length === 0"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-history" class="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
        <p class="text-lg font-medium mb-2">No versions yet</p>
        <p class="text-muted mb-4">
          Publish your form to create the first version.
        </p>
        <UButton
          label="Edit Form"
          icon="i-lucide-pencil"
          @click="router.push(`/settings/custom-forms/${formId}`)"
        />
      </div>

      <!-- Versions timeline -->
      <div v-else class="max-w-3xl mx-auto p-6">
        <div class="relative">
          <!-- Timeline line -->
          <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-default" />

          <div class="space-y-6">
            <div
              v-for="version in versions"
              :key="version.id"
              class="relative flex gap-4"
            >
              <!-- Timeline node -->
              <div
                class="relative z-10 w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                :class="[
                  isCurrentVersion(version)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                ]"
              >
                <span class="font-bold">v{{ version.version }}</span>
              </div>

              <!-- Version card -->
              <div class="flex-1 pb-6">
                <UPageCard
                  variant="subtle"
                  :class="{ 'ring-2 ring-primary': isCurrentVersion(version) }"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-medium">Version {{ version.version }}</h3>
                        <UBadge
                          v-if="isCurrentVersion(version)"
                          color="primary"
                          variant="subtle"
                          size="sm"
                        >
                          Current
                        </UBadge>
                      </div>

                      <div class="flex items-center gap-4 mt-2 text-sm text-muted">
                        <span class="flex items-center gap-1">
                          <UIcon name="i-lucide-calendar" class="w-4 h-4" />
                          {{ formatDate(version.publishedAt) }}
                        </span>
                        <span
                          v-if="version.publishedBy"
                          class="flex items-center gap-1"
                        >
                          <UIcon name="i-lucide-user" class="w-4 h-4" />
                          {{ version.publishedBy.firstName }} {{ version.publishedBy.lastName }}
                        </span>
                        <span class="flex items-center gap-1">
                          <UIcon name="i-lucide-layout-list" class="w-4 h-4" />
                          {{ version.fieldCount }} fields
                        </span>
                        <span
                          v-if="version.submissionCount !== undefined"
                          class="flex items-center gap-1"
                        >
                          <UIcon name="i-lucide-file-text" class="w-4 h-4" />
                          {{ version.submissionCount }} submissions
                        </span>
                      </div>

                      <p
                        v-if="version.changelog"
                        class="mt-3 text-sm bg-muted/50 rounded-md p-3"
                      >
                        {{ version.changelog }}
                      </p>
                    </div>

                    <div class="flex items-center gap-1">
                      <UButton
                        icon="i-lucide-eye"
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        title="View version details"
                        @click="viewVersion(version)"
                      />
                      <UButton
                        v-if="!isCurrentVersion(version)"
                        icon="i-lucide-undo-2"
                        size="sm"
                        color="warning"
                        variant="ghost"
                        title="Rollback to this version"
                        @click="startRollback(version)"
                      />
                    </div>
                  </div>
                </UPageCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- View Version Modal -->
    <UModal v-model:open="viewVersionModalOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard v-if="selectedVersion">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Version {{ selectedVersion.version }} Details</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="viewVersionModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <span class="text-sm text-muted">Form Name:</span>
              <p class="font-medium">{{ selectedVersion.name }}</p>
            </div>

            <div v-if="selectedVersion.description">
              <span class="text-sm text-muted">Description:</span>
              <p>{{ selectedVersion.description }}</p>
            </div>

            <div v-if="selectedVersion.changelog">
              <span class="text-sm text-muted">Changelog:</span>
              <p class="bg-muted/50 rounded-md p-3 mt-1">{{ selectedVersion.changelog }}</p>
            </div>

            <USeparator />

            <div>
              <span class="text-sm text-muted mb-2 block">Fields ({{ selectedVersion.fields.length }}):</span>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <div
                  v-for="field in selectedVersion.fields"
                  :key="field.id"
                  class="flex items-center gap-2 p-2 bg-muted/30 rounded-md"
                >
                  <UBadge color="neutral" variant="subtle" size="xs">
                    {{ field.fieldType }}
                  </UBadge>
                  <span>{{ field.label }}</span>
                  <span v-if="field.required" class="text-error text-sm">*</span>
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-between">
              <UButton
                v-if="!isCurrentVersion(selectedVersion)"
                label="Rollback to this version"
                icon="i-lucide-undo-2"
                color="warning"
                variant="soft"
                @click="viewVersionModalOpen = false; startRollback(selectedVersion)"
              />
              <div class="flex-1" />
              <UButton label="Close" variant="ghost" @click="viewVersionModalOpen = false" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Rollback Modal -->
    <UModal v-model:open="rollbackModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">Rollback Form</h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="rollbackModalOpen = false"
              />
            </div>
          </template>

          <div v-if="selectedVersion" class="space-y-4">
            <div class="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div class="flex items-start gap-2">
                <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div class="text-sm">
                  <p class="font-medium">
                    This will create a new version based on version {{ selectedVersion.version }}.
                  </p>
                  <p class="text-muted mt-1">
                    The current form fields and settings will be replaced with those from version {{ selectedVersion.version }}.
                    All existing submissions will remain linked to their original versions.
                  </p>
                </div>
              </div>
            </div>

            <UFormField label="Changelog (optional)">
              <UTextarea
                v-model="rollbackChangelog"
                :placeholder="`Rolled back to version ${selectedVersion.version}`"
                :rows="2"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="rollbackModalOpen = false" />
              <UButton
                label="Confirm Rollback"
                icon="i-lucide-undo-2"
                color="warning"
                :loading="isRollingBack"
                @click="confirmRollback"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
