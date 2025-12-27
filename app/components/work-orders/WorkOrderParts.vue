<script setup lang="ts">
import { format, parseISO } from 'date-fns'

interface Part {
  id: string
  partName: string
  partNumber: string | null
  quantity: number
  unitCost: string | null
  totalCost: string | null
  notes: string | null
  createdAt: string
  addedBy?: { id: string, firstName: string, lastName: string }
}

const props = defineProps<{
  workOrderId: string
  parts: Part[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const addModalOpen = ref(false)
const loading = ref<Record<string, boolean>>({})

const newPart = ref({
  partName: '',
  partNumber: '',
  quantity: 1,
  unitCost: null as number | null,
  notes: ''
})

const totalCost = computed(() => {
  if (!props.parts.length) return null
  const total = props.parts.reduce((sum, p) => {
    return sum + (p.totalCost ? parseFloat(p.totalCost) : 0)
  }, 0)
  return total.toFixed(2)
})

function resetForm() {
  newPart.value = {
    partName: '',
    partNumber: '',
    quantity: 1,
    unitCost: null,
    notes: ''
  }
}

async function addPart() {
  if (!newPart.value.partName.trim()) return
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/parts`, {
      method: 'POST',
      body: {
        partName: newPart.value.partName.trim(),
        partNumber: newPart.value.partNumber.trim() || null,
        quantity: newPart.value.quantity,
        unitCost: newPart.value.unitCost,
        notes: newPart.value.notes.trim() || null
      }
    })
    toast.add({
      title: 'Part added',
      description: 'Part has been added to the work order.'
    })
    resetForm()
    addModalOpen.value = false
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to add part.',
      color: 'error'
    })
  }
}

async function deletePart(part: Part) {
  loading.value[part.id] = true
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/parts/${part.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Part removed',
      description: 'Part has been removed from the work order.'
    })
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to remove part.',
      color: 'error'
    })
  } finally {
    loading.value[part.id] = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-medium">
          Parts Used
        </h3>
        <div class="flex items-center gap-3">
          <span v-if="totalCost" class="text-sm font-medium"> Total: ${{ totalCost }} </span>
          <UButton
            v-if="!readonly"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            label="Add Part"
            @click="addModalOpen = true"
          />
        </div>
      </div>
    </template>

    <div v-if="parts.length === 0" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-wrench" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No parts recorded</p>
      <UButton
        v-if="!readonly"
        label="Add first part"
        variant="link"
        class="mt-2"
        @click="addModalOpen = true"
      />
    </div>

    <div v-else class="divide-y divide-default">
      <div v-for="part in parts" :key="part.id" class="py-3 first:pt-0 last:pb-0 group">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium truncate">
                {{ part.partName }}
              </p>
              <UBadge
                v-if="part.partNumber"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ part.partNumber }}
              </UBadge>
            </div>
            <p v-if="part.notes" class="text-sm text-muted mt-1">
              {{ part.notes }}
            </p>
            <p v-if="part.addedBy" class="text-xs text-muted mt-2">
              Added by {{ part.addedBy.firstName }} {{ part.addedBy.lastName }} on
              {{ format(parseISO(part.createdAt), 'PP') }}
            </p>
          </div>
          <div class="flex items-start gap-3">
            <div class="text-right">
              <p class="font-medium">
                x{{ part.quantity }}
              </p>
              <p v-if="part.unitCost" class="text-xs text-muted">
                @ ${{ part.unitCost }}/ea
              </p>
              <p v-if="part.totalCost" class="text-sm font-medium text-success">
                ${{ part.totalCost }}
              </p>
            </div>
            <UButton
              v-if="!readonly"
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              :loading="loading[part.id]"
              @click="deletePart(part)"
            />
          </div>
        </div>
      </div>
    </div>

    <UModal v-model:open="addModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-medium">
                Add Part
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                @click="addModalOpen = false"
              />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="addPart">
            <UFormField label="Part Name" required>
              <UInput v-model="newPart.partName" placeholder="e.g., Oil Filter" autofocus />
            </UFormField>

            <UFormField label="Part Number">
              <UInput v-model="newPart.partNumber" placeholder="e.g., OIL-1234" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Quantity" required>
                <UInput v-model.number="newPart.quantity" type="number" :min="1" />
              </UFormField>

              <UFormField label="Unit Cost">
                <UInput
                  v-model.number="newPart.unitCost"
                  type="number"
                  step="0.01"
                  :min="0"
                  placeholder="0.00"
                />
              </UFormField>
            </div>

            <UFormField label="Notes">
              <UTextarea
                v-model="newPart.notes"
                placeholder="Optional notes about this part"
                :rows="2"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="addModalOpen = false" />
              <UButton type="submit" label="Add Part" :disabled="!newPart.partName.trim()" />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </UCard>
</template>
