import { computed, reactive } from 'vue'

export function usePendingActionMap() {
  const pendingKeys = reactive<Record<string, boolean>>({})
  const pendingCount = computed(() => Object.keys(pendingKeys).length)
  const hasPendingActions = computed(() => pendingCount.value > 0)

  function isActionPending(key: string) {
    return !!pendingKeys[key]
  }

  async function runWithPendingAction<TResult>(
    key: string,
    action: () => TResult | Promise<TResult>,
  ): Promise<TResult> {
    pendingKeys[key] = true

    try {
      return await action()
    } finally {
      delete pendingKeys[key]
    }
  }

  function clearPendingActions() {
    for (const key of Object.keys(pendingKeys)) {
      delete pendingKeys[key]
    }
  }

  return {
    clearPendingActions,
    hasPendingActions,
    isActionPending,
    pendingCount,
    pendingKeys,
    runWithPendingAction,
  }
}
