import { describe, it, expect } from 'vitest'
import { nearMissSafetyObservation } from './model'
import {
  validateFormDefinition,
  validateFormAnswers,
  formAnswerSummary,
} from '../../../functions/src/formModel'

describe('canonical Near Miss starter and matrix', () => {
  it('preserves the nine questions, optional name and exactly two required questions', () => {
    const template = nearMissSafetyObservation()
    const definition = validateFormDefinition(template)
    expect(definition.fields.map((field) => field.id)).toEqual([
      'name',
      'job',
      'observation-date',
      'observation-type',
      'description',
      'resolved',
      'actions',
      'agreement',
      'comments',
    ])
    expect(definition.fields.filter((field) => field.required).map((field) => field.id)).toEqual([
      'job',
      'description',
    ])
    expect(definition.fields[0]?.label).toBe('OPTIONAL ANSWER   What is your Name?')
    expect(definition.fields.some((field) => field.kind === 'photo')).toBe(false)
    expect(definition.recipients).toEqual([])
    expect(template.versions).toEqual([])
    expect(definition.access?.identity).toBe('anonymous')
  })
  it('keeps optional matrix rows blank with no default choices', () => {
    const definition = validateFormDefinition(nearMissSafetyObservation())
    const answers = validateFormAnswers(definition, { job: 'A', description: 'Concern' }, true)
    expect(answers.agreement).toEqual(['', '', ''])
    expect(formAnswerSummary(definition.fields[7]!, answers.agreement)).toContain(
      'Safety training is adequate.: Not provided',
    )
    expect(
      validateFormAnswers(
        definition,
        { job: 'A', description: 'Concern', agreement: ['Agree', '', 'Neutral'] },
        true,
      ).agreement,
    ).toEqual(['Agree', '', 'Neutral'])
  })
  it('rejects malformed and unknown matrix selections', () => {
    const definition = validateFormDefinition(nearMissSafetyObservation())
    for (const agreement of [['Agree'], ['Agree', 'Unknown', ''], [['Agree', 'Neutral'], '', '']])
      expect(() =>
        validateFormAnswers(definition, { job: 'A', description: 'Concern', agreement }, true),
      ).toThrow()
  })
})
