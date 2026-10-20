import { clone, type FormDefinition } from './model'
const committeeTitle = 'site audit for committee members'
const obsoleteFields: Record<string, string> = {
  'committee-5': 'site safety assistant',
  'committee-20': 'signature',
  'committee-21': 'date',
}
/** Explicit draft-only correction; never rewrite published versions or completed responses. */
export function committeeFieldsToRemove(definition: FormDefinition): string[] {
  if (definition.title.trim().toLowerCase() !== committeeTitle) return []
  return definition.fields
    .filter((field) => obsoleteFields[field.id] === field.label.trim().toLowerCase())
    .map((field) => field.id)
}
export function applyApprovedCommitteeCorrections<T extends FormDefinition>(definition: T): T {
  if (definition.title.trim().toLowerCase() !== committeeTitle)
    throw new Error(
      'Choose the Site Audit for Committee Members draft before applying these corrections.',
    )
  const next = clone(definition)
  const removed = new Set(committeeFieldsToRemove(definition))
  next.fields = next.fields.filter((field) => !removed.has(field.id))
  return next
}
