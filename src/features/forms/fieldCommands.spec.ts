import { describe, expect, it } from 'vitest'
import { clone, newField, newTemplate, type FormField } from './model'
import { captureFormField, countFormFields, planFieldPaste, planFieldReorder } from './fieldCommands'

function fixture() {
  const form = newTemplate(), rating = newField('radio', 'Rating'), notes = newField('textarea', 'Explain')
  notes.requiredWhen = { fieldId: rating.id, values: ['No'] }
  form.fields = [rating, notes]
  return { form, rating, notes }
}
function ids(fields: FormField[]): string[] {
  return fields.flatMap(field => [field.id, ...(field.rows || []).map(row => row.id), ...ids(field.fields || [])])
}

describe('selected form field commands', () => {
  it('captures a detached snapshot; repeated pastes insert after selection with fresh identities', () => {
    const { form, notes } = fixture(), snapshot = captureFormField(form, notes.id)!
    notes.label = 'Later edit'
    const result = planFieldPaste(form, snapshot, notes.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fields.at(-1)?.label).toBe('Explain')
    expect(result.fields[0]).toBe(form.fields[0])
    expect(form.fields).toHaveLength(2)
    const again = planFieldPaste({ ...form, fields: result.fields }, snapshot, result.selection)
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.fields).toHaveLength(4)
    expect(new Set(ids(again.fields)).size).toBe(ids(again.fields).length)
    expect(snapshot.field.id).toBe(notes.id)
  })

  it('remaps nested fields, matrix rows and internal conditions while preserving all authored properties', () => {
    const { form, rating, notes } = fixture(), matrix = newField('matrix', 'Inspection'), group = newField('repeat', 'Visits')
    Object.assign(notes, { hint: 'Explain carefully', section: 'Findings', required: true })
    group.fields = [rating, notes, matrix]
    group.minInstances = 2; group.maxInstances = 8
    form.fields = [group]
    form.versions = [{ ...clone(form), version: 1, createdAt: '2026-11-07' }]
    const before = JSON.stringify(form), result = planFieldPaste(form, captureFormField(form, group.id)!, group.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const copy = result.fields[1]!
    expect(copy).toMatchObject({ minInstances: 2, maxInstances: 8, label: 'Visits' })
    expect(copy.fields![1]).toMatchObject({ hint: 'Explain carefully', section: 'Findings', required: true, requiredWhen: { fieldId: copy.fields![0]!.id, values: ['No'] } })
    expect(copy.fields![2]!.rows![0]!.id).not.toBe(matrix.rows![0]!.id)
    expect(ids(copy.fields!)).not.toEqual(ids(group.fields!))
    expect(JSON.stringify(form)).toBe(before)
    copy.fields![1]!.requiredWhen!.values.push('Yes')
    expect(notes.requiredWhen!.values).toEqual(['No'])
  })

  it('retains compatible same-form external conditions and rejects unresolved or cross-form sources', () => {
    const { form, rating, notes } = fixture(), snapshot = captureFormField(form, notes.id)!
    const result = planFieldPaste(form, snapshot)
    expect(result.ok && result.fields.at(-1)!.requiredWhen).toEqual(notes.requiredWhen)
    expect(planFieldPaste({ ...form, id: 'another-form' }, snapshot)).toMatchObject({ ok: false, error: expect.stringContaining('condition') })
    rating.options = ['Excellent', 'Fair']
    expect(planFieldPaste(form, snapshot).ok).toBe(false)
    rating.options = ['Yes', 'No']; rating.kind = 'multiselect'
    expect(planFieldPaste(form, snapshot).ok).toBe(false)
    form.fields = [notes]
    expect(planFieldPaste(form, snapshot).ok).toBe(false)
  })

  it('allows portable nested conditions in another form but rejects a broken nested source', () => {
    const { form, rating, notes } = fixture(), group = newField('repeat')
    group.fields = [rating, notes]; form.fields = [group]
    expect(planFieldPaste(newTemplate(), captureFormField(form, group.id)!).ok).toBe(true)
    group.fields = [notes]
    expect(planFieldPaste(newTemplate(), captureFormField(form, group.id)!).ok).toBe(false)
  })

  it('enforces 60 total fields including group children without partial insertion', () => {
    const form = newTemplate(), group = newField('repeat')
    form.fields = Array.from({ length: 58 }, () => newField('text'))
    const source = { ...form, fields: [group] }, snapshot = captureFormField(source, group.id)!
    const allowed = planFieldPaste(form, snapshot)
    expect(allowed.ok && countFormFields(allowed.fields)).toBe(60)
    form.fields.push(newField('text'))
    const before = JSON.stringify(form)
    expect(planFieldPaste(form, snapshot)).toMatchObject({ ok: false, error: expect.stringContaining('60') })
    expect(JSON.stringify(form)).toBe(before)
  })

  it('rejects ambiguous duplicate source identifiers in a group', () => {
    const form = newTemplate(), group = newField('repeat'), child = newField('text')
    group.fields = [child, clone(child)]; form.fields = [group]
    expect(planFieldPaste(form, captureFormField(form, group.id)!)).toMatchObject({ ok: false, error: expect.stringContaining('identifiers') })
  })

  it('rejects stale selection rather than silently choosing another insertion point', () => {
    const { form, notes } = fixture()
    expect(captureFormField(form, 'missing')).toBeUndefined()
    expect(planFieldPaste(form, captureFormField(form, notes.id)!, 'missing').ok).toBe(false)
  })

  it('moves one field without changing nested identities, conditions or the source array', () => {
    const { form, rating, notes } = fixture(), before = JSON.stringify(form)
    const result = planFieldReorder(form, notes.id, 0)
    expect(result).toEqual({ ok: true, fields: [notes, rating], selection: notes.id, changed: true })
    expect(JSON.stringify(form)).toBe(before)
    expect(result.ok && result.fields[0]).toBe(notes)
  })

  it('reports reorder no-ops and rejects missing, fractional and out-of-range targets', () => {
    const { form, rating } = fixture()
    expect(planFieldReorder(form, rating.id, 0)).toMatchObject({ ok: true, changed: false })
    for (const at of [-1, 2, 0.5, NaN]) expect(planFieldReorder(form, rating.id, at).ok).toBe(false)
    expect(planFieldReorder(form, 'missing', 0).ok).toBe(false)
  })
})
