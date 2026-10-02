import type { FormDefinition } from './formModel'
export interface FormOutputIssue {
  severity: 'error' | 'warning'
  message: string
}
export function formOutputIssues(definition: FormDefinition): FormOutputIssue[] {
  const template = definition.output?.template || ''
  if (!template) return []
  const ids = new Set(definition.fields.map((field) => field.id)),
    used = new Set<string>(),
    issues: FormOutputIssue[] = []
  for (const match of template.matchAll(/{{(.*?)}}/gs)) {
    const key = match[1]!.trim()
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(key) || !ids.has(key))
      issues.push({
        severity: 'error',
        message: 'Output placeholder refers to a nonexistent or deleted field: ' + key,
      })
    else used.add(key)
  }
  if (
    template.replace(/{{.*?}}/gs, '').includes('{{') ||
    template.replace(/{{.*?}}/gs, '').includes('}}')
  )
    issues.push({ severity: 'error', message: 'An output placeholder is incomplete.' })
  for (const field of definition.fields)
    if (!used.has(field.id))
      issues.push({
        severity: 'warning',
        message: 'Custom output omits ' + field.label + '. This may be deliberate.',
      })
  return issues
}
/** Plain text plus stable field-ID placeholders only; never evaluate expressions or HTML. */
export function renderFormOutputTemplate(
  definition: FormDefinition,
  literal: (value: string) => string,
  answer: (id: string) => string,
): string {
  const errors = formOutputIssues(definition).filter((issue) => issue.severity === 'error')
  if (errors.length) throw new Error(errors.map((issue) => issue.message).join(' '))
  const template = definition.output?.template || ''
  let result = '',
    position = 0
  for (const match of template.matchAll(/{{(.*?)}}/gs)) {
    result += literal(template.slice(position, match.index)) + answer(match[1]!.trim())
    position = match.index! + match[0].length
  }
  return result + literal(template.slice(position))
}
