import { describe, expect, it } from 'vitest'
import { compilePageCss } from '../../../functions/src/websiteDesign'
import { polishPhase2Site } from './phase2Polish'
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
    expect(polishPhase2Site({ ...site, css: polished.css! + polished.css! }).css!.split('58cqw')).toHaveLength(2)
    const compiled = compilePageCss(polished.css!, 'review')
    expect(compiled).toContain('focus-visible')
    expect(compiled).toContain('min-height:44px')
    expect(compiled).toContain('58cqw')
  })
})
