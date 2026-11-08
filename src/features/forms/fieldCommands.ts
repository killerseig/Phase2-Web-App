import { clone, type FormField, type FormTemplate } from './model'

export interface FormFieldClipboard {
  sourceTemplateId: string
  field: FormField
}
export type FieldCommandPlan =
  | { ok: true; fields: FormField[]; selection: string; changed: boolean }
  | { ok: false; error: string }

export function countFormFields(fields: FormField[]): number {
  return fields.reduce((count, field) => count + 1 + countFormFields(field.fields || []), 0)
}

export function captureFormField(form: FormTemplate, id: string): FormFieldClipboard | undefined {
  const field = form.fields.find(item => item.id === id)
  return field ? { sourceTemplateId: form.id, field: clone(field) } : undefined
}

// Conditions are scoped to their sibling fields, as in the published schema.
// A copied group owns its internal sources; a lone conditional note does not.
function conditionSourceValid(field: FormField, source: FormField | undefined) {
  const condition = field.requiredWhen
  return !condition || (!!source && ['choice', 'radio'].includes(source.kind) &&
    ['text', 'textarea'].includes(field.kind) && condition.values.length > 0 &&
    condition.values.every(value => source.options.includes(value)))
}

export function planFieldPaste(
  form: FormTemplate,
  clipboard: FormFieldClipboard,
  afterId?: string,
): FieldCommandPlan {
  const after = afterId ? form.fields.findIndex(field => field.id === afterId) : form.fields.length - 1
  if (afterId && after < 0) return { ok: false, error: 'Select a field in this form before pasting.' }
  if (countFormFields(form.fields) + countFormFields([clipboard.field]) > 60)
    return { ok: false, error: 'Use up to 60 fields, including fields inside groups.' }

  const occupied = new Set<string>()
  function collect(fields: FormField[]) {
    for (const field of fields) {
      occupied.add(field.id)
      field.rows?.forEach(row => occupied.add(row.id))
      collect(field.fields || [])
    }
  }
  collect(form.fields)
  collect([clipboard.field])
  function freshId() {
    let id = crypto.randomUUID()
    while (occupied.has(id)) id = crypto.randomUUID()
    occupied.add(id)
    return id
  }
  let invalidCondition = false
  let invalidIds = false
  function copyScope(sourceFields: FormField[], external: FormField[]): FormField[] {
    if (new Set(sourceFields.map(field => field.id)).size !== sourceFields.length) invalidIds = true
    const mapping = new Map(sourceFields.map(field => [field.id, freshId()]))
    const fields = clone(sourceFields)
    for (const field of fields) {
      field.id = mapping.get(field.id)!
      field.rows?.forEach(row => { row.id = freshId() })
      if (field.requiredWhen) {
        const sourceId = field.requiredWhen.fieldId
        const source = sourceFields.find(item => item.id === sourceId) || external.find(item => item.id === sourceId)
        if (!conditionSourceValid(field, source)) invalidCondition = true
        field.requiredWhen.fieldId = mapping.get(sourceId) || sourceId
      }
      if (field.fields) field.fields = copyScope(field.fields, [])
    }
    return fields
  }
  const [copy] = copyScope([clipboard.field], clipboard.sourceTemplateId === form.id ? form.fields : [])
  if (invalidIds) return { ok: false, error: 'This group has duplicate field identifiers. Repair the source before copying it.' }
  if (invalidCondition)
    return { ok: false, error: 'Cannot paste this field because its required-note condition is unavailable or changed. Copy its whole group, or update the source field and copy again.' }
  const fields = [...form.fields]
  fields.splice(after + 1, 0, copy!)
  return { ok: true, fields, selection: copy!.id, changed: true }
}

export function planFieldReorder(form: FormTemplate, id: string, target: number): FieldCommandPlan {
  const from = form.fields.findIndex(field => field.id === id)
  if (from < 0 || !Number.isInteger(target) || target < 0 || target >= form.fields.length)
    return { ok: false, error: 'Choose a field and a position within this form.' }
  if (from === target) return { ok: true, fields: form.fields, selection: id, changed: false }
  const fields = [...form.fields]
  const [field] = fields.splice(from, 1)
  fields.splice(target, 0, field!)
  return { ok: true, fields, selection: id, changed: true }
}
