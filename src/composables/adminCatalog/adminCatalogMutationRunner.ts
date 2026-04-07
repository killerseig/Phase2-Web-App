import type { Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import { logError } from '@/utils'

type AdminCatalogMutationLogContext = {
  scope: string
  message: string
}

type RunAdminCatalogMutationOptions = {
  pending: Ref<boolean>
  toast: ToastNotifier
  successMessage?: string
  errorMessage: string | ((error: unknown) => string)
  logContext?: AdminCatalogMutationLogContext
  onSuccess?: () => void
  onError?: (error: unknown) => void
}

export async function runAdminCatalogMutation(
  task: () => Promise<unknown>,
  options: RunAdminCatalogMutationOptions,
) {
  options.pending.value = true

  try {
    await task()
    options.onSuccess?.()

    if (options.successMessage) {
      options.toast.show(options.successMessage, 'success')
    }
  } catch (error) {
    if (options.logContext) {
      logError(options.logContext.scope, options.logContext.message, error)
    }

    options.onError?.(error)

    const errorMessage = typeof options.errorMessage === 'function'
      ? options.errorMessage(error)
      : options.errorMessage
    options.toast.show(errorMessage, 'error')
  } finally {
    options.pending.value = false
  }
}
