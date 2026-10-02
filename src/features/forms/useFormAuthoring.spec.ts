import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { committeeAudit, newField, newTemplate, type FormTemplate } from './model'
import { useFormAuthoring } from './useFormAuthoring'
describe('form authoring history', () => {
  it('undo/redo restores deleted selection and properties without rewriting retained versions', async () => {
    const scope = effectScope(),
      draft = ref<FormTemplate>(committeeAudit()),
      dirty = ref(false)
    draft.value.versions = [
      { ...JSON.parse(JSON.stringify(draft.value)), version: 1, createdAt: '2026-10-01' },
    ]
    const versions = JSON.stringify(draft.value.versions)
    const history = scope.run(() => useFormAuthoring(draft, dirty))!
    history.reset()
    const id = draft.value.fields[0]!.id
    draft.value.fields.splice(0, 1)
    history.selection.value = draft.value.fields[0]!.id
    await nextTick()
    history.undo()
    await nextTick()
    expect(history.selection.value).toBe(id)
    expect(dirty.value).toBe(false)
    history.redo()
    await nextTick()
    expect(draft.value.fields.some((field) => field.id === id)).toBe(false)
    expect(JSON.stringify(draft.value.versions)).toBe(versions)
    scope.stop()
  })
  it('new edits after undo discard redo; selecting is not an authoring edit', async () => {
    const scope = effectScope(),
      draft = ref<FormTemplate>(newTemplate()),
      dirty = ref(false)
    const history = scope.run(() => useFormAuthoring(draft, dirty))!
    history.reset()
    const field = newField('radio')
    draft.value.fields.push(field)
    history.selection.value = field.id
    await nextTick()
    history.select(field.id)
    expect(history.canRedo.value).toBe(false)
    history.undo()
    await nextTick()
    expect(history.canRedo.value).toBe(true)
    draft.value.fields.push(newField('number'))
    await nextTick()
    expect(history.canRedo.value).toBe(false)
    history.saved()
    expect(dirty.value).toBe(false)
    history.undo()
    await nextTick()
    expect(dirty.value).toBe(true)
    scope.stop()
  })
  it('reset keeps legacy audit constraints/conditions and clears cross-template history', async () => {
    const scope = effectScope(),
      draft = ref<FormTemplate>(committeeAudit()),
      dirty = ref(false)
    const history = scope.run(() => useFormAuthoring(draft, dirty))!
    history.reset()
    const original = JSON.stringify(draft.value.fields)
    draft.value.title = 'Changed'
    await nextTick()
    history.undo()
    await nextTick()
    expect(JSON.stringify(draft.value.fields)).toBe(original)
    draft.value = newTemplate()
    history.reset(true)
    await nextTick()
    expect(history.canUndo.value).toBe(false)
    expect(history.selection.value).toBe('')
    scope.stop()
  })
})
