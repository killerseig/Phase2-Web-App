import { onUnmounted } from 'vue'
import { logWarn } from '@/utils'

type Unsubscribe = () => void

/**
 * Tracks realtime unsubscribe handlers by key.
 * `replace` always tears down the previous handler first.
 */
export function useSubscriptionRegistry() {
  const subscriptions = new Map<string, Unsubscribe>()

  const runUnsubscribe = (key: string, unsubscribe: Unsubscribe) => {
    try {
      unsubscribe()
    } catch (error) {
      logWarn('Subscriptions', `Failed to unsubscribe "${key}"`, error)
    }
  }

  const clear = (key: string) => {
    const unsubscribe = subscriptions.get(key)
    if (!unsubscribe) return
    subscriptions.delete(key)
    runUnsubscribe(key, unsubscribe)
  }

  const replace = (key: string, unsubscribe: Unsubscribe | null | undefined) => {
    clear(key)
    if (!unsubscribe) return
    subscriptions.set(key, unsubscribe)
  }

  const clearAll = () => {
    for (const [key, unsubscribe] of subscriptions.entries()) {
      runUnsubscribe(key, unsubscribe)
    }
    subscriptions.clear()
  }

  onUnmounted(clearAll)

  return {
    replace,
    clear,
    clearAll,
  }
}
