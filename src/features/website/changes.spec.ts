// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareWebsites } from '../../../functions/src/websiteChanges'
import {
  initialWebsite,
  publishedWebsite,
  validateWebsite,
} from '../../../functions/src/websiteModel'
import { newSection } from './types'

describe('website comparisons', () => {
  it('matches widgets by ID, reports moves separately and leaves inputs intact', () => {
    const before = {
      pages: [
        {
          id: 'home',
          title: 'Home',
          sections: [
            { id: 'a', title: 'Heading', text: 'Before' },
            { id: 'b', title: 'Photo' },
          ],
        },
      ],
    }
    const after = structuredClone(before)
    after.pages[0]!.sections.reverse()
    after.pages[0]!.sections[1]!.text = 'After'
    const original = JSON.stringify(before)
    const result = compareWebsites(before, after)
    expect(result.total).toBe(2)
    expect(result.changes).toContainEqual({
      path: 'Pages / Home / Widgets / Heading / Text',
      kind: 'changed',
      before: 'Before',
      after: 'After',
    })
    expect(result.changes[0]!.path).toContain('Order')
    expect(JSON.stringify(before)).toBe(original)
    expect(compareWebsites({ a: 1, b: 2 }, { b: 2, a: 1 }).total).toBe(0)
  })
  it('reports additions and removals without claiming later widgets moved', () => {
    const before = {
      sections: [
        { id: 'a', title: 'Old' },
        { id: 'b', title: 'Keep' },
      ],
    }
    const after = {
      sections: [
        { id: 'b', title: 'Keep' },
        { id: 'c', title: 'New' },
      ],
    }
    expect(compareWebsites(before, after).changes.map((change) => change.kind)).toEqual([
      'removed',
      'added',
    ])
    expect(compareWebsites(undefined, after).total).toBeGreaterThan(0)
  })
  it('compares publishable output without hidden content and private preset libraries', () => {
    const site = initialWebsite()
    site.pages[0]!.sections = [newSection('hero'), { ...newSection('text'), hidden: true }]
    site.theme = { bodyFont: 'Inter' }
    const before = publishedWebsite(validateWebsite(site))
    site.pages[0]!.sections[1]!.text = 'Private draft'
    site.theme.presets = [{ name: 'Private preset', accent: '#00437f', theme: { bodyFont: 'Lora' } }]
    expect(compareWebsites(before, publishedWebsite(validateWebsite(site))).total).toBe(0)
    site.pages[0]!.sections[0]!.title = 'Revised heading'
    const result = compareWebsites(before, publishedWebsite(validateWebsite(site)))
    expect(result.total).toBe(1)
    expect(result.changes[0]!.after).toBe('Revised heading')
  })
  it('bounds reports and previews without losing the real change count', () => {
    const after = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => ['key' + index, 'a'.repeat(500)]),
    )
    const result = compareWebsites({}, after)
    expect(result.total).toBe(200)
    expect(result.changes).toHaveLength(150)
    expect(result.changes[0]!.after).toContain('(shortened)')
  })
})
