<script setup lang="ts">
import { format, parseISO } from 'date-fns'

interface InventoryPart {
  id: string
  name: string
  sku: string
  unit: string
  quantityInStock: string
  unitCost: string | null
  isActive: boolean
}

interface Availability {
  inStock: boolean
  available: number
  needed: number
  unit: string
}

interface Part {
  id: string
  partId: string | null
  partName: string
  partNumber: string | null
  quantity: number
  unitCost: string | null
  totalCost: string | null
  notes: string | null
  createdAt: string
  addedBy?: { id: string; firstName: string; lastName: string }
  part?: InventoryPart | null
  availability?: Availability | null
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
const inventoryParts = ref<InventoryPart[]>([])
const searchQuery = ref('')
const selectedInventoryPart = ref<InventoryPart | null>(null)
const useCustomPart = ref(false)

const newPart = ref({
  partName: '',
  partNumber: '',
  quantity: 1,
  unitCost: null as number | null,
  notes: '',
})

// Fetch inventory parts for search
async function searchInventoryParts() {
  try {
    const data = await $fetch<{ parts: InventoryPart[] }>('/api/parts', {
      query: {
        search: searchQuery.value || undefined,
        limit: 20,
      },
    })
    inventoryParts.value = data.parts || []
  } catch {
    inventoryParts.value = []
  }
}

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(searchInventoryParts, 300)
})

// Load initial parts on modal open
watch(addModalOpen, async (open) => {
  if (open) {
    await searchInventoryParts()
  } else {
    resetForm()
  }
})

function selectInventoryPart(part: InventoryPart) {
  selectedInventoryPart.value = part
  newPart.value.partName = part.name
  newPart.value.partNumber = part.sku
  newPart.value.unitCost = part.unitCost ? parseFloat(part.unitCost) : null
  useCustomPart.value = false
}

function clearSelectedPart() {
  selectedInventoryPart.value = null
  newPart.value.partName = ''
  newPart.value.partNumber = ''
  newPart.value.unitCost = null
}

function switchToCustomPart() {
  useCustomPart.value = true
  selectedInventoryPart.value = null
}

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
    notes: '',
  }
  selectedInventoryPart.value = null
  useCustomPart.value = false
  searchQuery.value = ''
}

