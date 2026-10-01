import { describe, expect, it, vi } from 'vitest'
import { starterFromDraft, backupBeforeStarter } from './starterImport'
import { phase2Site } from './phase2Site'
import { publishingChecks } from './publishing'
import { validateWebsite, publishedWebsite } from '../../../functions/src/websiteModel'

describe('owner-controlled starter import', () => {
  it('keeps the source untouched, reuses existing image IDs and disables unconfigured Careers', () => {
    const source = phase2Site({ logo: 'existing-logo', interior: 'existing-photo' })
    source.savedSections = [{ id: 'owner-widget', name: 'Owner widget', sections: [source.pages[0]!.sections[0]!] }]
    source.forms!.push({ ...structuredClone(source.forms![0]!), id: 'owner-inquiry', name: 'Owner inquiry' })
    const before = JSON.stringify(source)
    const starter = starterFromDraft(source)
    expect(JSON.stringify(source)).toBe(before)
    expect(starter.savedSections).toEqual(source.savedSections)
    expect(starter.savedSections![0]).not.toBe(source.savedSections![0])
    expect(starter.forms!.some(form => form.id === 'owner-inquiry')).toBe(true)
    expect(starter.pages).toHaveLength(9)
    expect(starter.branding!.logoId).toBe('existing-logo')
    expect(starter.pages.flatMap(p => p.sections).filter(s => s.type === 'form').every(s => s.hidden)).toBe(true)
    expect(publishingChecks(starter).filter(issue => issue.target === 'form-delivery')).toEqual([])
    expect(() => publishedWebsite(validateWebsite(starter))).not.toThrow()
  })
  it('makes a verified independently keyed backup before any replacement', () => {
    const source = phase2Site({ logo: '', interior: '' })
    const first = backupBeforeStarter(localStorage, 'project:owner', source, 7, 'saved')
    const second = backupBeforeStarter(localStorage, 'project:owner', source, 7, 'saved')
    expect(first.key).not.toBe(second.key)
    expect(JSON.parse(localStorage.getItem(first.key)!)).toMatchObject({ draft: JSON.parse(JSON.stringify(source)), version: 7, saved: 'saved', manualSave: true })
    expect(() => backupBeforeStarter({ setItem: vi.fn(() => { throw new Error('quota') }) } as unknown as Storage, 'project:owner', source, 7, 'saved')).toThrow('quota')
    expect(() => backupBeforeStarter({ setItem: vi.fn(), getItem: () => null } as unknown as Storage, 'project:owner', source, 7, 'saved')).toThrow('verified')
  })
})
