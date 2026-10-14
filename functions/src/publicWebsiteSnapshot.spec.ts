import { describe, expect, it } from 'vitest'
import { assertPublic, generatePublicPages, publicSnapshotJson, publicVersion, servePublicHtml } from './publicWebsiteSnapshot'
import type { WebsiteSite } from './websiteModel'
const site: WebsiteSite = { name: 'Public test', accent: '#174878', pages: [{ id: 'home', slug: 'home', title: 'Home', description: '', inNavigation: true, sections: [] }] }
describe('publish-time HTML boundary', () => {
  it('generates actual page markup only from sanitized public data and versions each publication', async () => {
    const generated = await generatePublicPages(site, 4, async (_, slug) => `<h1>${slug} content</h1>`)
    expect(generated.pages.home).toBe('<h1>home content</h1>')
    expect(generated.version).not.toBe(publicVersion(site, 5))
    const html = servePublicHtml(site, generated.version, 'home', generated.pages.home, '<html><head><title>Phase 2</title></head><body><div id="app"></div></body></html>')
    expect(html).toContain('<h1>home content</h1>')
    expect(html).toContain('data-public-prerender')
    expect(html).toContain('published-website-snapshot')
  })
  it('never serializes drafts, private delivery addresses, user/job records or hidden sections', () => {
    for (const data of [{ ...site, savedSections: [] }, { ...site, customWidgets: [] }, { ...site, userRecords: [] }, { ...site, jobRecords: [] }, { ...site, forms: [{ delivery: { to: ['private@example.invalid'] } }] }, { ...site, pages: [{ ...site.pages[0]!, sections: [{ hidden: true }] }] }]) expect(() => assertPublic(data as WebsiteSite)).toThrow()
    expect(() => assertPublic({ ...site, sharedLayout: site.pages[0] })).not.toThrow()
  })
  it('escapes embedded JSON and titles so content cannot break out of inert data or the title element', () => {
    const unsafe = { ...site, name: '</title><script>alert(1)</script>', pages: [{ ...site.pages[0]!, title: '</script><script>alert(1)</script>' }] }
    expect(publicSnapshotJson(unsafe, 'public-test')).not.toContain('</script>')
    const html = servePublicHtml(unsafe, 'public-test', 'home', '<h1>Safe</h1>', '<title>Phase 2</title><div id="app"></div>')
    expect(html).toContain('&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)')
  })
})
