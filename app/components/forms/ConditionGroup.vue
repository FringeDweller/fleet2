<script setup lang="ts">
import type { ConditionGroup, FieldCondition } from '~/composables/useConditionalLogic'

interface FormField {
  id: string
  fieldType: string
  label: string
  options?: Array<{ label: string; value: string }>
}

const props = defineProps<{
  group: ConditionGroup
  fields: FormField[]
  currentFieldId: string
  groupIndex: number
  canRemove: boolean
}>()

const emit = defineEmits<{
  update: [group: ConditionGroup]
  remove: []
}>()

// Update the logic type (AND/OR)
function updateLogic(logic: 'and' | 'or') {
  emit('update', {
    ...props.group,
    logic,
  })
}

// Update a condition
function updateCondition(index: number, condition: FieldCondition) {
  const newConditions = [...props.group.conditions]
  newConditions[index] = condition
  emit('update', {
    ...props.group,
    conditions: newConditions,
  })
}

// Remove a condition
function removeCondition(index: number) {
  const newConditions = props.group.conditions.filter((_, i) => i !== index)
  emit('update', {
    ...props.group,
    conditions: newConditions,
  })
}

// Add a new condition
function addCondition() {
  emit('update', {
    ...props.group,
    conditions: [
      ...props.group.conditions,
      {
        id: crypto.randomUUID(),
        fieldId: '',
        operator: 'equals',
        value: undefined,
      },
    ],
  })
}
</script>

<template>
  <div class="border border-default rounded-lg p-3">
    <!-- Group header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted">Group {{ groupIndex + 1 }}</span>
        <div class="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          <button
            type="button"
            class="px-2 py-0.5 text-xs rounded transition-colors"
            :class="group.logic === 'and' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'"
            @click="updateLogic('and')"
          >
            AND
          </button>
          <button
            type="button"
            class="px-2 py-0.5 text-xs rounded transition-colors"
            :class="group.logic === 'or' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'"
            @click="updateLogic('or')"
          >
            OR
          </button>
        </div>
      </div>

      <UButton
        v-if="canRemove"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="xs"
        @click="emit('remove')"
      />
    </div>

    <!-- Conditions -->
    <div class="space-y-2">
      <FormsConditionRow
        v-for="(condition, index) in group.conditions"
        :key="condition.id"
        :condition="condition"
        :fields="fields"
        :current-field-id="currentFieldId"
        @update="updateCondition(index, $event)"
        @remove="removeCondition(index)"
      />

      <!-- Empty state -->
      <div
        v-if="group.conditions.length === 0"
        class="text-center py-4 text-muted text-sm"
      >
        No conditions. Add one below.
      </div>
    </div>

    <!-- Add condition button -->
    <div class="mt-3">
      <UButton
        label="Add Condition"
        icon="i-lucide-plus"
        variant="soft"
        size="xs"
        @click="addCondition"
      />
    </div>
  </div>
</template>