async function addPart() {
  // Require either selected inventory part or custom part name
  if (!selectedInventoryPart.value && !newPart.value.partName.trim()) return

  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/parts`, {
      method: 'POST',
      body: {
        partId: selectedInventoryPart.value?.id || null,
        partName: newPart.value.partName.trim() || undefined,
        partNumber: newPart.value.partNumber.trim() || null,
        quantity: newPart.value.quantity,
        unitCost: newPart.value.unitCost,
        notes: newPart.value.notes.trim() || null,
      },
    })

    const stockWarning =
      selectedInventoryPart.value &&
      parseFloat(selectedInventoryPart.value.quantityInStock) < newPart.value.quantity

    toast.add({
      title: 'Part added',
      description: stockWarning
        ? 'Part added. Warning: Insufficient stock in inventory.'
        : 'Part has been added to the work order.',
      color: stockWarning ? 'warning' : undefined,
    })
    resetForm()
    addModalOpen.value = false
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to add part.',
      color: 'error',
    })
  }
}

async function deletePart(part: Part) {
  loading.value[part.id] = true
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/parts/${part.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Part removed',
      description: 'Part has been removed from the work order.',
    })
    emit('refresh')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to remove part.',
      color: 'error',
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
            <div class="flex items-center gap-2 flex-wrap">
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
              <UBadge
                v-if="part.partId"
                color="primary"
                variant="subtle"
                size="xs"
              >
                <UIcon name="i-lucide-link" class="w-3 h-3 mr-1" />
                Inventory
              </UBadge>
              <UBadge
                v-if="part.notes?.includes('From template') || part.notes?.includes('From schedule')"
                color="info"
                variant="subtle"
                size="xs"
              >
                <UIcon name="i-lucide-file-text" class="w-3 h-3 mr-1" />
                Template
              </UBadge>
            </div>
            <!-- Stock availability indicator -->
            <div v-if="part.availability" class="flex items-center gap-2 mt-1">
              <UBadge
                v-if="part.availability.inStock"
                color="success"
                variant="subtle"
                size="xs"
              >
                <UIcon name="i-lucide-check-circle" class="w-3 h-3 mr-1" />
                In Stock ({{ part.availability.available }} {{ part.availability.unit }})
              </UBadge>
              <UBadge
                v-else
                color="warning"
                variant="subtle"
                size="xs"
              >
                <UIcon name="i-lucide-alert-triangle" class="w-3 h-3 mr-1" />
                Low Stock ({{ part.availability.available }}/{{ part.availability.needed }} {{ part.availability.unit }})
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
                <span v-if="part.part?.unit" class="text-xs text-muted font-normal">{{ part.part.unit }}</span>
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
        <UCard class="min-w-[400px]">
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
            <!-- Inventory Search Section -->
            <div v-if="!useCustomPart && !selectedInventoryPart" class="space-y-3">
              <UFormField label="Search Inventory">
                <UInput
                  v-model="searchQuery"
                  placeholder="Search parts by name or SKU..."
                  autofocus
                >
                  <template #leading>
                    <UIcon name="i-lucide-search" class="text-muted" />
                  </template>
                </UInput>
              </UFormField>

              <div v-if="inventoryParts.length > 0" class="max-h-48 overflow-y-auto border border-default rounded-lg divide-y divide-default">
                <button
                  v-for="ip in inventoryParts"
                  :key="ip.id"
                  type="button"
                  class="w-full p-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                  @click="selectInventoryPart(ip)"
                >
                  <div>
                    <p class="font-medium">{{ ip.name }}</p>
                    <p class="text-xs text-muted">
                      SKU: {{ ip.sku }} • {{ ip.quantityInStock }} {{ ip.unit }} in stock
                      <span v-if="ip.unitCost"> • ${{ ip.unitCost }}/{{ ip.unit }}</span>
                    </p>
                  </div>
                  <UIcon name="i-lucide-plus" class="text-muted" />
                </button>
              </div>

              <div v-else-if="searchQuery" class="text-center py-4 text-muted">
                <p>No parts found matching "{{ searchQuery }}"</p>
              </div>

              <div class="text-center">
                <UButton
                  variant="link"
                  size="sm"
                  label="Or add a custom part"
                  @click="switchToCustomPart"
                />
              </div>
            </div>

            <!-- Selected Inventory Part -->
            <div v-else-if="selectedInventoryPart" class="space-y-4">
              <div class="p-3 bg-muted rounded-lg">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-medium">{{ selectedInventoryPart.name }}</p>
                    <p class="text-xs text-muted">
                      SKU: {{ selectedInventoryPart.sku }} •
                      {{ selectedInventoryPart.quantityInStock }} {{ selectedInventoryPart.unit }} in stock
                    </p>
                  </div>
                  <UButton
                    icon="i-lucide-x"
                    variant="ghost"
                    size="xs"
                    @click="clearSelectedPart"
                  />
                </div>
              </div>

              <!-- Stock warning -->
              <UAlert
                v-if="parseFloat(selectedInventoryPart.quantityInStock) < newPart.quantity"
                color="warning"
                icon="i-lucide-alert-triangle"
                title="Low Stock"
                :description="`Only ${selectedInventoryPart.quantityInStock} ${selectedInventoryPart.unit} available in inventory.`"
              />

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
            </div>

            <!-- Custom Part Form -->
            <div v-else class="space-y-4">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium">Custom Part</p>
                <UButton
                  variant="link"
                  size="xs"
                  label="Search inventory instead"
                  @click="useCustomPart = false"
                />
              </div>

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
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-default">
              <UButton label="Cancel" variant="ghost" @click="addModalOpen = false" />
              <UButton
                type="submit"
                label="Add Part"
                :disabled="!selectedInventoryPart && !newPart.partName.trim()"
              />
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </UCard>
</template>
