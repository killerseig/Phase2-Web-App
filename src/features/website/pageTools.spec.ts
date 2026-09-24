import { describe, expect, it } from 'vitest'
import {
  copyPage,
  copySection,
  pageFromTemplate,
  pageTemplates,
  type PageTemplate,
} from './pageTools'

describe('website page tools', () => {
  it('creates independent template pages with collision-free URLs', () => {
    for (const template of Object.keys(pageTemplates) as PageTemplate[]) {
      const first = pageFromTemplate(template, [])
      const second = pageFromTemplate(template, [first])
      expect(second.slug).toBe(`${template}-2`)
      expect(second.id).not.toBe(first.id)
      expect(second.sections[0]!.id).not.toBe(first.sections[0]!.id)
      expect(second.sections.length).toBeGreaterThan(0)
    }
  })
  it('copies nested content independently, reuses assets, and remaps self links', () => {
    const original = pageFromTemplate('projects', [])
    original.slug = 'home'
    const cards = original.sections[2]!
    cards.imageId = 'shared-image'
    cards.items[0]!.linkUrl = '/website'
    const copy = copyPage(original, [original])
    expect(copy.slug).toBe('home-copy')
    expect(copy.sections[2]!.imageId).toBe('shared-image')
    expect(copy.sections[2]!.items[0]!.linkUrl).toBe('/website/home-copy')
    expect(copy.sections[2]!.items[0]!.id).not.toBe(cards.items[0]!.id)
    copy.sections[2]!.items[0]!.title = 'Changed copy'
    expect(cards.items[0]!.title).toBe('Add your details')
    expect(copyPage(original, [original, copy]).slug).toBe('home-copy-2')
    const section = copySection(cards)
    section.items[0]!.title = 'Another change'
    expect(cards.items[0]!.title).toBe('Add your details')
  })
  it('keeps duplicate titles and URLs within server limits', () => {
    const original = pageFromTemplate('company', [])
    original.title = 'A'.repeat(100)
    original.slug = 'a'.repeat(64)
    const copy = copyPage(original, [original])
    expect(copy.title.length).toBeLessThanOrEqual(100)
    expect(copy.slug.length).toBeLessThanOrEqual(64)
    expect(copy.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
})
