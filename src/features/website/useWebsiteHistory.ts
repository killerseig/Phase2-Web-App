import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { WebsiteSite } from './types'

// Keep local draft edits separate from server versions and publication history.
export function useWebsiteHistory(site: Ref<WebsiteSite | undefined>, limit = 30) {
  const snapshots = ref<string[]>([])
  const position = ref(0)
  const current = computed(() => (site.value ? JSON.stringify(site.value) : ''))
  const pending = computed(() =>
    Boolean(current.value && current.value !== snapshots.value[position.value]),
  )
  let applying = false
  let grouping = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }
  function checkpoint() {
    clearTimer()
    if (grouping) return
    if (!pending.value) return
    snapshots.value = snapshots.value.slice(0, position.value + 1)
    snapshots.value.push(current.value)
    if (snapshots.value.length > limit + 1) snapshots.value.shift()
    position.value = snapshots.value.length - 1
  }
  function reset(value: WebsiteSite) {
    grouping = false
    clearTimer()
    applying = true
    site.value = value
    snapshots.value = [JSON.stringify(value)]
    position.value = 0
    applying = false
  }
  function change(operation: () => void) {
    checkpoint()
    operation()
    checkpoint()
  }
  function step(direction: -1 | 1) {
    grouping = false
    checkpoint()
    const target = position.value + direction
    const snapshot = snapshots.value[target]
    if (snapshot === undefined) return
    applying = true
    position.value = target
    site.value = JSON.parse(snapshot) as WebsiteSite
    applying = false
  }
  watch(
    current,
    () => {
      if (applying || grouping) return
      clearTimer()
      timer = setTimeout(checkpoint, 400)
    },
    { flush: 'sync' },
  )
  onScopeDispose(clearTimer)
  return {
    beginGroup() {
      checkpoint()
      grouping = true
    },
    endGroup() {
      grouping = false
      checkpoint()
    },
    reset,
    change,
    checkpoint,
    undo: () => step(-1),
    redo: () => step(1),
    canUndo: computed(() => pending.value || position.value > 0),
    canRedo: computed(() => !pending.value && position.value < snapshots.value.length - 1),
  }
}
