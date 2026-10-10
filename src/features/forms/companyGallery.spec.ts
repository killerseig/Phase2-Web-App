import { describe, expect, it } from 'vitest'
import { buildFormEmailHtml } from '../../../functions/src/formEmailRender'
import { completedAnswers } from './completedAnswers'
import type { FormRecord } from '../../../functions/src/formModel'
it('links repeat-stop thumbnails to the matching immutable private gallery row', () => {
  const record = {
    id: 'entry', ownerUid: 'owner', templateId: 'visit', templateVersion: 1,
    definition: { title: 'Visit', description: '', recipients: [], fields: [{ id: 'sites', kind: 'repeat', label: 'Site stop', required: false, options: [], fields: [{ id: 'photos', kind: 'photo', label: 'Photos', required: false, options: [] }] }] },
    answers: { sites: [{ instanceId: 'first', answers: { photos: ['one'] } }, { instanceId: 'second', answers: { photos: ['two'] } }] },
  } as unknown as FormRecord
  const rows = completedAnswers(record.definition.fields, record.answers)
  const html = buildFormEmailHtml(record, [{ fieldId: 'photos', groupId: 'sites', instanceId: 'second', position: 1, contentId: 'second-photo' }], 'https://example.test/form-submissions/entry')
  expect(html).toContain('#label-' + rows[0]!.key)
  expect(html).toContain('#label-' + rows[1]!.key)
  expect(html).toContain('cid:second-photo')
  expect(html).toContain('Submission and photo access is limited to authorized readers')
  expect(html).not.toContain('storage.googleapis.com')
})
