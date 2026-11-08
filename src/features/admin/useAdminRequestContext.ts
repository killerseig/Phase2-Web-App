import {
  computed,
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
  type Ref,
  type WatchSource,
} from 'vue'

export interface AdminRequestContext {
  allowed: Readonly<Ref<boolean>>
  revision: Readonly<Ref<number>>
  capture: () => () => boolean
}

/** A session transition invalidates work even when the same UID returns in one tick. */
export function useAdminRequestContext(
  identity: Readonly<Ref<string>>,
  enabled: Readonly<Ref<boolean>>,
  role?: Readonly<Ref<string>>,
) {
  const disposed = ref(false),
    revision = ref(0)
  const allowed = computed(() => !disposed.value && !!identity.value && enabled.value)
  const stop = watch([identity, enabled, () => role?.value], () => revision.value++, {
    flush: 'sync',
  })
  function capture() {
    const owner = revision.value
    return () => allowed.value && owner === revision.value
  }
  function dispose() {
    if (disposed.value) return
    disposed.value = true
    revision.value++
    stop()
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  return { allowed, revision: readonly(revision), capture, dispose }
}

/** Selection owns request finalizers; subsequent draft edits also invalidate messages/results. */
export function useAdminRequestScope(
  context?: AdminRequestContext,
  selection?: WatchSource<unknown>,
  draft?: WatchSource<unknown>,
) {
  const disposed = ref(false),
    revision = ref(0)
  let draftRevision = 0
  const allowed = computed(() => !disposed.value && (context?.allowed.value ?? true))
  const stops: Array<() => void> = []
  if (context) stops.push(watch(context.revision, () => revision.value++, { flush: 'sync' }))
  if (selection) stops.push(watch(selection, () => revision.value++, { flush: 'sync' }))
  // Form synchronization may replace arrays with equal values. Only value
  // changes invalidate a draft; synchronous observation still catches edit/revert.
  if (draft)
    stops.push(
      watch(
        () => JSON.stringify(toValue(draft)),
        () => draftRevision++,
        { flush: 'sync' },
      ),
    )
  function capture() {
    const owner = revision.value,
      draftOwner = draftRevision
    const parentCurrent = context?.capture() ?? (() => true)
    const current = () => allowed.value && parentCurrent() && owner === revision.value
    return { current, draftCurrent: () => current() && draftOwner === draftRevision }
  }
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed.value = true
      revision.value++
      stops.forEach((stop) => stop())
    })
  return { allowed, revision: readonly(revision), capture }
}
