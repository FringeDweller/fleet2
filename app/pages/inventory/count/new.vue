<script setup lang="ts">
import { z } from 'zod'

definePageMeta({
  middleware: 'auth',
})

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  notes: z.string().optional(),
  partIds: z.array(z.string()).optional(),
})

type Schema = z.output<typeof schema>

const router = useRouter()
const toast = useToast()

const state = reactive<Schema>({
  name: `Inventory Count ${new Date().toLocaleDateString()}`,
  notes: '',
  partIds: [],
})

const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    const response = await $fetch('/api/inventory/count', {
      method: 'POST',
      body: state,
    })

    toast.add({
      title: 'Count Started',
      description: 'Inventory count session has been started successfully.',
      color: 'success',
    })

    router.push(`/inventory/count/${response.id}`)
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to start inventory count.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="new-inventory-count">
    <template #header>
      <UDashboardNavbar title="Start Inventory Count">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            @click="router.push('/inventory/count')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4 max-w-2xl">
        <UFormField label="Name" name="name" required>
          <UInput v-model="state.name" placeholder="Enter count session name" />
        </UFormField>

        <UFormField label="Notes" name="notes">
          <UTextarea v-model="state.notes" placeholder="Add any notes about this count..." :rows="3" />
        </UFormField>

        <UAlert
          title="Full Inventory Count"
          description="This will create count items for all active parts in your inventory. You can count them in batches."
          color="info"
          icon="i-lucide-info"
        />

        <div class="flex gap-2">
          <UButton
            type="submit"
            label="Start Count"
            icon="i-lucide-clipboard-list"
            color="primary"
            :loading="loading"
          />
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="router.push('/inventory/count')"
            :disabled="loading"
          />
        </div>
      </UForm>
    </template>
  </UDashboardPanel>
</template>
