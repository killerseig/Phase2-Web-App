import { computed, ref, watch, type Ref } from 'vue'
import { clone, type FormTemplate, type FormDefinition } from './model'
type Snapshot = { definition: FormDefinition; selection: string }
export function useFormAuthoring(draft: Ref<FormTemplate | undefined>, dirty: Ref<boolean>) {
  const selection = ref(''),
    past = ref<Snapshot[]>([]),
    future = ref<Snapshot[]>([])
  let current: Snapshot | undefined,
    baseline = ''
  const definition = (): FormDefinition | undefined =>
    draft.value
      ? clone({
          title: draft.value.title,
          description: draft.value.description,
          fields: draft.value.fields,
          recipients: draft.value.recipients,
        })
      : undefined
  const fingerprint = () => JSON.stringify(definition())
  function reset(unsaved = false) {
    selection.value = draft.value?.fields[0]?.id || ''
    past.value = []
    future.value = []
    const value = definition()
    current = value ? { definition: value, selection: selection.value } : undefined
    baseline = unsaved ? '' : fingerprint()
    dirty.value = unsaved
  }
  function select(id: string) {
    if (!draft.value?.fields.some((field) => field.id === id)) return
    selection.value = id
    if (current) current.selection = id
  }
  function saved() {
    baseline = fingerprint()
    dirty.value = false
  }
  watch(
    draft,
    () => {
      const value = definition()
      if (!value || !current) return
      if (JSON.stringify(value) === JSON.stringify(current.definition)) return
      past.value.push(clone(current))
      if (past.value.length > 60) past.value.shift()
      future.value = []
      current = { definition: value, selection: selection.value }
      dirty.value = fingerprint() !== baseline
    },
    { deep: true, flush: 'post' },
  )
  function restore(snapshot: Snapshot) {
    if (!draft.value) return
    Object.assign(draft.value, clone(snapshot.definition))
    selection.value = snapshot.selection
    current = clone(snapshot)
    dirty.value = fingerprint() !== baseline
  }
  function undo() {
    const previous = past.value.pop()
    if (!previous || !current) return
    future.value.push(clone(current))
    restore(previous)
  }
  function redo() {
    const next = future.value.pop()
    if (!next || !current) return
    past.value.push(clone(current))
    restore(next)
  }
  return {
    selection,
    select,
    reset,
    saved,
    undo,
    redo,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
  }
}
