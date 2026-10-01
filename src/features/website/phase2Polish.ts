import type { WebsiteSite } from './types'

// Editable site styles, scoped by the existing renderer to public/builder canvases.
// No company facts, routing, document permissions or employee styles are changed.
export const phase2PolishCss = `
.widget-text { line-height: 1.65; }
.widget-title { letter-spacing: -0.012em; }
.widget-button { min-height: 44px; border-radius: 2px; line-height: 1.3; }
.widget-button:focus-visible { box-shadow: 0 0 0 2px #ffffff, 0 0 0 5px #075486; }
.custom-eyebrow .widget-text { font-weight: 600; line-height: 1.5; }
.custom-home-hero .widget-title, .custom-page-hero .widget-title { line-height: 1.08; }
.custom-home-hero .widget-image, .custom-page-hero .widget-image { box-shadow: 0 16px 40px #00000026; }
.custom-home-hero .widget-button { padding: 14px 24px; font-weight: 700; }
.custom-detail-card .widget-title, .custom-photo-card .widget-title { line-height: 1.2; }
.custom-detail-card { border-width: 3px 1px 1px; border-style: solid; border-color: #075486 #d5dedf #d5dedf; }
.custom-detail-card .widget-title { margin-bottom: 14px; }
.custom-detail-card .widget-text { margin-bottom: 20px; }
.custom-photo-card .widget-image { margin-bottom: 24px; }
.custom-photo-card .widget-title { margin-bottom: 12px; }
.custom-navigation { border-width: 0 0 1px; border-style: solid; border-color: #d5dedf; }
.custom-detail-card .widget-text { max-width: 48ch; }
.custom-detail-card .widget-button, .custom-photo-card .widget-button { min-height: 44px; font-size: 15px; padding-bottom: 8px; }
.custom-feature .widget-button, .custom-feature-reverse .widget-button, .custom-careers-band .widget-button { padding: 14px 24px; font-weight: 700; }
.custom-intro .widget-text { max-width: 66ch; }
.custom-resource-band .widget-title { line-height: 1.1; }
.custom-resource-band .widget-text { max-width: 62ch; }
.custom-resource-band .widget-button { display: inline-flex; margin-top: 20px; padding: 14px 24px; font-weight: 700; background-color: #ffffff; color: #075486; border-color: #ffffff; }
.custom-resource-band .widget-button:hover { background-color: #dceaf0; color: #122d3d; }
.custom-careers-action { min-width: 190px; }
.custom-careers-action .widget-button { text-align: center; }
@media (min-width: 768px) and (max-width: 1023px) {
  .custom-card-trio .container-items { display: flex; flex-wrap: nowrap; --child-basis: calc((100% - 40px) / 3); gap: 20px; }
  .custom-card-trio .custom-detail-card { min-width: 0; padding-left: 18px; padding-right: 18px; }
}
.custom-footer { border-width: 1px 0 0; border-style: solid; border-color: #d5dedf; padding-top: 48px; padding-bottom: 48px; }
.custom-footer .widget-text { max-width: 38ch; font-size: 14px; line-height: 1.65; }
.custom-footer .page-navigation { gap: 18px 24px; }
@media (max-width: 1023px) {
  .custom-footer { padding-top: 36px; padding-bottom: 36px; }
}
@media (max-width: 767px) {
  .custom-careers-action { min-width: 0; }
  .custom-resource-band .widget-button { padding: 13px 20px; }
  .custom-home-hero .widget-image { height: clamp(200px, 58cqw, 260px); }
  .custom-page-hero .widget-image { height: clamp(190px, 54cqw, 240px); }
  .custom-detail-card { padding-top: 24px; padding-bottom: 24px; }
  .custom-home-hero .widget-button { padding: 13px 20px; }
  .custom-feature .widget-button, .custom-feature-reverse .widget-button, .custom-careers-band .widget-button { padding: 13px 20px; }
  .custom-footer .page-navigation { gap: 14px 20px; font-size: 14px; }
}
`

export function polishPhase2Site(site: WebsiteSite): WebsiteSite {
  let css = site.css || ''
  // Replace earlier generated refinements without touching owner-authored styles.
  const start = '\n.widget-text { line-height: 1.65; }'
  const end = '\n  .custom-footer .page-navigation { gap: 14px 20px; font-size: 14px; }\n}\n'
  for (let index = css.indexOf(start); index >= 0; index = css.indexOf(start)) {
    const finish = css.indexOf(end, index)
    if (finish < 0) break
    css = css.slice(0, index) + css.slice(finish + end.length)
  }
  // Add generated presentation classes without changing owner content or record IDs.
  let changed = false
  const pages = site.pages.map((page) => {
    let pageChanged = false
    const sections = page.sections.map((section) => {
      const trio =
        section.type === 'container' &&
        section.styleClass === 'custom-card-row' &&
        page.sections.filter((child) => child.parentId === section.id && !child.hidden).length === 3
      const resource = section.type === 'contact' && section.styleClass === 'custom-careers-band'
      if (!trio && !resource) return section
      pageChanged = changed = true
      return { ...section, styleClass: trio ? 'custom-card-trio' : 'custom-resource-band' }
    })
    return pageChanged ? { ...page, sections } : page
  })
  return { ...site, pages: changed ? pages : site.pages, css: css + phase2PolishCss }
}
