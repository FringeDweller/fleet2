<script setup lang="ts">
import type { AssignedForm, TargetType } from '~/composables/useAssignedForms'

const props = defineProps<{
  targetType: TargetType
  entityId?: string
}>()

const { assignedForms, hasAssignedForms, status } = useAssignedForms(
  toRef(() => props.targetType),
  toRef(() => props.entityId),
)

// Track expanded forms
const expandedForms = ref<Set<string>>(new Set())

function toggleForm(formId: string) {
  if (expandedForms.value.has(formId)) {
    expandedForms.value.delete(formId)
  } else {
    expandedForms.value.add(formId)
  }
}

function isExpanded(formId: string): boolean {
  return expandedForms.value.has(formId)
}

// Get field type icon
function getFieldTypeIcon(fieldType: string): string {
  const icons: Record<string, string> = {
    text: 'i-lucide-type',
    number: 'i-lucide-hash',
    date: 'i-lucide-calendar',
    time: 'i-lucide-clock',
    datetime: 'i-lucide-calendar-clock',
    dropdown: 'i-lucide-chevron-down-square',
    multi_select: 'i-lucide-list-checks',
    checkbox: 'i-lucide-check-square',
    radio: 'i-lucide-circle-dot',
    file: 'i-lucide-file',
    photo: 'i-lucide-camera',
    signature: 'i-lucide-pen-tool',
    location: 'i-lucide-map-pin',
    barcode: 'i-lucide-barcode',
    calculated: 'i-lucide-calculator',
    lookup: 'i-lucide-search',
    section: 'i-lucide-layout-list',
    textarea: 'i-lucide-align-left',
    email: 'i-lucide-mail',
    phone: 'i-lucide-phone',
    url: 'i-lucide-link',
  }
  return icons[fieldType] || 'i-lucide-form-input'
}

// Format field type for display
function formatFieldType(fieldType: string): string {
  return fieldType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
</script>

<template>
  <div v-if="status === 'pending'" class="flex items-center justify-center py-8">
    <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
  </div>

  <UCard v-else-if="hasAssignedForms">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-file-text" class="w-5 h-5 text-muted" />
          <h3 class="font-medium">Custom Forms</h3>
        </div>
        <UBadge color="neutral" variant="subtle" size="xs">
          {{ assignedForms.length }} form{{ assignedForms.length === 1 ? '' : 's' }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-3">
      <div
        v-for="assignment in assignedForms"
        :key="assignment.id"
        class="border border-default rounded-lg overflow-hidden"
      >
        <!-- Form header -->
        <button
          type="button"
          class="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
          @click="assignment.form && toggleForm(assignment.form.id)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              :name="isExpanded(assignment.form?.id || '') ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="w-4 h-4 text-muted"
            />
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ assignment.form?.name || 'Unknown Form' }}</span>
                <UBadge
                  v-if="assignment.isRequired"
                  color="error"
                  variant="subtle"
                  size="xs"
                >
                  Required
                </UBadge>
                <UBadge
                  v-if="assignment.form?.status === 'draft'"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >
                  Draft
                </UBadge>
              </div>
              <p v-if="assignment.form?.description" class="text-sm text-muted mt-0.5">
                {{ assignment.form.description }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">
              {{ assignment.form?.fields?.length || 0 }} field{{ (assignment.form?.fields?.length || 0) === 1 ? '' : 's' }}
            </span>
          </div>
        </button>

        <!-- Form fields preview (expanded) -->
        <div
          v-if="assignment.form && isExpanded(assignment.form.id)"
          class="border-t border-default bg-muted/30 p-3"
        >
          <p class="text-xs text-muted uppercase tracking-wide mb-3">Form Fields</p>
          <div class="space-y-2">
            <div
              v-for="field in assignment.form.fields"
              :key="field.id"
              class="flex items-start gap-2 text-sm"
            >
              <UIcon
                :name="getFieldTypeIcon(field.fieldType)"
                class="w-4 h-4 text-muted mt-0.5"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span>{{ field.label }}</span>
                  <UBadge
                    v-if="field.required"
                    color="error"
                    variant="subtle"
                    size="xs"
                  >
                    Required
                  </UBadge>
                </div>
                <p class="text-xs text-muted">
                  {{ formatFieldType(field.fieldType) }}
                  <span v-if="field.helpText"> - {{ field.helpText }}</span>
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-default">
            <UButton
              label="Fill Out Form"
              icon="i-lucide-edit"
              color="primary"
              size="sm"
              disabled
            >
              <template #trailing>
                <UBadge color="neutral" variant="subtle" size="xs">Coming Soon</UBadge>
              </template>
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
