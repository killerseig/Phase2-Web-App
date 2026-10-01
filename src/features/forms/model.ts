import { validateFormDefinition } from '../../../functions/src/formModel'
import auditDefinition from '../../../functions/src/committeeAudit.json'
import type {
  FormFieldKind,
  FormField,
  FormDefinition,
  FormVersion,
} from '../../../functions/src/formModel'
export type {
  FormFieldKind,
  FormField,
  FormDefinition,
  FormVersion,
} from '../../../functions/src/formModel'
export interface FormTemplate extends FormDefinition {
  id: string
  archived: boolean
  versions: FormVersion[]
}
export interface FormLibrary {
  schema: 1
  revision: number
  templates: FormTemplate[]
}
export const fieldKinds: FormFieldKind[] = ['text', 'textarea', 'date', 'number', 'choice', 'photo']
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const emptyLibrary = (): FormLibrary => ({ schema: 1, revision: 0, templates: [] })
export function newField(kind: FormFieldKind, label = 'New field'): FormField {
  return {
    id: crypto.randomUUID(),
    kind,
    label,
    required: false,
    options: kind === 'choice' ? ['Yes', 'No'] : [],
  }
}
export function newTemplate(title = 'Untitled form'): FormTemplate {
  return {
    id: crypto.randomUUID(),
    title,
    description: '',
    fields: [],
    recipients: [],
    archived: false,
    versions: [],
  }
}
export function committeeAudit(): FormTemplate {
  return {
    ...clone(auditDefinition as FormDefinition),
    id: crypto.randomUUID(),
    archived: false,
    versions: [],
  }
}
export function definitionErrors(definition: FormDefinition): string[] {
  const errors: string[] = []
  if (!definition.title.trim() || definition.title.length > 160)
    errors.push('Enter a form title of 1–160 characters.')
  if (!definition.fields.length || definition.fields.length > 60)
    errors.push('Add between 1 and 60 fields.')
  if (new Set(definition.fields.map((field) => field.id)).size !== definition.fields.length)
    errors.push('Field identifiers must be unique.')
  for (const field of definition.fields) {
    if (!field.label.trim() || field.label.length > 160 || !fieldKinds.includes(field.kind))
      errors.push('Every field needs a valid type and label of 1–160 characters.')
    if (
      field.kind === 'choice' &&
      (field.options.length < 2 ||
        field.options.length > 30 ||
        field.options.some((option) => !option.trim()) ||
        new Set(field.options).size !== field.options.length)
    )
      errors.push('Choice fields need 2–30 different non-empty options.')
  }
  if (
    definition.recipients.length > 20 ||
    definition.recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )
    errors.push('Use up to 20 valid recipient email addresses.')
  try {
    validateFormDefinition(definition)
  } catch (caught) {
    if (!errors.length) errors.push((caught as Error).message)
  }
  return [...new Set(errors)]
}
export function keepVersion(template: FormTemplate): FormTemplate {
  const errors = definitionErrors(template)
  if (errors.length) throw new Error(errors.join(' '))
  const next = clone(template)
  const { title, description, fields, recipients } = next
  next.versions.push({
    title,
    description,
    fields: clone(fields),
    recipients: [...recipients],
    version: (next.versions.at(-1)?.version || 0) + 1,
    createdAt: new Date().toISOString(),
  })
  return next
}
export function duplicateTemplate(template: FormTemplate): FormTemplate {
  const next = clone(template)
  next.id = crypto.randomUUID()
  next.title += ' (copy)'
  next.archived = false
  next.versions = []
  const ids = new Map(next.fields.map((field) => [field.id, crypto.randomUUID()]))
  next.fields.forEach((field) => {
    field.id = ids.get(field.id)!
    if (field.requiredWhen) field.requiredWhen.fieldId = ids.get(field.requiredWhen.fieldId)!
  })
  return next
}
export function removeOrArchive(library: FormLibrary, id: string): FormLibrary {
  const next = clone(library)
  const template = next.templates.find((item) => item.id === id)
  if (!template) return next
  if (template.versions.length) template.archived = true
  else next.templates = next.templates.filter((item) => item.id !== id)
  return next
}
export function moveField(template: FormTemplate, id: string, target: number): void {
  const index = template.fields.findIndex((field) => field.id === id)
  if (index < 0 || target < 0 || target >= template.fields.length || index === target) return
  const [field] = template.fields.splice(index, 1)
  template.fields.splice(target, 0, field!)
}
