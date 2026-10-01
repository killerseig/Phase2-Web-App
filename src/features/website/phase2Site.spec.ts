import { describe, expect, it } from 'vitest'
import { phase2Site } from './phase2Site'
import { withWebsiteDefaults } from './types'
import { publishingChecks } from './publishing'
import { validateWebsite, publishedWebsite } from '../../../functions/src/websiteModel'

const images = {
  logo: 'logo',
  interior: 'interior',
  architecture: 'architecture',
  finished: 'finished',
  planning: 'planning',
}

describe('editable Phase 2 website', () => {
  it('requires recipients only for the remaining Careers form', () => {
    const site = withWebsiteDefaults(phase2Site(images))
    const issues = () => publishingChecks(site).filter((issue) => issue.target === 'form-delivery')
    expect(issues().map((issue) => issue.message)).toEqual([
      'Careers: add an email recipient for the “Introduce yourself” form.',
    ])
    for (const issue of issues()) {
      const page = site.pages.find((page) => page.id === issue.pageId)!
      const form = page.sections.find((section) => section.id === issue.sectionId)!
      expect(form.type).toBe('form')
      expect(page.sections.find((section) => section.id === form.parentId)?.type).toBe('container')
    }
    site.forms!.find((form) => form.name === 'Introduce yourself')!.delivery!.to = [
      'careers@example.com',
    ]
    expect(issues()).toEqual([])
  })
  it('round trips all pages and shared widgets through the production schema', () => {
    const site = withWebsiteDefaults(phase2Site(images))
    const validated = validateWebsite(site)
    expect(validated.pages.map((p) => p.slug)).toEqual([
      'home',
      'company',
      'services',
      'location',
      'safety',
      'careers',
      'insights',
      'projects',
      'awards',
    ])
    expect(validated.pages.every((p) => p.useSiteLayout && p.layout?.desktop === 'flow')).toBe(true)
    expect(validated.sharedLayout!.sections.map((s) => s.type)).toEqual([
      'navigation',
      'page-content',
      'footer',
    ])
    expect(validated.css).toBe(site.css)
    expect(validated.pages.every((page) => !page.html && !page.js)).toBe(true)
    expect(
      validated.pages.every((page) => page.sections.some((section) => section.type === 'hero')),
    ).toBe(true)
    const sections = [
      ...validated.pages.flatMap((page) => page.sections),
      ...validated.sharedLayout!.sections,
    ]
    expect(sections.some((section) => section.type === 'custom')).toBe(false)
    expect(
      new Set(sections.filter((section) => section.imageId).map((section) => section.imageId)),
    ).toEqual(new Set(['interior', 'architecture', 'finished', 'planning']))
    expect(validated.forms!.map((form) => form.name)).toEqual(['Introduce yourself'])
    expect(JSON.stringify(validated)).not.toContain('/website/contact')
    // These forms must not be published until real recipients are configured.
    expect(() => publishedWebsite(validated)).toThrow(/recipient/)
    validated.forms!.forEach((form) => {
      form.delivery!.to = ['review@example.com']
    })
    const publicSite = publishedWebsite(validated)
    expect(publicSite.forms!.every((form) => form.delivery === undefined)).toBe(true)
    expect(publishingChecks(validated).filter((issue) => issue.level === 'error')).toEqual([])
  })
})
