import { ref } from 'vue'
import { normalizeError } from '@/utils/normalizeError'

type RecordsSubscriber<TRecord> = (
  onUpdate: (records: TRecord[]) => void,
  onError?: (error: unknown) => void,
) => () => void

interface UseSubscribedRecordsOptions<TRecord> {
  errorMessage: string
  initialLoading?: boolean
  onUpdate?: (records: TRecord[]) => void
  onError?: (error: unknown) => void
}

export function useSubscribedRecords<TRecord>(
  subscriber: RecordsSubscriber<TRecord>,
  options: UseSubscribedRecordsOptions<TRecord>,
) {
  const records = ref<TRecord[]>([])
  const loading = ref(options.initialLoading ?? true)
  const error = ref('')

  let unsubscribe: (() => void) | null = null

  function stop() {
    unsubscribe?.()
    unsubscribe = null
  }

  function start() {
    stop()
    loading.value = true
    error.value = ''

    try {
      unsubscribe = subscriber(
        (nextRecords) => {
          records.value = nextRecords
          loading.value = false
          options.onUpdate?.(nextRecords)
        },
        (caughtError) => {
          error.value = normalizeError(caughtError, options.errorMessage)
          loading.value = false
          options.onError?.(caughtError)
        },
      )
    } catch (caughtError) {
      error.value = normalizeError(caughtError, options.errorMessage)
      loading.value = false
      options.onError?.(caughtError)
    }
  }

  return {
    error,
    loading,
    records,
    start,
    stop,
  }
}
