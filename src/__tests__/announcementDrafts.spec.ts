
import { describe, expect, it } from 'vitest'
import { validateAnnouncementDrafts, validateSharedWidgets, defaultSharedWidgets } from '../../functions/src/sharedDashboardModel'
describe('unpublished announcement draft validation', () => {
  const entry = { id: 'draft', title: ' Update ', body: ' Message ' }
  it('preserves plain text and rejects shared layout placement', () => {
    expect(validateAnnouncementDrafts([entry])).toEqual([{ id: 'draft', title: 'Update', body: 'Message' }])
    expect(entry.title).toBe(' Update ')
    expect(validateAnnouncementDrafts([])).toEqual([])
    for (const scope of ['job', 'role'] as const)
      expect(() => validateSharedWidgets([...defaultSharedWidgets(scope), { id: 'drafts', type: 'announcement-drafts', title: '', text: '', span: 12 }], scope)).toThrow()
  })
  it('accepts both explicit audiences without assigning an audience to older drafts', () => {
    expect(validateAnnouncementDrafts([{...entry,audience:'everyone'}])[0]?.audience).toBe('everyone')
    expect(validateAnnouncementDrafts([{...entry,audience:'job',jobId:'job-a'}])[0]?.jobId).toBe('job-a')
    expect(validateAnnouncementDrafts([entry])[0]?.audience).toBeUndefined()
  })
  it.each([null, {}, [entry, entry], [{...entry, recipients: ['coworker']}], [{...entry, published: true}], [{...entry, audience: 'unknown'}], [{...entry, audience: 'job'}], [{...entry, audience: 'everyone', jobId: 'job-a'}], [{...entry, title: ' '}], [{...entry, body: ' '}], [{...entry, title: 'x'.repeat(201)}], [{...entry, body: 'x'.repeat(8001)}], [{...entry, id: '../other'}], Array.from({length: 26}, (_,i) => ({...entry,id:String(i)}))])('rejects invalid or publishing fields %#', value => {
    expect(() => validateAnnouncementDrafts(value)).toThrow()
  })
})
