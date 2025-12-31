/**
 * Offline Form Composable
 * Provides offline-first form handling with auto-save, persistence, and submission queuing.
 *
 * Features:
 * - Auto-saves form data as user types (debounced)
 * - Persists form state to localStorage/IndexedDB
 * - Queues form submissions when offline
 * - Syncs submissions when back online
 * - Generic typing for different form data shapes
 */
import { createStore, del, get, set } from 'idb-keyval'
import type { OfflineOperationType } from './useOfflineQueue'

/** Storage options for offline form data */
export type OfflineFormStorage = 'localStorage' | 'indexedDB'

/** Status of the offline form */
export type OfflineFormStatus =
  | 'idle' // No changes
  | 'dirty' // Unsaved changes
  | 'saving' // Currently saving to offline storage
  | 'saved' // Saved to offline storage
  | 'submitting' // Submitting to server
  | 'queued' // Queued for later submission (offline)
  | 'submitted' // Successfully submitted
  | 'error' // Submission error

/** Configuration for the offline form composable */
export interface UseOfflineFormOptions<T extends Record<string, unknown>> {
  /** Unique key for storing form data (should be unique per form instance) */
  storageKey: string
  /** Initial/default values for the form */
  initialValues?: T
  /** Storage mechanism to use (default: 'localStorage') */
  storage?: OfflineFormStorage
  /** Debounce delay for auto-save in milliseconds (default: 1000) */
  autoSaveDelay?: number
  /** Whether to enable auto-save (default: true) */
  autoSave?: boolean
  /** Operation type for queuing (required for queue submission) */
  operationType?: OfflineOperationType
  /** Entity ID for update operations */
  entityId?: string
  /** Entity version for conflict detection */
  entityVersion?: string
  /** Custom submit handler (called when online) */
  onSubmit?: (data: T) => Promise<void>
  /** Called when form is successfully submitted or queued */
  onSuccess?: (queued: boolean) => void
  /** Called when submission fails */
  onError?: (error: Error) => void
}

/** Return type for the offline form composable */
export interface UseOfflineFormReturn<T extends Record<string, unknown>> {
  /** Current form data (reactive) */
  formData: Ref<T>
  /** Whether form has unsaved changes */
  isDirty: Readonly<Ref<boolean>>
  /** Whether form is saved to offline storage */
  isOfflineSaved: Readonly<Ref<boolean>>
  /** Current status of the form */
  status: Readonly<Ref<OfflineFormStatus>>
  /** Error message if submission failed */
  error: Readonly<Ref<string | null>>
  /** Timestamp of last offline save */
  lastSavedAt: Readonly<Ref<Date | null>>
  /** Submit the form (queues if offline) */
  submit: () => Promise<boolean>
  /** Reset form to initial values */
  reset: () => void
  /** Clear offline data for this form */
  clearOfflineData: () => Promise<void>
  /** Manually save to offline storage */
  saveToOffline: () => Promise<void>
  /** Load from offline storage */
  loadFromOffline: () => Promise<boolean>
  /** Update a single field */
  setField: <K extends keyof T>(key: K, value: T[K]) => void
  /** Update multiple fields */
  setFields: (fields: Partial<T>) => void
}

// IndexedDB store for form data
const STORE_NAME = 'fleet-offline-forms'
let formStore: ReturnType<typeof createStore> | null = null

function getFormStore() {
  if (!formStore && import.meta.client) {
    formStore = createStore('fleet2-forms', STORE_NAME)
  }
  return formStore
}

/**
 * Composable for handling forms that work offline.
 *
 * @example
 * ```typescript
 * interface MyFormData {
 *   title: string
 *   description: string
 *   priority: 'low' | 'medium' | 'high'
 * }
 *
 * const {
 *   formData,
 *   isDirty,
 *   isOfflineSaved,
 *   submit,
 *   reset,
 *   clearOfflineData
 * } = useOfflineForm<MyFormData>({
 *   storageKey: 'work-order-form',
 *   initialValues: { title: '', description: '', priority: 'medium' },
 *   operationType: 'work_order_create',
 *   onSubmit: async (data) => {
 *     await $fetch('/api/work-orders', { method: 'POST', body: data })
 *   }
 * })
 * ```
 */
