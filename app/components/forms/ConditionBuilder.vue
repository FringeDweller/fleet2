<script setup lang="ts">
import type { ConditionalLogic, ConditionGroup } from '~/composables/useConditionalLogic'

interface FormField {
  id: string
  fieldType: string
  label: string
  options?: Array<{ label: string; value: string }>
}

const props = defineProps<{
  modelValue: ConditionalLogic | undefined
  fields: FormField[]
  currentFieldId: string
  label: string
  description?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConditionalLogic | undefined]
}>()

// Create default conditional logic structure
function createDefaultLogic(): ConditionalLogic {
  return {
    enabled: true,
    logic: 'and',
    groups: [
      {
        id: crypto.randomUUID(),
        logic: 'and',
        conditions: [],
      },
    ],
  }
}

// Get current value or create default
const conditionalLogic = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Toggle enabled state
function toggleEnabled(enabled: boolean) {
  if (enabled) {
    if (!conditionalLogic.value) {
      conditionalLogic.value = createDefaultLogic()
    } else {
      conditionalLogic.value = {
        ...conditionalLogic.value,
        enabled: true,
      }
    }
  } else {
    if (conditionalLogic.value) {
      conditionalLogic.value = {
        ...conditionalLogic.value,
        enabled: false,
      }
    }
  }
}

// Update top-level logic (AND/OR)
function updateTopLevelLogic(logic: 'and' | 'or') {
  if (!conditionalLogic.value) return
  conditionalLogic.value = {
    ...conditionalLogic.value,
    logic,
  }
}

// Update a group
function updateGroup(index: number, group: ConditionGroup) {
  if (!conditionalLogic.value) return
  const newGroups = [...conditionalLogic.value.groups]
  newGroups[index] = group
  conditionalLogic.value = {
    ...conditionalLogic.value,
    groups: newGroups,
  }
}

// Remove a group
function removeGroup(index: number) {
  if (!conditionalLogic.value) return
  const newGroups = conditionalLogic.value.groups.filter((_, i) => i !== index)
  conditionalLogic.value = {
    ...conditionalLogic.value,
    groups: newGroups,
  }
}

// Add a new group
function addGroup() {
  if (!conditionalLogic.value) {
    conditionalLogic.value = createDefaultLogic()
    return
  }
  conditionalLogic.value = {
    ...conditionalLogic.value,
    groups: [
      ...conditionalLogic.value.groups,
      {
        id: crypto.randomUUID(),
        logic: 'and',
        conditions: [],
      },
    ],
  }
}

// Clear all conditions
function clearConditions() {
  conditionalLogic.value = undefined
}

// Check if there are any conditions
const hasConditions = computed(() => {
  if (!conditionalLogic.value?.enabled) return false
  return conditionalLogic.value.groups.some((g) => g.conditions.length > 0)
})

// Get condition count
const conditionCount = computed(() => {
  if (!conditionalLogic.value?.enabled) return 0
  return conditionalLogic.value.groups.reduce((sum, g) => sum + g.conditions.length, 0)
})
</script>

<template>
  <div class="space-y-3">
    <!-- Header with toggle -->
    <div class="flex items-center justify-between">
      <div>
        <span class="text-sm font-medium">{{ label }}</span>
        <p v-if="description" class="text-xs text-muted mt-0.5">{{ description }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UBadge
          v-if="hasConditions"
          color="info"
          variant="subtle"
          size="xs"
        >
          {{ conditionCount }} condition{{ conditionCount === 1 ? '' : 's' }}
        </UBadge>
        <USwitch
          :model-value="conditionalLogic?.enabled ?? false"
          size="sm"
          @update:model-value="toggleEnabled"
        />
      </div>
    </div>

    <!-- Condition builder (when enabled) -->
    <div v-if="conditionalLogic?.enabled" class="space-y-3">
      <!-- Top-level logic selector (when multiple groups) -->
      <div
        v-if="conditionalLogic.groups.length > 1"
        class="flex items-center gap-2 text-sm"
      >
        <span class="text-muted">Match</span>
        <div class="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          <button
            type="button"
            class="px-2 py-0.5 text-xs rounded transition-colors"
            :class="conditionalLogic.logic === 'and' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'"
            @click="updateTopLevelLogic('and')"
          >
            ALL
          </button>
          <button
            type="button"
            class="px-2 py-0.5 text-xs rounded transition-colors"
            :class="conditionalLogic.logic === 'or' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'"
            @click="updateTopLevelLogic('or')"
          >
            ANY
          </button>
        </div>
        <span class="text-muted">of the following groups:</span>
      </div>

      <!-- Groups -->
      <div class="space-y-3">
        <FormsConditionGroup
          v-for="(group, index) in conditionalLogic.groups"
          :key="group.id"
          :group="group"
          :fields="fields"
          :current-field-id="currentFieldId"
          :group-index="index"
          :can-remove="conditionalLogic.groups.length > 1"
          @update="updateGroup(index, $event)"
          @remove="removeGroup(index)"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <UButton
          label="Add Group"
          icon="i-lucide-plus-circle"
          variant="soft"
          size="xs"
          @click="addGroup"
        />
        <UButton
          v-if="hasConditions"
          label="Clear All"
          icon="i-lucide-trash"
          variant="ghost"
          size="xs"
          color="error"
          @click="clearConditions"
        />
      </div>
    </div>

    <!-- Disabled state hint -->
    <p
      v-else
      class="text-xs text-muted"
    >
      Enable to configure when this field should be {{ label.toLowerCase().includes('required') ? 'required' : 'shown' }}.
    </p>
  </div>
</template>
