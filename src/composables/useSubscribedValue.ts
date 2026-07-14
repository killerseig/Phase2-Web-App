import { ref, type Ref } from 'vue'
import { normalizeError } from '@/utils/normalizeError'

type ValueSubscriber<TValue> = (
  onUpdate: (value: TValue) => void,
  onError?: (error: unknown) => void,
) => () => void

interface UseSubscribedValueOptions<TValue> {
  errorMessage: string
  initialLoading?: boolean
  onUpdate?: (value: TValue) => void
  onError?: (error: unknown) => void
}

export function useSubscribedValue<TValue>(
  subscriber: ValueSubscriber<TValue>,
  initialValue: TValue,
  options: UseSubscribedValueOptions<TValue>,
) {
  const value = ref(initialValue) as Ref<TValue>
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
        (nextValue) => {
          value.value = nextValue
          loading.value = false
          options.onUpdate?.(nextValue)
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
    start,
    stop,
    value,
  }
}
