/**
 * Composable for handling custom form state, validation, auto-save, and submission
 * Supports offline mode with localStorage draft saving
 */
import type { CustomFormField, CustomFormSettings } from '~/types/custom-forms'
import { isFieldRequired, isFieldVisible } from './useConditionalLogic'

// Re-export types for backwards compatibility
export type { CustomFormField, CustomFormSettings }

// Alias for backwards compatibility
export type CustomFormFieldForForm = CustomFormField

export interface FormSubmissionResult {
  success: boolean
  submissionId?: string
  error?: string
}

export interface FormDraft {
  formId: string
  versionId: string
  contextType?: string
  contextId?: string
  responses: Record<string, unknown>
  savedAt: string
}

const DRAFT_KEY_PREFIX = 'fleet-form-draft-'
const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

/**
 * Main composable for custom form handling
 */
export function useCustomForm(
  formId: MaybeRef<string>,
  options?: {
    versionId?: MaybeRef<string | undefined>
    contextType?: MaybeRef<string | undefined>
    contextId?: MaybeRef<string | undefined>
    fields?: MaybeRef<CustomFormFieldForForm[]>
    settings?: MaybeRef<CustomFormSettings>
    initialValues?: MaybeRef<Record<string, unknown>>
  },
) {
  const toast = useToast()
  const isOnline = useOnline()

  // Refs
  const formIdRef = toRef(formId)
  const versionIdRef = toRef(options?.versionId)
  const contextTypeRef = toRef(options?.contextType)
  const contextIdRef = toRef(options?.contextId)
  const fieldsRef = computed<CustomFormField[]>(() => {
    const fields = options?.fields
    return unref(fields) ?? []
  })
  const settingsRef = computed<CustomFormSettings>(() => {
    const settings = options?.settings
    return unref(settings) ?? {}
  })
  const initialValuesRef = computed<Record<string, unknown>>(() => {
    const values = options?.initialValues
    return unref(values) ?? {}
  })

  // State
  const formValues = ref<Record<string, unknown>>({})
  const errors = ref<Record<string, string>>({})
  const isSubmitting = ref(false)
  const isDirty = ref(false)
  const lastSavedAt = ref<Date | null>(null)
  const autoSaveTimer = ref<ReturnType<typeof setInterval> | null>(null)

  // Draft key for localStorage
  const draftKey = computed(() => {
    const parts = [DRAFT_KEY_PREFIX, formIdRef.value]
    if (contextTypeRef.value && contextIdRef.value) {
      parts.push(contextTypeRef.value, contextIdRef.value)
    }
    return parts.join('-')
  })

  // Initialize form values
  function initializeForm() {
    const values: Record<string, unknown> = {}

    // Apply default values from field definitions
    for (const field of fieldsRef.value) {
      if (field.defaultValue !== undefined) {
        values[field.id] = field.defaultValue
      }
    }

    // Apply initial values (overrides defaults)
    Object.assign(values, initialValuesRef.value)

    formValues.value = values
    isDirty.value = false
  }

  // Load draft from localStorage
  function loadDraft(): boolean {
    if (!import.meta.client) return false

    try {
      const stored = localStorage.getItem(draftKey.value)
      if (!stored) return false

      const draft: FormDraft = JSON.parse(stored)

      // Check if draft is for the same form version
      if (versionIdRef.value && draft.versionId !== versionIdRef.value) {
        return false
      }

      formValues.value = draft.responses
      lastSavedAt.value = new Date(draft.savedAt)
      isDirty.value = true

      return true
    } catch (err) {
      console.error('Failed to load draft:', err)
      return false
    }
  }

  // Save draft to localStorage
  function saveDraft() {
    if (!import.meta.client) return

    try {
      const draft: FormDraft = {
        formId: formIdRef.value,
        versionId: versionIdRef.value || '',
        contextType: contextTypeRef.value,
        contextId: contextIdRef.value,
        responses: formValues.value,
        savedAt: new Date().toISOString(),
      }

      localStorage.setItem(draftKey.value, JSON.stringify(draft))
      lastSavedAt.value = new Date()
    } catch (err) {
      console.error('Failed to save draft:', err)
    }
  }

  // Clear draft from localStorage
  function clearDraft() {
    if (!import.meta.client) return

    try {
      localStorage.removeItem(draftKey.value)
      lastSavedAt.value = null
    } catch (err) {
      console.error('Failed to clear draft:', err)
    }
  }

  // Start auto-save timer
  function startAutoSave() {
    if (!import.meta.client) return

    stopAutoSave()

    autoSaveTimer.value = setInterval(() => {
      if (isDirty.value) {
        saveDraft()
      }
    }, AUTO_SAVE_INTERVAL)
  }

  // Stop auto-save timer
  function stopAutoSave() {
    if (autoSaveTimer.value) {
      clearInterval(autoSaveTimer.value)
      autoSaveTimer.value = null
    }
  }

  // Update a field value
  function updateFieldValue(fieldId: string, value: unknown) {
    formValues.value = {
      ...formValues.value,
      [fieldId]: value,
    }
    isDirty.value = true

    // Clear error for this field
    if (errors.value[fieldId]) {
      const newErrors = { ...errors.value }
      delete newErrors[fieldId]
      errors.value = newErrors
    }
  }

  // Get field visibility (based on conditional logic)
  const fieldVisibility = computed(() => {
    const visibility: Record<string, boolean> = {}
    for (const field of fieldsRef.value) {
      visibility[field.id] = isFieldVisible(
        field as Parameters<typeof isFieldVisible>[0],
        formValues.value,
      )
    }
    return visibility
  })

  // Get field required state (based on conditional logic)
  const fieldRequiredState = computed(() => {
    const required: Record<string, boolean> = {}
    for (const field of fieldsRef.value) {
      // Only check required if visible
      if (fieldVisibility.value[field.id]) {
        required[field.id] = isFieldRequired(
          field as Parameters<typeof isFieldRequired>[0],
          formValues.value,
        )
      } else {
        required[field.id] = false
      }
    }
    return required
  })

  // Get visible fields
  const visibleFields = computed(() => {
    return fieldsRef.value.filter((field) => fieldVisibility.value[field.id])
  })

  // Validate a single field
  function validateField(field: CustomFormFieldForForm): string | null {
    // Skip validation for hidden fields
    if (!fieldVisibility.value[field.id]) {
      return null
    }

    // Skip validation for section fields
    if (field.fieldType === 'section') {
      return null
    }

    const value = formValues.value[field.id]
    const isRequired = fieldRequiredState.value[field.id]

    // Required check
    if (isRequired) {
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return `${field.label} is required`
      }
    }

    // Skip further validation if empty and not required
    if (value === undefined || value === null || value === '') {
      return null
    }

    // Validation rules
    const validation = field.validation

    if (validation) {
      // String length validation
      if (typeof value === 'string') {
        if (validation.minLength && value.length < validation.minLength) {
          return `${field.label} must be at least ${validation.minLength} characters`
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          return `${field.label} must be at most ${validation.maxLength} characters`
        }
        if (validation.pattern) {
          const regex = new RegExp(validation.pattern)
          if (!regex.test(value)) {
            return validation.patternMessage || `${field.label} is invalid`
          }
        }
      }

      // Number validation
      if (typeof value === 'number') {
        if (validation.min !== undefined && value < validation.min) {
          return `${field.label} must be at least ${validation.min}`
        }
        if (validation.max !== undefined && value > validation.max) {
          return `${field.label} must be at most ${validation.max}`
        }
      }
    }

    // Email validation
    if (field.fieldType === 'email' && typeof value === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address'
      }
    }

    // URL validation
    if (field.fieldType === 'url' && typeof value === 'string') {
      try {
        new URL(value)
      } catch {
        return 'Please enter a valid URL'
      }
    }

    return null
  }

  // Validate all fields
  function validateForm(): boolean {
    const newErrors: Record<string, string> = {}
    let isValid = true

    for (const field of fieldsRef.value) {
      const error = validateField(field)
      if (error) {
        newErrors[field.id] = error
        isValid = false
      }
    }

    errors.value = newErrors
    return isValid
  }

  // Calculate calculated field values
  function calculateFieldValues() {
    for (const field of fieldsRef.value) {
      if (field.fieldType === 'calculated' && field.calculatedConfig) {
        const result = evaluateFormula(
          field.calculatedConfig.formula,
          field.calculatedConfig.dependencies,
          formValues.value,
        )
        formValues.value[field.id] = result
      }
    }
  }

  // Evaluate a formula for calculated fields
  function evaluateFormula(
    formula: string,
    dependencies: string[],
    values: Record<string, unknown>,
  ): number | string {
    try {
      // Build a context object with dependency values
      const context: Record<string, number> = {}
      for (const dep of dependencies) {
        const val = values[dep]
        context[dep] = typeof val === 'number' ? val : Number.parseFloat(String(val)) || 0
      }

      // Simple formula evaluation (in production, use a proper expression parser)
      // For now, support basic operations: +, -, *, /, and field references
      let evalFormula = formula

      // Replace field references with values
      for (const [key, val] of Object.entries(context)) {
        evalFormula = evalFormula.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val))
      }

      // Evaluate the formula safely (basic arithmetic only)
      const result = Function(`"use strict"; return (${evalFormula})`)()
      return typeof result === 'number' ? result : 0
    } catch (err) {
      console.error('Formula evaluation error:', err)
      return 0
    }
  }

  // Submit the form
  async function submitForm(asDraft = false): Promise<FormSubmissionResult> {
    // Validate if not saving as draft
    if (!asDraft) {
      calculateFieldValues()

      if (!validateForm()) {
        toast.add({
          title: 'Validation Error',
          description: 'Please fix the errors before submitting',
          color: 'error',
        })
        return { success: false, error: 'Validation failed' }
      }
    }

    isSubmitting.value = true

    try {
      const payload = {
        formId: formIdRef.value,
        versionId: versionIdRef.value,
        contextType: contextTypeRef.value,
        contextId: contextIdRef.value,
        responses: formValues.value,
        status: asDraft ? 'draft' : 'submitted',
      }

      // Check if online
      if (!isOnline.value) {
        // Save to offline queue
        const { addToQueue } = useOfflineQueue()
        await addToQueue('custom_form_submit', payload)

        // Clear draft since we've queued the submission
        clearDraft()

        toast.add({
          title: asDraft ? 'Draft Saved Offline' : 'Form Queued',
          description: asDraft
            ? 'Your draft has been saved locally'
            : 'Your form will be submitted when online',
          color: 'warning',
        })

        return { success: true }
      }

      // Submit online
      const response = await $fetch<{ id: string }>('/api/custom-form-submissions', {
        method: 'POST',
        body: payload,
      })

      // Clear draft on successful submission
      clearDraft()

      toast.add({
        title: asDraft ? 'Draft Saved' : 'Form Submitted',
        description: asDraft
          ? 'Your draft has been saved'
          : settingsRef.value.successMessage || 'Your form has been submitted successfully',
      })

      isDirty.value = false

      return { success: true, submissionId: response.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit form'
      toast.add({
        title: 'Error',
        description: message,
        color: 'error',
      })
      return { success: false, error: message }
    } finally {
      isSubmitting.value = false
    }
  }

  // Reset form to initial state
  function resetForm() {
    initializeForm()
    errors.value = {}
    isDirty.value = false
    clearDraft()
  }

  // Watch for field changes to recalculate
  watch(
    formValues,
    () => {
      calculateFieldValues()
    },
    { deep: true },
  )

  // Initialize on mount
  onMounted(() => {
    initializeForm()

    // Try to load draft
    if (settingsRef.value.allowDraft !== false) {
      const hasDraft = loadDraft()
      if (hasDraft) {
        toast.add({
          title: 'Draft Restored',
          description: 'A saved draft has been restored',
        })
      }
    }

    // Start auto-save
    if (settingsRef.value.allowDraft !== false) {
      startAutoSave()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopAutoSave()

    // Save draft if dirty
    if (isDirty.value && settingsRef.value.allowDraft !== false) {
      saveDraft()
    }
  })

  return {
    // State
    formValues: readonly(formValues),
    errors: readonly(errors),
    isSubmitting: readonly(isSubmitting),
    isDirty: readonly(isDirty),
    lastSavedAt: readonly(lastSavedAt),

    // Computed
    fieldVisibility,
    fieldRequiredState,
    visibleFields,

    // Methods
    updateFieldValue,
    validateField,
    validateForm,
    submitForm,
    resetForm,
    saveDraft,
    clearDraft,
    loadDraft,
    initializeForm,
  }
}
