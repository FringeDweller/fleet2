<script setup lang="ts">
/**
 * Section header field component for custom forms
 * Used to group related fields together
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'section'
    label: string
    helpText?: string
    collapsible?: boolean
    defaultCollapsed?: boolean
  }
  isFirst?: boolean
}>()

const isCollapsed = ref(props.field.defaultCollapsed ?? false)

function toggleCollapse() {
  if (props.field.collapsible) {
    isCollapsed.value = !isCollapsed.value
  }
}

defineExpose({
  isCollapsed,
})
</script>

<template>
  <div
    :class="[
      'border-b border-default pb-2',
      !isFirst && 'mt-6 pt-4',
    ]"
  >
    <button
      v-if="field.collapsible"
      type="button"
      class="w-full flex items-center justify-between text-left group"
      @click="toggleCollapse"
    >
      <div>
        <h4 class="text-sm font-semibold uppercase tracking-wide text-muted group-hover:text-foreground transition-colors">
          {{ field.label }}
        </h4>
        <p v-if="field.helpText" class="text-xs text-muted mt-0.5">
          {{ field.helpText }}
        </p>
      </div>
      <UIcon
        :name="isCollapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
        class="w-4 h-4 text-muted group-hover:text-foreground transition-colors"
      />
    </button>
    <div v-else>
      <h4 class="text-sm font-semibold uppercase tracking-wide text-muted">
        {{ field.label }}
      </h4>
      <p v-if="field.helpText" class="text-xs text-muted mt-0.5">
        {{ field.helpText }}
      </p>
    </div>
  </div>
</template>
