import { validateFormAnswers, type FormDefinition, type FormAnswers, type FormField, type FormGroupInstance } from '../../../functions/src/formModel'
export function stableFormFingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical) :
    item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : item
  return JSON.stringify(canonical(value))
}
/** UI minimum rows are hydration defaults, not unsaved respondent edits. */
export function hydrateDraftAnswers(fields: FormField[], source: FormAnswers): FormAnswers {
  const answers = structuredClone(source)
  for (const field of fields) if (field.kind === 'repeat') {
    const existing = answers[field.id] as FormGroupInstance[] | undefined
    const instances = existing?.length ? existing : Array.from({ length: field.minInstances ?? 1 }, (_, index) => ({ instanceId: 'initial-' + index, answers: {} }))
    answers[field.id] = instances.map(instance => ({ ...instance, answers: hydrateDraftAnswers(field.fields || [], instance.answers) }))
  }
  return answers
}
export function answerFingerprint(definition: FormDefinition, answers: FormAnswers): string {
  try { return stableFormFingerprint(validateFormAnswers(definition, answers, false)) }
  catch { return stableFormFingerprint(answers) } // Invalid edits still need a warning.
}
