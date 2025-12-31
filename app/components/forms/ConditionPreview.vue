<script setup lang="ts">
import type { ConditionalLogic } from '~/composables/useConditionalLogic'
import { getOperatorLabel } from '~/composables/useConditionalLogic'

interface FormField {
  id: string
  fieldType: string
  label: string
  options?: Array<{ label: string; value: string }>
}

const props = defineProps<{
  conditionalLogic: ConditionalLogic | undefined
  fields: FormField[]
  type: 'visibility' | 'required'
}>()

// Get field label by ID
function getFieldLabel(fieldId: string): string {
  const field = props.fields.find((f) => f.id === fieldId)
  return field?.label ?? 'Unknown Field'
}

// Format value for display
function formatValue(value: unknown, fieldId: string): string {
  if (value === undefined || value === null) return '(no value)'
  if (typeof value === 'boolean') return value ? 'Checked' : 'Not Checked'

  const field = props.fields.find((f) => f.id === fieldId)
  if (field?.options) {
    const option = field.options.find((o) => o.value === value)
    if (option) return option.label
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

// Get readable logic text
const logicText = computed(() => {
  if (!props.conditionalLogic?.enabled) return ''

  if (props.conditionalLogic.groups.length <= 1) {
    return ''
  }

  return props.conditionalLogic.logic === 'and' ? 'ALL' : 'ANY'
})
</script>

<template>
  <div
    v-if="conditionalLogic?.enabled && conditionalLogic.groups.length > 0"
    class="bg-info/10 border border-info/20 rounded-lg p-3"
  >
    <div class="flex items-start gap-2">
      <UIcon
        :name="type === 'visibility' ? 'i-lucide-eye' : 'i-lucide-asterisk'"
        class="w-4 h-4 text-info shrink-0 mt-0.5"
      />
      <div class="text-sm">
        <span class="font-medium text-info">
          {{ type === 'visibility' ? 'Shown' : 'Required' }} when:
        </span>

        <div class="mt-2 space-y-2">
          <!-- Show logic connector for multiple groups -->
          <template v-for="(group, groupIndex) in conditionalLogic.groups" :key="group.id">
            <div
              v-if="groupIndex > 0"
              class="text-xs font-medium text-info uppercase px-2"
            >
              {{ logicText }}
            </div>

            <div class="pl-2 border-l-2 border-info/30">
              <template v-for="(condition, condIndex) in group.conditions" :key="condition.id">
                <div
                  v-if="condIndex > 0"
                  class="text-xs text-muted my-1"
                >
                  {{ group.logic === 'and' ? 'AND' : 'OR' }}
                </div>
                <div class="text-muted">
                  <span class="font-medium text-foreground">{{ getFieldLabel(condition.fieldId) }}</span>
                  {{ ' ' }}
                  <span class="italic">{{ getOperatorLabel(condition.operator) }}</span>
                  <template v-if="!['is_empty', 'is_not_empty'].includes(condition.operator)">
                    {{ ' ' }}
                    <span class="font-medium text-foreground">"{{ formatValue(condition.value, condition.fieldId) }}"</span>
                  </template>
                </div>
              </template>

              <div
                v-if="group.conditions.length === 0"
                class="text-xs text-muted italic"
              >
                (no conditions in this group)
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
