import { computed, getCurrentScope, onScopeDispose, readonly, ref, watch, type Ref } from 'vue'
import type { FormTemplate } from './model'

export interface FormEditorContextOptions {
  uid: Readonly<Ref<string>>
  enabled: Readonly<Ref<boolean>>
  draft: Ref<FormTemplate | undefined>
}

/** Context and draft epochs prevent a completed operation from reviving superseded state. */
export function useFormEditorContext(options: FormEditorContextOptions) {
  const revision = ref(0), disposed = ref(false)
  let draftRevision = 0
  const allowed = computed(() => !disposed.value && !!options.uid.value && options.enabled.value)
  const stopContext = watch([options.uid, options.enabled], () => { revision.value++ }, { flush: 'sync' })
  const stopDraft = watch(options.draft, () => { draftRevision++ }, { deep: true, flush: 'sync' })
  function capture() {
    const owner = revision.value, draftOwner = draftRevision
    const current = () => allowed.value && revision.value === owner
    return { current, draftCurrent: () => current() && draftRevision === draftOwner }
  }
  function dispose() {
    if (disposed.value) return
    disposed.value = true
    revision.value++
    stopContext()
    stopDraft()
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  return { allowed, revision: readonly(revision), capture, dispose }
}
