import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'

export function useDebouncedSearchQuery(searchQuery: Ref<string>, debounceMs: number): Ref<string> {
  if (debounceMs <= 0) {
    return computed(() => {
      const value = searchQuery.value ?? ''
      return value.trim() ? value : ''
    })
  }

  const result = ref(searchQuery.value)
  let debounceHandle: ReturnType<typeof setTimeout> | null = null

  const stop = watch(
    () => searchQuery.value,
    (value) => {
      if (debounceHandle) {
        clearTimeout(debounceHandle)
        debounceHandle = null
      }

      if (!value?.trim()) {
        result.value = ''
        return
      }

      debounceHandle = setTimeout(() => {
        result.value = value
        debounceHandle = null
      }, debounceMs)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (debounceHandle) {
      clearTimeout(debounceHandle)
    }
    stop()
  })

  return result
}
