/**
 * Composable to fetch custom forms assigned to a specific entity
 */
import type { CustomFormField, CustomFormSettings } from '~/types/custom-forms'

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
  const {
    data: response,
    status,
    error,
    refresh,
    // @ts-expect-error - useFetch query typing is overly strict
  } = useFetch<AssignedFormsResponse>('/api/custom-form-assignments/for-entity', {
    query: computed(() => ({
      type: toValue(targetType),
      id: toValue(entityId),
    })),
    lazy: true,
  })

  const assignedForms = computed(() => response.value?.data || [])

  const requiredForms = computed(() =>
    assignedForms.value.filter((form: AssignedForm) => form.isRequired),
  )

  const optionalForms = computed(() =>
    assignedForms.value.filter((form: AssignedForm) => !form.isRequired),
  )

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
