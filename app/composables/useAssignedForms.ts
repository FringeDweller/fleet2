/**
 * Composable to fetch custom forms assigned to a specific entity
 */
export interface AssignedForm {
  id: string
  form: {
    id: string
    name: string
    description: string | null
    status: 'draft' | 'active' | 'archived'
    fields: CustomFormField[]
    settings: CustomFormSettings
  } | null
  isRequired: boolean
  position: number
  categoryFilter: {
    id: string
    name: string
  } | null
}

export interface CustomFormField {
  id: string
  fieldType: string
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  position: number
  options?: Array<{ label: string; value: string; color?: string }>
  validation?: {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    patternMessage?: string
  }
  defaultValue?: unknown
  width?: 'full' | 'half' | 'third'
}

export interface CustomFormSettings {
  allowDraft?: boolean
  requireSignature?: boolean
  allowMultipleSubmissions?: boolean
  notifyOnSubmission?: string[]
  submitButtonText?: string
  successMessage?: string
}

export interface AssignedFormsResponse {
  data: AssignedForm[]
}

export type TargetType = 'asset' | 'work_order' | 'inspection' | 'operator'

/**
 * Fetch assigned forms for a specific entity
 *
 * @param targetType - The type of entity (asset, work_order, inspection, operator)
 * @param entityId - The ID of the entity (optional for inspection/operator, required for asset/work_order)
 */
export function useAssignedForms(
  targetType: MaybeRef<TargetType>,
  entityId?: MaybeRef<string | undefined>,
) {
  const queryParams = computed(() => ({
    type: toValue(targetType),
    id: toValue(entityId),
  }))

  const {
    data: response,
    status,
    error,
    refresh,
  } = useFetch<AssignedFormsResponse>('/api/custom-form-assignments/for-entity', {
    query: queryParams,
    lazy: true,
  })

  const assignedForms = computed(() => response.value?.data || [])

  const requiredForms = computed(() => assignedForms.value.filter((form) => form.isRequired))

  const optionalForms = computed(() => assignedForms.value.filter((form) => !form.isRequired))

  const hasAssignedForms = computed(() => assignedForms.value.length > 0)

  return {
    assignedForms,
    requiredForms,
    optionalForms,
    hasAssignedForms,
    status,
    error,
    refresh,
  }
}
