import { describe, expect, it } from 'vitest'
import { compilePageCss } from '../../../functions/src/websiteDesign'
import { polishPhase2Site } from './phase2Polish'
import { phase2Site } from './phase2Site'
import type { WebsiteSite } from './types'

describe('Phase 2 visual refinement', () => {
  it('retains editable records and unconfigured delivery while adding valid scoped styles', () => {
    const site: WebsiteSite = {
      name: 'Phase 2',
      accent: '#075486',
      pages: [],
      css: '.custom-existing { color: #122d3d; }',
    }
    const polished = polishPhase2Site(site)
    expect(polished.pages).toBe(site.pages)
    expect(site.css).toBe('.custom-existing { color: #122d3d; }')
    expect(polishPhase2Site(polished).css).toBe(polished.css)
    expect(
      polishPhase2Site({ ...site, css: polished.css! + polished.css! }).css!.split('58cqw'),
    ).toHaveLength(2)
    const compiled = compilePageCss(polished.css!, 'review')
    expect(compiled).toContain('focus-visible')
    expect(compiled).toContain('min-height:44px')
    expect(compiled).toContain('58cqw')
  })
  it('balances generated tablet groups without mutating editable content or identity', () => {
    const source = phase2Site({ logo: 'logo', interior: 'interior' })
    source.pages.forEach((page) =>
      page.sections.forEach((section) => {
        if (section.styleClass === 'custom-card-trio') section.styleClass = 'custom-card-row'
        if (section.styleClass === 'custom-resource-band')
          section.styleClass = 'custom-careers-band'
      }),
    )
    const original = structuredClone(source)
    const polished = polishPhase2Site(source)
    expect(source).toEqual(original)
    const content = (site: WebsiteSite) =>
      site.pages.map((page) => ({
        ...page,
        sections: page.sections.map(({ styleClass: _class, ...section }) => section),
      }))
    expect(content(polished)).toEqual(content(source))
    expect(
      polished.pages
        .flatMap((page) => page.sections)
        .filter((section) => section.styleClass === 'custom-card-trio').length,
    ).toBeGreaterThan(0)
    expect(
      polished.pages
        .find((page) => page.slug === 'safety')!
        .sections.some((section) => section.styleClass === 'custom-resource-band'),
    ).toBe(true)
    expect(polishPhase2Site(polished)).toEqual(polished)
    expect(compilePageCss(polished.css!, 'review')).toContain(
      '--child-basis:calc((100% - 40px) / 3)',
    )
  })
})
