<script setup lang="ts">
/**
 * Lookup field component for custom forms
 * Fetches data from another entity (assets, users, parts, etc.)
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'lookup'
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
    lookupConfig?: {
      sourceEntity: string
      displayField: string
      valueField: string
      filters?: Record<string, unknown>
    }
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const searchQuery = ref('')
const isLoading = ref(false)
const options = ref<Array<{ label: string; value: string }>>([])

const sourceEntity = computed(() => props.field.lookupConfig?.sourceEntity || 'unknown')

// Debounced search
const debouncedSearch = useDebounceFn(async (query: string) => {
  if (!query || query.length < 2) {
    options.value = []
    return
  }

  isLoading.value = true
  try {
    // Build API endpoint based on source entity
    const endpoint = getLookupEndpoint(sourceEntity.value, query)
    const response = await $fetch<{ data: Array<Record<string, unknown>> }>(endpoint)

    options.value = response.data.map((item) => ({
      label: String(item[props.field.lookupConfig?.displayField || 'name'] || ''),
      value: String(item[props.field.lookupConfig?.valueField || 'id'] || ''),
    }))
  } catch (err) {
    console.error('Lookup search failed:', err)
    options.value = []
  } finally {
    isLoading.value = false
  }
}, 300)

function getLookupEndpoint(entity: string, query: string): string {
  switch (entity) {
    case 'assets':
      return `/api/assets?search=${encodeURIComponent(query)}&limit=10`
    case 'users':
      return `/api/users?search=${encodeURIComponent(query)}&limit=10`
    case 'parts':
      return `/api/parts?search=${encodeURIComponent(query)}&limit=10`
    default:
      return `/api/${entity}?search=${encodeURIComponent(query)}&limit=10`
  }
}

watch(searchQuery, (query) => {
  debouncedSearch(query)
})

const entityIcon = computed(() => {
  switch (sourceEntity.value) {
    case 'assets':
      return 'i-lucide-truck'
    case 'users':
      return 'i-lucide-user'
    case 'parts':
      return 'i-lucide-wrench'
    default:
      return 'i-lucide-search'
  }
})

const selectedLabel = computed(() => {
  if (!props.modelValue) return null
  const option = options.value.find((o) => o.value === props.modelValue)
  return option?.label
})
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <USelect
      :items="options"
      :placeholder="field.placeholder || `Search ${sourceEntity}...`"
      :model-value="modelValue"
      :disabled="disabled"
      :loading="isLoading"
      :leading-icon="entityIcon"
      :color="error ? 'error' : undefined"
      searchable
      @update:search-term="searchQuery = $event"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="searchQuery.length >= 2 && !isLoading && options.length === 0" class="text-xs text-muted mt-1">
      No results found for "{{ searchQuery }}"
    </p>
    <p v-else-if="searchQuery.length > 0 && searchQuery.length < 2" class="text-xs text-muted mt-1">
      Type at least 2 characters to search
    </p>
    <p v-if="selectedLabel && modelValue" class="text-xs text-muted mt-1">
      Selected: {{ selectedLabel }}
    </p>
  </UFormField>
</template>
