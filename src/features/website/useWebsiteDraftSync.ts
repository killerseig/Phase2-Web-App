import { onScopeDispose, ref, watch, type Ref } from 'vue'

/** Revalidate shared drafts without replacing work in progress in this editor. */
export function useWebsiteDraftSync<T extends { version: number }>(options: {
  scope: () => string
  snapshot: Ref<string>
  version: Ref<number>
  ready: () => boolean
  dirty: () => boolean
  blocked: () => boolean
  load: () => Promise<T>
  apply: (state: T) => void
}) {
  const newerVersion = ref<number | null>(null)
  const checking = ref(false)
  let disposed = false
  let generation = 0
  let pending: Promise<void> | undefined

  function available() {
    return (
      !disposed &&
      !!options.scope() &&
      options.ready() &&
      navigator.onLine &&
      document.visibilityState === 'visible'
    )
  }

  function check(): Promise<void> {
    if (!available()) return Promise.resolve()
    if (pending) return pending

    const scope = options.scope()
    const requestGeneration = generation
    const version = options.version.value
    const snapshot = options.snapshot.value
    const idle = !options.dirty() && !options.blocked()
    checking.value = true
    // Deferring the callback also makes synchronous injected failures recoverable.
    const request = Promise.resolve()
      .then(() => {
        if (!available() || requestGeneration !== generation || scope !== options.scope()) return
        return options.load()
      })
      .then((state) => {
        if (
          !state ||
          !available() ||
          requestGeneration !== generation ||
          scope !== options.scope() ||
          !Number.isInteger(state.version) ||
          state.version <= options.version.value ||
          state.version < (newerVersion.value ?? 0)
        )
          return

        newerVersion.value = state.version
        if (
          !idle ||
          options.dirty() ||
          options.blocked() ||
          version !== options.version.value ||
          snapshot !== options.snapshot.value
        )
          return

        // Applying is synchronous so the caller can pause autosave and update
        // draft, version, and saved baseline as one guarded operation.
        options.apply(state)
        newerVersion.value = null
      })
      .catch(() => {
        // A background read failure must not disturb edits or produce repeated
        // alerts. The next focus, reconnect, or interval will try again.
      })
      .finally(() => {
        if (pending !== request) return
        pending = undefined
        checking.value = false
      })
    pending = request
    return request
  }

  function revalidate() {
    void check()
  }
  const timer = setInterval(revalidate, 30_000)
  window.addEventListener('focus', revalidate)
  window.addEventListener('online', revalidate)
  document.addEventListener('visibilitychange', revalidate)

  const stopScopeWatch = watch(
    options.scope,
    () => {
      generation++
      pending = undefined
      checking.value = false
      newerVersion.value = null
    },
    { flush: 'sync' },
  )
  const stopVersionWatch = watch(
    options.version,
    (version) => {
      if (newerVersion.value !== null && version >= newerVersion.value) newerVersion.value = null
    },
    { flush: 'sync' },
  )
  function stop() {
    if (disposed) return
    disposed = true
    generation++
    pending = undefined
    checking.value = false
    clearInterval(timer)
    stopScopeWatch()
    stopVersionWatch()
    window.removeEventListener('focus', revalidate)
    window.removeEventListener('online', revalidate)
    document.removeEventListener('visibilitychange', revalidate)
  }
  onScopeDispose(stop)

  return { newerVersion, checking, check, stop }
}
