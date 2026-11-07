import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { newTemplate, newField, clone, type FormTemplate } from './model'
import { useFormEditorContext } from './useFormEditorContext'

function setup() {
  const scope = effectScope(), uid = ref('admin-a'), enabled = ref(true)
  const draft = ref<FormTemplate | undefined>({ ...newTemplate(), fields: [newField('text')] })
  const context = scope.run(() => useFormEditorContext({ uid, enabled, draft }))!
  return { scope, uid, enabled, draft, context }
}

describe('Form editor operation context', () => {
  it('accepts an unchanged authorized context and independently tracks draft edits', () => {
    const state = setup(), operation = state.context.capture()
    expect(operation.current()).toBe(true)
    expect(operation.draftCurrent()).toBe(true)
    state.draft.value!.fields[0]!.label = 'Changed question'
    expect(operation.current()).toBe(true)
    expect(operation.draftCurrent()).toBe(false)
    expect(state.context.revision.value).toBe(0)
    state.scope.stop()
  })

  it.each(['account', 'access', 'session'])('does not revive a captured operation after same-tick %s restoration', change => {
    const state = setup(), operation = state.context.capture()
    if (change === 'access') { state.enabled.value = false; state.enabled.value = true }
    else { state.uid.value = change === 'session' ? '' : 'admin-b'; state.uid.value = 'admin-a' }
    expect(state.context.allowed.value).toBe(true)
    expect(state.context.revision.value).toBe(2)
    expect(operation.current()).toBe(false)
    expect(operation.draftCurrent()).toBe(false)
    expect(state.context.capture().current()).toBe(true)
    state.scope.stop()
  })

  it('invalidates an edited-then-reverted or replaced draft even when its value and ID match', () => {
    const state = setup(), edited = state.context.capture(), originalTitle = state.draft.value!.title
    state.draft.value!.title = 'Temporary'
    state.draft.value!.title = originalTitle
    expect(edited.draftCurrent()).toBe(false)
    const replaced = state.context.capture()
    state.draft.value = clone(state.draft.value!)
    expect(replaced.draftCurrent()).toBe(false)
    const cleared = state.context.capture()
    state.draft.value = undefined
    expect(cleared.draftCurrent()).toBe(false)
    state.scope.stop()
  })

  it('requires both UID and authorization and never enables an unauthorized capture later', () => {
    const state = setup()
    state.enabled.value = false
    const denied = state.context.capture()
    expect(state.context.allowed.value).toBe(false)
    expect(denied.current()).toBe(false)
    state.enabled.value = true
    expect(denied.current()).toBe(false)
    state.uid.value = ''
    expect(state.context.allowed.value).toBe(false)
    state.scope.stop()
  })

  it.each(['explicit', 'scope'])('disposes pending work through %s disposal without reviving it', method => {
    const state = setup(), operation = state.context.capture()
    if (method === 'explicit') state.context.dispose()
    else state.scope.stop()
    expect(state.context.allowed.value).toBe(false)
    expect(operation.current()).toBe(false)
    expect(operation.draftCurrent()).toBe(false)
    const revision = state.context.revision.value
    state.context.dispose()
    expect(state.context.revision.value).toBe(revision)
    expect(state.context.capture().current()).toBe(false)
    state.scope.stop()
  })
})
