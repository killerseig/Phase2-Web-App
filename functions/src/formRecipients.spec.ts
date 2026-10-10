import { describe, expect, it } from 'vitest'
import { resolveRecipientEmails } from './formRecipients'
import type { FormDefinition } from './formModel'

const definition = (groups: FormDefinition['recipientGroups'] = []): FormDefinition => ({
  title: 'Report',
  description: '',
  recipients: ['Fixed@example.com'],
  recipientGroups: groups,
  fields: [
    { id: 'sendTo', kind: 'recipients', label: 'Email results', required: false, options: [] },
  ],
})
const users = [
  { uid: 'f1', role: 'foreman', email: 'Foreman@example.com', active: true },
  { uid: 'pm', role: 'project-manager', email: 'PM@example.com', assignedJobIds: ['j1'] },
  { uid: 'other', role: 'admin', email: 'other@example.com', assignedJobIds: ['j2'] },
  {
    uid: 'inactive',
    role: 'foreman',
    email: 'inactive@example.com',
    active: false,
    assignedJobIds: ['j1'],
  },
  { uid: 'assigned', role: 'payroll', email: 'assigned@example.com', assignedJobIds: ['j1'] },
]
describe('form notification recipient resolution', () => {
  it('combines fixed, respondent and actual job assignees once without granting readers', () => {
    const result = resolveRecipientEmails(
      definition(['job-everyone']),
      { sendTo: ['FIXED@EXAMPLE.COM', 'extra@example.com'] },
      { id: 'j1', assignedForemanIds: ['f1'] },
      users,
    )
    expect(result).toEqual([
      'fixed@example.com',
      'foreman@example.com',
      'pm@example.com',
      'assigned@example.com',
      'extra@example.com',
    ])
    expect(users[2]?.assignedJobIds).toEqual(['j2'])
  })
  it('does not fall back to all company users without a valid job', () => {
    expect(() => resolveRecipientEmails(definition(['job-everyone']), {}, null, users)).toThrow(
      'valid job',
    )
    expect(resolveRecipientEmails(definition(), {}, null, users)).toEqual(['fixed@example.com'])
  })
  it('selects project managers and foremen using role and actual assignment', () => {
    expect(
      resolveRecipientEmails(definition(['job-project-managers']), {}, { id: 'j1' }, users),
    ).toEqual(['fixed@example.com', 'pm@example.com'])
    expect(
      resolveRecipientEmails(
        definition(['job-foremen']),
        {},
        { id: 'j1', assignedForemanIds: ['f1', 'other'] },
        users,
      ),
    ).toEqual(['fixed@example.com', 'foreman@example.com'])
  })
  it('rejects malformed and over-limit respondent addresses across repeated instances', () => {
    expect(() =>
      resolveRecipientEmails(definition(), { sendTo: ['bad\n@example.com'] }, null, []),
    ).toThrow('Invalid recipient')
    expect(() =>
      resolveRecipientEmails(
        definition(),
        { sendTo: Array.from({ length: 11 }, (_, i) => `e${i}@example.com`) },
        null,
        [],
      ),
    ).toThrow('At most 10')
    const repeated = definition()
    repeated.fields = [
      {
        id: 'stops',
        kind: 'repeat',
        label: 'Stops',
        required: false,
        options: [],
        fields: repeated.fields,
      },
    ]
    expect(
      resolveRecipientEmails(
        repeated,
        { stops: [{ instanceId: 's1', answers: { sendTo: ['first@example.com'] } }] },
        null,
        [],
      ),
    ).toEqual(['fixed@example.com', 'first@example.com'])
  })
  it('fails closed instead of silently truncating an oversized notification group', () => {
    const large = Array.from({ length: 101 }, (_, i) => ({
      uid: `u${i}`,
      email: `u${i}@example.com`,
      assignedJobIds: ['j1'],
    }))
    expect(() =>
      resolveRecipientEmails(definition(['job-everyone']), {}, { id: 'j1' }, large),
    ).toThrow('Too many')
  })
  it('retains public extra-address answers while notifying only admin-approved recipients', () => {
    const answers = { sendTo: ['external@example.com'] }
    expect(
      resolveRecipientEmails(definition(), answers, null, [], { publicRespondent: true }),
    ).toEqual(['fixed@example.com'])
    expect(answers.sendTo).toEqual(['external@example.com'])
  })
  it('adds only exact recipient addresses whose ownership was verified for this public draft', () => {
    expect(
      resolveRecipientEmails(
        definition(),
        { sendTo: ['approved@example.com', 'unverified@example.com'] },
        null,
        [],
        { publicRespondent: true, verifiedEmails: ['approved@example.com'] },
      ),
    ).toEqual(['fixed@example.com', 'approved@example.com'])
  })
})
