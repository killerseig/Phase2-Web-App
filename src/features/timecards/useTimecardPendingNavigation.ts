import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

/** Navigation owns flushing; unmount only tears down already-resolved work. */
export function useTimecardPendingNavigation(options: {
  context: () => string
  blocked: () => boolean
  hasPending: () => boolean
  save: () => Promise<void>
  discard: () => void
  confirmDiscard: () => Promise<boolean> | undefined
  cancelConfirmation: () => void
  onError: (error: unknown) => void
}) {
  const busy = ref(false)
  let epoch = 0, disposed = false
  watch(options.context, () => { epoch++; options.cancelConfirmation() }, { flush: 'sync' })
  async function prepareNavigation() {
    if (disposed || busy.value) return false
    if (options.blocked()) {
      options.onError(new Error('Wait for the timecard change to finish before leaving.'))
      return false
    }
    if (!options.hasPending()) return true
    const owner = epoch
    const current = () => !disposed && owner === epoch
    busy.value = true
    try {
      try { await options.save() }
      catch (error) {
        if (!current()) return false
        options.onError(error)
        const discard = await options.confirmDiscard()
        if (!current() || !discard || options.blocked()) return false
        options.discard()
      }
      return current() && !options.hasPending()
    } finally { busy.value = false }
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (busy.value || options.blocked() || options.hasPending()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onBeforeRouteLeave(prepareNavigation)
  onBeforeRouteUpdate(prepareNavigation)
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => {
    disposed = true
    epoch++
    options.cancelConfirmation()
    window.removeEventListener('beforeunload', beforeUnload)
  })
  return { prepareNavigation, busy }
}
