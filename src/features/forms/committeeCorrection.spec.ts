import { describe, expect, it } from 'vitest'
import { applyApprovedCommitteeCorrections, committeeFieldsToRemove } from './committeeCorrection'
import { reportingStarter } from './reportingStarters'
function oldDraft() {
  const draft = reportingStarter('committee')
  draft.fields.splice(4, 0, {
    id: 'committee-5',
    kind: 'text',
    label: 'Site Safety assistant',
    required: false,
    options: [],
  })
  draft.fields.splice(
    -2,
    0,
    { id: 'committee-20', kind: 'text', label: 'Signature', required: false, options: [] },
    { id: 'committee-21', kind: 'text', label: 'Date', required: false, options: [] },
  )
  draft.output = { pdf: true, requireLogin: true, template: '' }
  draft.recipients = ['approved@example.test']
  draft.versions = [{ ...structuredClone(draft), version: 1, createdAt: '2026-10-13T00:00:00Z' }]
  return draft
}
describe('explicit correction of existing Committee drafts', () => {
  it('removes exactly the approved obsolete fields and preserves every other draft property', () => {
    const draft = oldDraft(),
      before = structuredClone(draft)
    expect(committeeFieldsToRemove(draft)).toEqual(['committee-5', 'committee-20', 'committee-21'])
    const result = applyApprovedCommitteeCorrections(draft)
    const expected = structuredClone(before)
    expected.fields = expected.fields.filter(
      (field) => !['committee-5', 'committee-20', 'committee-21'].includes(field.id),
    )
    expect(result).toEqual(expected)
    expect(draft).toEqual(before)
    expect(result.fields.map((field) => field.label)).toContain('Date of Inspection')
    expect(result.output?.pdf).toBe(true)
    expect(result.access).toEqual(before.access)
    expect(result.recipients).toEqual(before.recipients)
  })
  it('retains published versions with their original questions and is idempotent', () => {
    const draft = oldDraft(),
      result = applyApprovedCommitteeCorrections(draft)
    expect(result.versions).toEqual(draft.versions)
    expect(result.versions[0]!.fields.some((field) => field.label === 'Signature')).toBe(true)
    expect(applyApprovedCommitteeCorrections(result)).toEqual(result)
    expect(committeeFieldsToRemove(result)).toEqual([])
  })
  it('never applies this correction to BBS or General Site Visit drafts', () => {
    for (const kind of ['bbs', 'general-visit'] as const) {
      const draft = reportingStarter(kind),
        before = structuredClone(draft)
      expect(committeeFieldsToRemove(draft)).toEqual([])
      expect(() => applyApprovedCommitteeCorrections(draft)).toThrow('Choose the Site Audit')
      expect(draft).toEqual(before)
    }
  })
})

it('does not guess that a custom Date/Signature question is an obsolete source field', () => {
  const draft = oldDraft()
  draft.fields.push({
    id: 'custom-date',
    kind: 'text',
    label: 'Date',
    required: false,
    options: [],
  })
  const result = applyApprovedCommitteeCorrections(draft)
  expect(result.fields.find((field) => field.id === 'custom-date')).toEqual(draft.fields.at(-1))
  expect(result.fields.find((field) => field.id === 'committee-21')).toBeUndefined()
})
