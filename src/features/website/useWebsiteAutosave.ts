import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { WebsiteSite } from './types'

export interface WebsiteRecovery {
  key: string
  draft: WebsiteSite
  saved: string
  version: number
  manualSave?: boolean
  updatedAt: number
}

// Separate records keep two open editors from overwriting each other's recovery copy.
export function useWebsiteAutosave(options: {
  scope: () => string
  site: Ref<WebsiteSite | undefined>
  saved: Ref<string>
  version: Ref<number>
  manualSave?: () => boolean
  blocked: () => boolean
  save: (draft: WebsiteSite, version: number) => Promise<{ version: number }>
}) {
  const ready = ref(false)
  const changed = ref(false)
  const online = ref(navigator.onLine)
  const saving = ref(false)
  const problem = ref('')
  const storageProblem = ref('')
  const conflict = ref(false)
  const recoveries = ref<WebsiteRecovery[]>([])
  const localSnapshot = ref('')
  const snapshot = computed(() => (options.site.value ? JSON.stringify(options.site.value) : ''))
  const dirty = computed(() => !!snapshot.value && snapshot.value !== options.saved.value)
  const protectedLocally = computed(
    () => !!snapshot.value && localSnapshot.value === snapshot.value,
  )
  const prefix = () => `website-recovery:v1:${encodeURIComponent(options.scope())}:`
  let key = prefix() + crypto.randomUUID()
  let localTimer: ReturnType<typeof setTimeout> | undefined
  let remoteTimer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<void> | undefined
  let disposed = false
  let retryDelay = 5000

  function discover(server?: string) {
    const entries: WebsiteRecovery[] = []
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const candidate = localStorage.key(index)!
        if (!candidate.startsWith(prefix()) || candidate === key) continue
        try {
          const record = JSON.parse(localStorage.getItem(candidate)!) as WebsiteRecovery
          if (
            !record.draft ||
            !Array.isArray(record.draft.pages) ||
            typeof record.saved !== 'string' ||
            !Number.isInteger(record.version) ||
            !Number.isFinite(record.updatedAt)
          )
            continue
          if (server && JSON.stringify(record.draft) === server) continue
          entries.push({ ...record, key: candidate })
        } catch {
          /* A damaged record must not prevent other recovery copies loading. */
        }
      }
      recoveries.value = entries.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch {
      storageProblem.value = 'Browser recovery is unavailable. Save your draft before leaving.'
    }
  }
  function persist() {
    clearTimeout(localTimer)
    if (!ready.value || !options.scope() || !snapshot.value) return
    if (dirty.value && !changed.value) return
    try {
      if (dirty.value) {
        localStorage.setItem(
          key,
          JSON.stringify({
            draft: options.site.value,
            saved: options.saved.value,
            version: options.version.value,
            manualSave: options.manualSave?.() === true,
            updatedAt: Date.now(),
          }),
        )
        localSnapshot.value = snapshot.value
      } else {
        localStorage.removeItem(key)
        localSnapshot.value = ''
      }
      storageProblem.value = ''
    } catch {
      localSnapshot.value = ''
      storageProblem.value =
        'Browser recovery could not be saved. Save your draft online or download a recovery copy before leaving.'
    }
  }
  function reportFailure(reason: unknown) {
    const code = reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : ''
    conflict.value = /aborted|failed-precondition/.test(code)
    problem.value = conflict.value
      ? 'Another saved version exists. Automatic saving is paused; download your recovery copy before reloading to review it.'
      : /invalid-argument/.test(code)
        ? 'Draft needs corrections before it can save online. Your edits remain in this browser.'
        : 'Online save failed. We will retry when the connection is available.'
    // Validation/auth failures need a change or manual retry, not a repeated request loop.
    return !/aborted|failed-precondition|invalid-argument|permission-denied|unauthenticated/.test(
      code,
    )
  }
  function schedule(delay = 3000) {
    clearTimeout(remoteTimer)
    if (
      disposed ||
      !ready.value ||
      !dirty.value ||
      !changed.value ||
      !online.value ||
      conflict.value ||
      recoveries.value.length > 0 ||
      options.blocked()
    )
      return
    remoteTimer = setTimeout(() => {
      void saveNow()
    }, delay)
  }
  async function saveNow() {
    if (
      pending ||
      disposed ||
      !ready.value ||
      !dirty.value ||
      !changed.value ||
      !online.value ||
      conflict.value ||
      recoveries.value.length > 0 ||
      options.blocked()
    )
      return
    persist()
    const sent = snapshot.value
    const scope = options.scope()
    const sentVersion = options.version.value
    saving.value = true
    let retry = false
    pending = (async () => {
      try {
        const result = await options.save(JSON.parse(sent), sentVersion)
        if (disposed || scope !== options.scope()) return
        options.version.value = result.version
        options.saved.value = sent
        problem.value = ''
        retryDelay = 5000
        persist()
        retry = dirty.value
      } catch (reason) {
        if (!disposed && scope === options.scope()) {
          retry = reportFailure(reason)
          persist()
        }
      }
    })()
    await pending
    pending = undefined
    saving.value = false
    if (retry && !disposed) {
      schedule(problem.value ? retryDelay : 3000)
      retryDelay = Math.min(60000, retryDelay * 2)
    }
  }
  function stash() {
    // Reloading/replacing the editor never destroys the local draft it replaces.
    persist()
    if (dirty.value && protectedLocally.value) {
      key = prefix() + crypto.randomUUID()
      localSnapshot.value = ''
    }
  }
  function forget(record: WebsiteRecovery) {
    try {
      localStorage.removeItem(record.key)
      recoveries.value = recoveries.value.filter((entry) => entry.key !== record.key)
    } catch {
      storageProblem.value = 'Could not remove that browser recovery copy.'
    }
  }
  function connection() {
    online.value = navigator.onLine
    if (online.value) schedule(250)
    else persist()
  }
  function visibility() {
    if (document.visibilityState === 'hidden') persist()
  }
  watch(
    snapshot,
    () => {
      if (ready.value) changed.value = true
      clearTimeout(localTimer)
      localTimer = setTimeout(persist, 250)
      schedule()
    },
    { flush: 'sync' },
  )
  watch([ready, () => options.blocked(), () => recoveries.value.length], () => schedule())
  watch(
    options.scope,
    () => {
      // Never write one account's content under a different account's recovery key.
      ready.value = false
      clearTimeout(localTimer)
      clearTimeout(remoteTimer)
      recoveries.value = []
      localSnapshot.value = ''
      key = prefix() + crypto.randomUUID()
    },
    { flush: 'sync' },
  )
  window.addEventListener('online', connection)
  window.addEventListener('offline', connection)
  window.addEventListener('pagehide', persist)
  window.addEventListener('beforeunload', persist)
  document.addEventListener('visibilitychange', visibility)
  onBeforeUnmount(() => {
    persist()
    disposed = true
    clearTimeout(localTimer)
    clearTimeout(remoteTimer)
    window.removeEventListener('online', connection)
    window.removeEventListener('offline', connection)
    window.removeEventListener('pagehide', persist)
    window.removeEventListener('beforeunload', persist)
    document.removeEventListener('visibilitychange', visibility)
  })
  discover()
  return {
    begin: (recovered = false) => {
      changed.value = recovered
      ready.value = true
    },
    ready,
    online,
    saving,
    problem,
    storageProblem,
    conflict,
    recoveries,
    protectedLocally,
    persist,
    discover,
    stash,
    forget,
    reportFailure,
    settle: async () => {
      clearTimeout(remoteTimer)
      await pending
    },
  }
}
