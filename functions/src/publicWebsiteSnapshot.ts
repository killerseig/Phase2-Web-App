import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { WebsiteSite } from './websiteModel'
import { publicPageUrl } from './publicWebsiteRoutes'
export interface PublishedRepresentation { version: string; site: WebsiteSite; pages: Record<string, string> }
let rendererId: string | undefined
export function publicRendererId() {
  return rendererId ||= createHash('sha256').update(readFileSync(path.join(__dirname, '../generated/publicWebsiteRenderer.cjs'))).digest('hex').slice(0, 16)
}
export function assertPublic(site: WebsiteSite) {
  const allowed = new Set(['name', 'accent', 'pages', 'sharedLayout', 'css', 'js', 'theme', 'forms', 'branding'])
  if (Object.entries(site).some(([key, value]) => value !== undefined && !allowed.has(key)) || site.savedSections || site.customWidgets || site.theme?.presets || site.forms?.some(form => form.delivery)) throw new Error('Only sanitized published content can be generated.')
  if (!Array.isArray(site.pages) || [...site.pages, ...(site.sharedLayout ? [site.sharedLayout] : [])].some(page => page.sections.some(section => section.hidden))) throw new Error('Hidden/draft sections cannot be generated.')
}
export function publicVersion(site: WebsiteSite, revision: number) {
  assertPublic(site)
  return `public-${revision}-${createHash('sha256').update(JSON.stringify(site)).digest('hex').slice(0,16)}`
}
export function publicSnapshotJson(site: WebsiteSite, version: string) {
  assertPublic(site)
  return JSON.stringify({ site, version }).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}
export async function generatePublicPages(site: WebsiteSite, revision: number, renderer?: (site: WebsiteSite, slug: string, version: string) => Promise<string>, existingVersion?: string): Promise<PublishedRepresentation> {
  assertPublic(site)
  const version = existingVersion || publicVersion(site, revision)
  const render = renderer || (require('../generated/publicWebsiteRenderer.cjs') as { renderPublicPage: NonNullable<typeof renderer> }).renderPublicPage
  const pages: Record<string, string> = {}
  for (const page of site.pages) {
    const html = await render(site, page.slug, version)
    if (!html || Buffer.byteLength(html) > 900000) throw new Error('Generated page exceeds its supported size.')
    pages[page.slug] = html
  }
  return { version, site, pages }
}
const regenerated = new Map<string, Promise<PublishedRepresentation>>()
export function regeneratePublicPages(site: WebsiteSite, version: string) {
  const key = version + ':' + publicRendererId()
  let result = regenerated.get(key)
  if (!result) {
    result = generatePublicPages(site, 0, undefined, version).catch(error => { regenerated.delete(key); throw error })
    regenerated.set(key, result)
    while (regenerated.size > 2) regenerated.delete(regenerated.keys().next().value!)
  }
  return result
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!) }
export function servePublicHtml(site: WebsiteSite, version: string, slug: string, body: string, template?: string) {
  assertPublic(site)
  const page = site.pages.find(page => page.slug === slug)
  if (!page) throw new Error('Unknown public page')
  const shell = template || readFileSync(path.join(__dirname, '../generated/publicTemplate.html'), 'utf8')
  if (!shell.includes('<div id="app"></div>')) throw new Error('Invalid public HTML template')
  return shell.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title + ' | ' + site.name)}</title><link rel="canonical" href="${publicPageUrl(slug)}">`).replace('<div id="app"></div>', `<div id="app" data-public-prerender>${body}</div><script type="application/json" id="published-website-snapshot">${publicSnapshotJson(site, version)}</script>`)
}
