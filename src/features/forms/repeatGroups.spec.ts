import { describe, it, expect } from 'vitest'
import {
  validateFormDefinition,
  validateFormAnswers,
  photoAnswerIds,
  formAnswerSummary,
  type FormDefinition,
} from '../../../functions/src/formModel'
const definition: FormDefinition = {
  title: 'Visit',
  description: '',
  recipients: [],
  fields: [
    { id: 'date', kind: 'date', label: 'Visit date', required: false, options: [] },
    {
      id: 'sites',
      kind: 'repeat',
      label: 'Site',
      required: false,
      options: [],
      minInstances: 1,
      maxInstances: 2,
      fields: [
        { id: 'site', kind: 'text', label: 'Site visited', required: true, options: [] },
        { id: 'photos', kind: 'photo', label: 'Photos', required: false, options: [] },
      ],
    },
  ],
}
describe('repeated form sites', () => {
  it('preserves ordered stable identities, answers and per-site photo IDs', () => {
    const schema = validateFormDefinition(definition)
    const answers = validateFormAnswers(
      schema,
      {
        sites: [
          { instanceId: 'stop-b', answers: { site: 'North', photos: ['photo-b'] } },
          { instanceId: 'stop-a', answers: { site: 'South', photos: ['photo-a'] } },
        ],
      },
      true,
    )
    expect(photoAnswerIds(schema, answers)).toEqual(['photo-b', 'photo-a'])
    expect(formAnswerSummary(schema.fields[1]!, answers.sites)).toContain(
      'Site 1: Site visited: North',
    )
  })
  it('rejects duplicate identities, missing groups, excess groups and unknown child fields', () => {
    expect(() => validateFormAnswers(definition, {}, true)).toThrow('number of groups')
    expect(() =>
      validateFormAnswers(
        definition,
        {
          sites: Array.from({ length: 3 }, (_, i) => ({
            instanceId: 's' + i,
            answers: { site: 'A' },
          })),
        },
        true,
      ),
    ).toThrow()
    expect(() =>
      validateFormAnswers(
        definition,
        {
          sites: [
            { instanceId: 'same', answers: { site: 'A' } },
            { instanceId: 'same', answers: { site: 'B' } },
          ],
        },
        true,
      ),
    ).toThrow('unique')
    expect(() =>
      validateFormAnswers(
        definition,
        { sites: [{ instanceId: 'one', answers: { site: 'A', injected: 'B' } }] },
        true,
      ),
    ).toThrow('Unknown')
  })
  it('enforces child required rules and disallows nested groups', () => {
    expect(() =>
      validateFormAnswers(definition, { sites: [{ instanceId: 'one', answers: {} }] }, true),
    ).toThrow('Site visited is required')
    expect(() =>
      validateFormDefinition({
        ...definition,
        fields: [{ ...definition.fields[1], fields: [definition.fields[1]] }],
      }),
    ).toThrow('cannot contain')
  })
  it('keeps legacy flat answers and validates optional email widgets', () => {
    expect(
      validateFormAnswers(
        { ...definition, fields: [definition.fields[0]!] },
        { date: '2026-10-08' },
        true,
      ),
    ).toEqual({ date: '2026-10-08' })
    const emails: FormDefinition = {
      ...definition,
      fields: [
        {
          id: 'extra',
          kind: 'recipients',
          label: 'Extra recipients',
          required: false,
          options: [],
        },
      ],
    }
    expect(
      validateFormAnswers(emails, { extra: ['Dan@example.com', 'dan@example.com'] }, true),
    ).toEqual({ extra: ['dan@example.com'] })
    expect(() => validateFormAnswers(emails, { extra: ['not-email'] }, true)).toThrow('email')
  })
})
