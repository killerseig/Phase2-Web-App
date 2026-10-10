import type { FormField, FormAnswers } from '../../../functions/src/formModel'
import { formAnswerSummary } from '../../../functions/src/formModel'
export interface CompletedAnswer {
  key: string
  label: string
  group: string
  value: string
  photos: string[]
}
export function completedAnswers(
  fields: FormField[],
  answers: FormAnswers,
  prefix = '',
  group = '',
): CompletedAnswer[] {
  return fields.flatMap((field) => {
    if (field.kind === 'matrix')
      return (field.rows || []).map((row, index) => ({
        key: prefix + field.id + '/' + row.id,
        label: field.label + ': ' + row.label,
        group,
        value: ((answers[field.id] || []) as string[])[index] || 'Not provided',
        photos: [],
      }))
    if (field.kind === 'repeat')
      return ((answers[field.id] || []) as { instanceId: string; answers: FormAnswers }[]).flatMap(
        (instance, index) =>
          completedAnswers(
            field.fields || [],
            instance.answers,
            prefix + field.id + '/' + instance.instanceId + '/',
            field.label + ' ' + (index + 1),
          ),
      )
    return [
      {
        key: prefix + field.id,
        label: field.label,
        group,
        value: formAnswerSummary(field, answers[field.id]),
        photos: field.kind === 'photo' ? ((answers[field.id] || []) as string[]) : [],
      },
    ]
  })
}
