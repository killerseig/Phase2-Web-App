import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { keepVersion, moveGroupField, newField, newTemplate, type FormTemplate } from './model'
import { useFormAuthoring } from './useFormAuthoring'
import { validateFormDefinition } from '../../../functions/src/formModel'

describe('repeat and matrix authoring/version acceptance', () => {
  it('publishes a deep snapshot and preserves original rows, order, labels and photo questions after edits', () => {
    const draft = newTemplate('Generic inspection')
    const group = newField('repeat', 'Site')
    const matrix = newField('matrix', 'Assessment')
    group.fields!.push(matrix, newField('photo', 'Photos'))
    draft.fields.push(group)
    const issued = keepVersion(draft)
    const original = JSON.stringify(issued.versions[0])
    issued.fields[0]!.label = 'Renamed site'
    issued.fields[0]!.fields![1]!.rows![0]!.label = 'Changed statement'
    moveGroupField(issued.fields[0]!, issued.fields[0]!.fields![2]!.id, 0)
    expect(JSON.stringify(issued.versions[0])).toBe(original)
    expect(issued.versions[0]!.fields[0]!.fields!.map((field) => field.kind)).toEqual([
      'text',
      'matrix',
      'photo',
    ])
    expect(() => validateFormDefinition(issued)).not.toThrow()
  })
  it('undo/redo and saved state include nested matrix edits and group ordering', async () => {
    const scope = effectScope()
    const draft = ref<FormTemplate>(newTemplate('Generic'))
    const group = newField('repeat')
    group.fields!.push(newField('matrix'))
    draft.value.fields.push(group)
    const dirty = ref(false)
    const authoring = scope.run(() => useFormAuthoring(draft, dirty))!
    authoring.reset()
    const original = JSON.stringify(draft.value.fields)
    draft.value.fields[0]!.fields![1]!.rows![0]!.label = 'Edited statement'
    moveGroupField(draft.value.fields[0]!, draft.value.fields[0]!.fields![1]!.id, 0)
    await nextTick()
    expect(dirty.value).toBe(true)
    authoring.undo()
    await nextTick()
    expect(JSON.stringify(draft.value.fields)).toBe(original)
    authoring.redo()
    await nextTick()
    expect(draft.value.fields[0]!.fields![0]!.rows![0]!.label).toBe('Edited statement')
    authoring.saved()
    expect(dirty.value).toBe(false)
    scope.stop()
  })
})
