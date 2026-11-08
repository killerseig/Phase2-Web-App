import { getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import { normalizeError } from '@/utils/normalizeError'
import type { AdminRequestContext } from './useAdminRequestContext'

export function useAdminRecords<T>(
  subscribe: (update: (records: T[]) => void, error: (reason: unknown) => void) => () => void,
  options: {
    context?: AdminRequestContext
    errorMessage: string
    onUpdate?: (records: T[]) => void
  },
) {
  const records = ref<T[]>([]),
    loading = ref(false),
    error = ref('')
  let generation = 0,
    disposed = false,
    unsubscribe: (() => void) | undefined
  function stop() {
    generation++
    unsubscribe?.()
    unsubscribe = undefined
  }
  function clear() {
    records.value = []
    loading.value = false
    error.value = ''
  }
  function start() {
    stop()
    if (disposed || (options.context && !options.context.allowed.value)) {
      clear()
      return
    }
    const owner = generation,
      contextCurrent = options.context?.capture() ?? (() => true)
    const current = () => !disposed && owner === generation && contextCurrent()
    loading.value = true
    error.value = ''
    const failed = (reason: unknown) => {
      if (!current()) return
      const code =
        typeof reason === 'object' && reason !== null && 'code' in reason ? String(reason.code) : ''
      if (/permission-denied|unauthenticated/.test(code)) {
        stop()
        records.value = []
      }
      error.value = normalizeError(reason, options.errorMessage)
      loading.value = false
    }
    try {
      const off = subscribe((next) => {
        if (!current()) return
        records.value = next
        loading.value = false
        options.onUpdate?.(next)
      }, failed)
      if (current()) unsubscribe = off
      else off()
    } catch (reason) {
      failed(reason)
    }
  }
  if (options.context)
    watch(
      options.context.revision,
      () => {
        stop()
        clear()
      },
      { flush: 'sync' },
    )
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true
      stop()
      clear()
    })
  return { records, loading, error, start, stop, clear }
}