export function useOfflineForm<T extends Record<string, unknown>>(
  options: UseOfflineFormOptions<T>,
): UseOfflineFormReturn<T> {
  const {
    storageKey,
    initialValues = {} as T,
    storage = 'localStorage',
    autoSaveDelay = 1000,
    autoSave = true,
    operationType,
    entityId,
    entityVersion,
    onSubmit,
    onSuccess,
    onError,
  } = options

  // Get connectivity and queue composables
  const isOnline = useOnline()
  const toast = useToast()
  const offlineQueue = useOfflineQueue()
  const connectivity = useConnectivity()

  // Form state
  const formData = ref<T>({ ...initialValues }) as Ref<T>
  const isDirty = ref(false)
  const isOfflineSaved = ref(false)
  const status = ref<OfflineFormStatus>('idle')
  const error = ref<string | null>(null)
  const lastSavedAt = ref<Date | null>(null)

  // Internal state
  const originalValues = ref<T>({ ...initialValues }) as Ref<T>
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  // Storage key with prefix
  const fullStorageKey = computed(() => `offline-form:${storageKey}`)

  /**
   * Save form data to localStorage
   */
  const saveToLocalStorage = () => {
    if (!import.meta.client) return

    try {
      const dataToSave = {
        data: formData.value,
        savedAt: new Date().toISOString(),
        version: entityVersion,
      }
      localStorage.setItem(fullStorageKey.value, JSON.stringify(dataToSave))
      lastSavedAt.value = new Date()
      isOfflineSaved.value = true
    } catch (err) {
      console.error('[useOfflineForm] Failed to save to localStorage:', err)
    }
  }

  /**
   * Save form data to IndexedDB
   */
  const saveToIndexedDB = async () => {
    if (!import.meta.client) return

    try {
      const store = getFormStore()
      if (!store) return

      const dataToSave = {
        data: formData.value,
        savedAt: new Date().toISOString(),
        version: entityVersion,
      }
      await set(fullStorageKey.value, dataToSave, store)
      lastSavedAt.value = new Date()
      isOfflineSaved.value = true
    } catch (err) {
      console.error('[useOfflineForm] Failed to save to IndexedDB:', err)
    }
  }

  /**
   * Save form data to offline storage
   */
  const saveToOffline = async (): Promise<void> => {
    if (!import.meta.client) return

    status.value = 'saving'

    try {
      if (storage === 'indexedDB') {
        await saveToIndexedDB()
      } else {
        saveToLocalStorage()
      }
      status.value = 'saved'
    } catch (err) {
      console.error('[useOfflineForm] Save failed:', err)
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Failed to save offline'
    }
  }

  /**
   * Load form data from localStorage
   */
  const loadFromLocalStorage = (): boolean => {
    if (!import.meta.client) return false

    try {
      const stored = localStorage.getItem(fullStorageKey.value)
      if (!stored) return false

      const parsed = JSON.parse(stored)
      formData.value = parsed.data
      lastSavedAt.value = parsed.savedAt ? new Date(parsed.savedAt) : null
      isOfflineSaved.value = true
      return true
    } catch (err) {
      console.error('[useOfflineForm] Failed to load from localStorage:', err)
      return false
    }
  }

  /**
   * Load form data from IndexedDB
   */
  const loadFromIndexedDB = async (): Promise<boolean> => {
    if (!import.meta.client) return false

    try {
      const store = getFormStore()
      if (!store) return false

      const stored = await get<{ data: T; savedAt: string; version?: string }>(
        fullStorageKey.value,
        store,
      )
      if (!stored) return false

      formData.value = stored.data
      lastSavedAt.value = stored.savedAt ? new Date(stored.savedAt) : null
      isOfflineSaved.value = true
      return true
    } catch (err) {
      console.error('[useOfflineForm] Failed to load from IndexedDB:', err)
      return false
    }
  }

  /**
   * Load form data from offline storage
   */
  const loadFromOffline = async (): Promise<boolean> => {
    if (!import.meta.client) return false

    if (storage === 'indexedDB') {
      return await loadFromIndexedDB()
    } else {
      return loadFromLocalStorage()
    }
  }

  /**
   * Clear offline data for this form
   */
  const clearOfflineData = async (): Promise<void> => {
    if (!import.meta.client) return

    try {
      if (storage === 'indexedDB') {
        const store = getFormStore()
        if (store) {
          await del(fullStorageKey.value, store)
        }
      } else {
        localStorage.removeItem(fullStorageKey.value)
      }
      isOfflineSaved.value = false
      lastSavedAt.value = null
    } catch (err) {
      console.error('[useOfflineForm] Failed to clear offline data:', err)
    }
  }

  /**
   * Debounced auto-save function
   */
  const debouncedSave = () => {
    if (!autoSave) return

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    saveTimeout = setTimeout(() => {
      if (isDirty.value) {
        saveToOffline()
      }
    }, autoSaveDelay)
  }

  /**
   * Update a single field
   */
  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    formData.value = {
      ...formData.value,
      [key]: value,
    }
    isDirty.value = true
    status.value = 'dirty'
    debouncedSave()
  }

  /**
   * Update multiple fields
   */
  const setFields = (fields: Partial<T>) => {
    formData.value = {
      ...formData.value,
      ...fields,
    }
    isDirty.value = true
    status.value = 'dirty'
    debouncedSave()
  }

  /**
   * Reset form to initial values
   */
  const reset = () => {
    formData.value = { ...originalValues.value }
    isDirty.value = false
    status.value = 'idle'
    error.value = null

    // Cancel pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
  }

  /**
   * Submit the form (queues if offline)
   */
  const submit = async (): Promise<boolean> => {
    // Cancel any pending auto-save
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }

    status.value = 'submitting'
    error.value = null

    try {
      // Check if online
      if (isOnline.value && connectivity.isConnected.value) {
        // Online - submit directly
        if (onSubmit) {
          await onSubmit(formData.value)
        } else if (operationType) {
          // Fall back to using the queue's sync mechanism
          // But since we're online, we can submit immediately
          console.warn('[useOfflineForm] No onSubmit handler provided, using queue')
          await offlineQueue.addToQueue(operationType, formData.value, {
            entityId,
            entityVersion,
          })
          // Trigger immediate sync
          await offlineQueue.triggerSync()
        } else {
          throw new Error('No submit handler or operation type provided')
        }

        // Success - clear offline data
        await clearOfflineData()
        status.value = 'submitted'
        isDirty.value = false

        toast.add({
          title: 'Submitted',
          description: 'Your form has been submitted successfully',
          color: 'success',
          icon: 'i-lucide-check-circle',
        })

        onSuccess?.(false)
        return true
      } else {
        // Offline - queue for later submission
        if (!operationType) {
          throw new Error('Cannot queue submission without operation type')
        }

        await offlineQueue.addToQueue(operationType, formData.value, {
          entityId,
          entityVersion,
        })

        // Save a copy to offline storage as backup
        await saveToOffline()

        status.value = 'queued'
        isDirty.value = false

        toast.add({
          title: 'Saved Offline',
          description: 'Your form has been saved and will be submitted when online',
          color: 'warning',
          icon: 'i-lucide-cloud-off',
        })

        onSuccess?.(true)
        return true
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit form'
      status.value = 'error'
      error.value = errorMessage

      toast.add({
        title: 'Submission Failed',
        description: errorMessage,
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })

      onError?.(err instanceof Error ? err : new Error(errorMessage))
      return false
    }
  }

  // Watch for form data changes to track dirty state
  watch(
    formData,
    (newVal) => {
      // Check if data differs from original
      const hasChanges = JSON.stringify(newVal) !== JSON.stringify(originalValues.value)
      if (hasChanges && !isDirty.value) {
        isDirty.value = true
        status.value = 'dirty'
      }
    },
    { deep: true },
  )

  // Initialize on client side
  if (import.meta.client) {
    // Try to load saved offline data
    onMounted(async () => {
      const loaded = await loadFromOffline()
      if (loaded) {
        isDirty.value = true
        status.value = 'saved'
        toast.add({
          title: 'Draft Restored',
          description: 'Your previous draft has been restored',
          icon: 'i-lucide-file-text',
        })
      }
    })

    // Save on unmount if dirty
    onUnmounted(() => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }

      // Sync save on unmount if dirty
      if (isDirty.value) {
        if (storage === 'localStorage') {
          saveToLocalStorage()
        }
        // For IndexedDB, we can't do async in unmount, so save was done via debounce
      }
    })

    // Listen for connectivity changes to auto-submit queued forms
    const unsubscribe = connectivity.onConnectivityChange(async ({ isConnected, wasConnected }) => {
      if (isConnected && !wasConnected && status.value === 'queued') {
        // Just came online and we have a queued submission
        // The offline queue will handle this, but update our status
        status.value = 'submitting'
      }
    })

    onUnmounted(() => {
      unsubscribe()
    })
  }

  return {
    // State
    formData,
    isDirty: readonly(isDirty),
    isOfflineSaved: readonly(isOfflineSaved),
    status: readonly(status),
    error: readonly(error),
    lastSavedAt: readonly(lastSavedAt),

    // Methods
    submit,
    reset,
    clearOfflineData,
    saveToOffline,
    loadFromOffline,
    setField,
    setFields,
  }
}
