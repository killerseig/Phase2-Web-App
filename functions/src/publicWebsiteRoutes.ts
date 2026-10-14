// Shared route boundary: public pages are single root segments; app routes win.
export const reservedPublicSlugs = [
  'admin', 'forms', 'form-submissions', 'reports', 'company-library', 'dashboards',
  'login', 'forgot-password', 'set-password', 'daily-log-gallery', 'jobs', 'dashboard',
  'exports', 'users', 'employees', 'settings', 'assets', 'public-assets', 'website', 'website-image',
  'website-runtime', 'public-boot', 'public-style', 'sds-file', 'employee-app', 'index', 'favicon',
]
export const isReservedPublicSlug = (slug: string) => reservedPublicSlugs.includes(slug)
export const publicPageUrl = (slug: string) => slug === 'home' ? '/' : '/' + slug
export function publicLinkPath(value: string) { return (value.split(/[?#]/, 1)[0] || '/').replace(/\/$/, '') || '/' }
export function canonicalPublicUrl(value: string) {
  const match = value.match(/^\/website(?:\/([a-z0-9-]+))?\/?([?#].*)?$/)
  if (!match || isReservedPublicSlug(match[1] || 'home')) return value
  return publicPageUrl(match[1] || 'home') + (match[2] || '')
}
export function isPublicPagePath(value: string) {
  const path = publicLinkPath(canonicalPublicUrl(value))
  return path === '/' || (/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && !isReservedPublicSlug(path.slice(1)))
}
export function legacyPublicUrl(value: string) {
  if (!value.startsWith('/') || value.startsWith('/website') || !isPublicPagePath(value)) return value
  const path = publicLinkPath(value)
  return (path === '/' ? '/website' : '/website' + path) + value.slice(path.length)
}
function mapPublicSiteLinks<T>(site: T, mapUrl: (value: string) => string): T {
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object') return value
    const source = value as Record<string, unknown>, result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(source)) {
      if (typeof entry === 'string' && ['url', 'href', 'linkUrl'].includes(key)) result[key] = mapUrl(entry)
      else if (typeof entry === 'string' && key === 'html') result[key] = entry.replace(/(href=["'])([^"']+)(["'])/g, (_, start, url, end) => start + mapUrl(url) + end)
      else if (typeof entry === 'string' && key === 'text' && source.textFormat === 'markdown') result[key] = entry.replace(/\]\(([^)]+)\)/g, (_, url) => '](' + mapUrl(url) + ')')
      else result[key] = visit(entry)
    }
    return result
  }
  return visit(site) as T
}
export const canonicalPublicSite = <T>(site: T): T => mapPublicSiteLinks(site, canonicalPublicUrl)
export const legacyPublicSite = <T>(site: T): T => mapPublicSiteLinks(site, legacyPublicUrl)
