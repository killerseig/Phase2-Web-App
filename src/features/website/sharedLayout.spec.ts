import { describe, expect, it } from 'vitest'
import {
  parseWebsiteHtml,
  reconcileWebsiteHtml,
  websiteHtmlTemplate,
  validateJavascript,
} from '../../../functions/src/websiteLayout'
import { copyPage } from './pageTools'
import { newSection, type WebsitePage } from './types'
describe('shared layout HTML', () => {
  it('keeps wrappers while reconciling visual reorders, additions and removals', () => {
    const html =
      '<header><website-widget id="nav"></website-widget></header><page-content></page-content><website-widget id="footer"></website-widget>'
    const moved = reconcileWebsiteHtml(
      html,
      ['nav', 'slot', 'footer'],
      ['footer', 'slot', 'nav', 'new'],
      'slot',
    )
    expect(moved).toContain('<header><website-widget id="footer"></website-widget></header>')
    expect(parseWebsiteHtml(moved, ['footer', 'nav', 'new'], true)).toHaveLength(5)
    expect(
      parseWebsiteHtml(
        '<button class="custom-action" type="button">Click</button><input type="text" name="value">',
        [],
        false,
      ),
    ).toHaveLength(2)
  })
  it('retains visual widget identities and a single shared content slot inside HTML wrappers', () => {
    const html =
      '<header class="custom-header"><website-widget id="nav"></website-widget></header><main><page-content></page-content></main><website-widget id="footer"></website-widget>'
    expect(parseWebsiteHtml(html, ['nav', 'footer'], true)[1]?.children?.[0]).toEqual({
      content: true,
    })
    expect(websiteHtmlTemplate(['nav', 'slot', 'footer'], 'slot')).toContain(
      '<page-content></page-content>',
    )
  })
  it('rejects missing, duplicate, nested-invalid, executable and unsupported references', () => {
    for (const html of [
      '<page-content></page-content>',
      '<website-widget id="other"></website-widget><page-content></page-content>',
      '<website-widget id="nav"></website-widget><website-widget id="nav"></website-widget><page-content></page-content>',
      '<div><website-widget id="nav"></website-widget><page-content></page-content>',
      '<script>alert(1)</script>',
      '<div onclick="alert(1)"></div>',
      '<iframe></iframe>',
    ]) {
      expect(() => parseWebsiteHtml(html, ['nav'], true)).toThrow()
    }
    expect(() => parseWebsiteHtml('<page-content></page-content>', [], false)).toThrow()
    expect(() => validateJavascript('x'.repeat(20001))).toThrow()
  })
  it('copies page HTML references without modifying the source', () => {
    const section = newSection('text')
    const page: WebsitePage = {
      id: 'home',
      title: 'Home',
      slug: 'home',
      description: '',
      inNavigation: true,
      sections: [section],
      html: websiteHtmlTemplate([section.id]),
      js: 'window.pageLoaded = true',
      useSiteLayout: true,
    }
    const copy = copyPage(page, [page])
    expect(copy.html).toContain(copy.sections[0]!.id)
    expect(copy.html).not.toContain(section.id)
    expect(page.html).toContain(section.id)
    expect(copy.useSiteLayout).toBe(true)
  })
})
