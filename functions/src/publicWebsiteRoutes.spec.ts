import { describe, expect, it } from 'vitest'
import { canonicalPublicSite, canonicalPublicUrl, legacyPublicSite, isPublicPagePath, publicPageUrl, reservedPublicSlugs } from './publicWebsiteRoutes'
describe('clean public URL boundary', () => {
  it('keeps legacy POST clients on compatible URLs across backend-first rollout and rollback', () => {
    const site = { linkUrl: '/company?source=email#people', login: { url: '/login' }, rich: { attrs: { href: '/' } }, js: 'window.customScript = true' }
    const legacy = legacyPublicSite(site)
    expect(legacy.linkUrl).toBe('/website/company?source=email#people')
    expect(legacy.rich.attrs.href).toBe('/website')
    expect(legacy.login.url).toBe('/login')
    expect(legacy.js).toBe(site.js)
    expect(canonicalPublicSite(legacy)).toEqual(site)
  })
  it('preserves query and fragment while canonicalizing legacy page links', () => {
    expect(publicPageUrl('home')).toBe('/')
    expect(canonicalPublicUrl('/website/company?source=email#people')).toBe('/company?source=email#people')
    expect(canonicalPublicUrl('/website/home?source=email#top')).toBe('/?source=email#top')
    expect(canonicalPublicUrl('/website')).toBe('/')
  })
  it('reserves app/system routes while allowing Safety without taking its nested SDS route', () => {
    for (const slug of reservedPublicSlugs.filter(slug => slug !== 'website')) expect(isPublicPagePath('/' + slug)).toBe(false)
    expect(isPublicPagePath('/website')).toBe(true) // legacy Home alias only
    expect(isPublicPagePath('/safety')).toBe(true)
    expect(isPublicPagePath('/safety/sds')).toBe(false)
    expect(isPublicPagePath('/company?source=email#people')).toBe(true)
  })
  it('changes public link representations without mutating stored content or author scripts', () => {
    const original = { linkUrl: '/website/company', html: '<a href="/website/company#people">People</a>', textFormat: 'markdown', text: '[People](/website/company)', js: 'window.location = "/website/company"', rich: { attrs: { href: '/website/company' } } }
    const clean = canonicalPublicSite(original)
    expect(clean.linkUrl).toBe('/company')
    expect(clean.html).toContain('href="/company#people"')
    expect(clean.text).toBe('[People](/company)')
    expect(clean.rich.attrs.href).toBe('/company')
    expect(clean.js).toBe(original.js)
    expect(original.linkUrl).toBe('/website/company')
  })
})
