/**
 * Admin Form Management Composable
 * Provides reusable form state and CRUD operation utilities for admin components
 */

import { ref, reactive, Ref } from 'vue'

export interface FormState {
  isOpen: boolean
  isLoading: boolean
  error: string | null
}

export interface CrudFormOptions {
  onSuccess?: () => void | Promise<void>
  onError?: (error: Error) => void
}

/**
 * Manage a CRUD form's state and operations
 * Usage:
 * const form = useAdminForm()
 * 
 * // Show/hide form
 * form.open()
 * form.close()
 * 
 * // Handle operations
 * await form.execute(async () => {
 *   await someAsyncOperation()
 * })
 */
export function useAdminForm(options?: CrudFormOptions) {
  const isOpen = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const open = () => {
    isOpen.value = true
    error.value = null
  }

  const close = () => {
    isOpen.value = false
    error.value = null
  }

  const clearError = () => {
    error.value = null
  }

  const execute = async (operation: () => Promise<void>) => {
    isLoading.value = true
    error.value = null

    try {
      await operation()
      if (options?.onSuccess) {
        await options.onSuccess()
      }
      close()
    } catch (err: any) {
      const errorMessage = err?.message || 'Operation failed'
      error.value = errorMessage
      if (options?.onError) {
        options.onError(err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    isOpen,
    isLoading,
    error,

    // Methods
    open,
    close,
    clearError,
    execute,
  }
}

/**
 * Manage a data list with search filtering
 * Usage:
 * const items = useAdminList(allItems, (item, query) => {
 *   return item.name.includes(query) || item.email.includes(query)
 * })
 */
export function useAdminList<T>(
  allItems: Ref<T[]>,
  filterFn: (item: T, query: string) => boolean
) {
  const search = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const filtered = () => {
    const q = search.value.trim().toLowerCase()
    if (!q) return allItems.value
    return allItems.value.filter(item => filterFn(item, q))
  }

  const refresh = async (loadFn: () => Promise<T[]>) => {
    isLoading.value = true
    error.value = null

    try {
      allItems.value = await loadFn()
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load items'
      error.value = errorMessage
      console.error('List refresh error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    search,
    isLoading,
    error,
    allItems,

    // Computed
    filtered,

    // Methods
    refresh,
    clearError: () => (error.value = null),
  }
}

/**
 * Manage confirm dialog state for delete operations
 * Usage:
 * const confirm = useAdminConfirm()
 * 
 * if (!confirm.ask('Delete this item?')) return
 * // proceed with delete
 */
export function useAdminConfirm() {
  const ask = (message: string): boolean => {
    return window.confirm(message)
  }

  const askDelete = (itemName: string): boolean => {
    return ask(`Delete "${itemName}"? This cannot be undone.`)
  }

  return {
    ask,
    askDelete,
  }
}
