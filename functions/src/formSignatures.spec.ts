import { describe, expect, it } from 'vitest'
import { parseFormSignature, stampFormSignatures, validateAttendeeHandoff } from './formSignatures'
import { validateFormAnswers, validateFormDefinition } from './formModel'
const ink = JSON.stringify({ strokes: [[[0.1, 0.2], [0.4, 0.6]]] })
const definition = validateFormDefinition({ title: 'Safety talk', description: '', recipients: [], fields: [{ id: 'attendees', label: 'Attendee', kind: 'repeat', required: true, options: [], sequential: true, minInstances: 1, maxInstances: 20, fields: [{ id: 'name', label: 'Attendee name', kind: 'text', options: [], required: true }, { id: 'signature', label: 'Signature', kind: 'signature', options: [], required: true }] }] })
const answers = (signature = ink, name = 'Synthetic attendee') => ({ attendees: [{ instanceId: 'attendee-1', answers: { name, signature } }] })
describe('private form signatures', () => {
  it('validates bounded numeric strokes, rejecting markup, malformed ink and empty taps', () => {
    expect(parseFormSignature(ink)?.strokes).toHaveLength(1)
    for (const value of ['<svg onload=bad()>', '{"strokes":[[[2,0],[0,1]]]}', '{"strokes":[[[0,0],[0,0]]]}', '{"strokes":[[[0,0],[0,1]]],"signedAt":-1}'])
      expect(() => parseFormSignature(value)).toThrow(/signature/i)
  })
  it('assigns server time, ignores client timestamps, and preserves the time on retry', () => {
    const forged = JSON.stringify({ ...parseFormSignature(ink), signedAt: 123 })
    const first = stampFormSignatures(definition, answers(forged), {}, 1000)
    const signed = (first.attendees as ReturnType<typeof answers>['attendees'])[0]!.answers.signature
    expect(parseFormSignature(signed)?.signedAt).toBe(1000)
    expect(stampFormSignatures(definition, answers(forged), first, 2000)).toEqual(first)
  })
  it('requires a complete attendee for handoff and prevents silently changing signed details', () => {
    expect(() => validateAttendeeHandoff(definition.fields, answers(), { groupId: 'attendees', instanceId: 'attendee-1' }, validateFormAnswers)).not.toThrow()
    expect(() => validateAttendeeHandoff(definition.fields, answers('', ''), { groupId: 'attendees', instanceId: 'attendee-1' }, validateFormAnswers)).toThrow('required')
    const first = stampFormSignatures(definition, answers(), {}, 1000)
    expect(() => stampFormSignatures(definition, answers(ink, 'Different name'), first, 2000)).toThrow('details changed')
  })
  it('drops only a completely empty next row and preserves existing generic repeat behavior', () => {
    const input = answers(); input.attendees.push({ instanceId: 'next', answers: { name: '', signature: '' } })
    expect((validateFormAnswers(definition, input, true).attendees as unknown[])).toHaveLength(1)
    input.attendees[1]!.answers.name = 'Unfinished attendee'
    expect(() => validateFormAnswers(definition, input, true)).toThrow('Signature is required')
    expect(() => validateFormAnswers(definition, { attendees: Array.from({ length: 21 }, (_, index) => ({ instanceId: 'empty-' + index, answers: {} })) }, false)).toThrow('permitted number')
  })
})
