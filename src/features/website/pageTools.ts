import { menuLinks } from '../../../functions/src/websiteContent'
import { mapRichTextLinks } from '../../../functions/src/websiteRichText'
import { newItem, newSection, pageUrl, type WebsitePage, type WebsiteSection } from './types'

export const pageTemplates = {
  company: 'Company',
  projects: 'Projects',
  careers: 'Careers',
  services: 'Services',
  contact: 'Contact',
} as const
export type PageTemplate = keyof typeof pageTemplates

function uniqueSlug(base: string, pages: WebsitePage[]) {
  const stem = base.slice(0, 58).replace(/-+$/, '') || 'page'
  let slug = stem
  let suffix = 2
  while (pages.some((page) => page.slug === slug)) slug = `${stem}-${suffix++}`
  return slug
}

export function copySection(source: WebsiteSection): WebsiteSection {
  return {
    ...source,
    ...(source.textBoxes ? { textBoxes: JSON.parse(JSON.stringify(source.textBoxes)) } : {}),
    ...(source.linkRichText
      ? { linkRichText: JSON.parse(JSON.stringify(source.linkRichText)) }
      : {}),
    ...(source.titleRichText
      ? { titleRichText: JSON.parse(JSON.stringify(source.titleRichText)) }
      : {}),
    ...(source.textRichText
      ? { textRichText: JSON.parse(JSON.stringify(source.textRichText)) }
      : {}),
    ...(source.blockOptions ? { blockOptions: { ...source.blockOptions } } : {}),
    ...(source.custom ? { custom: JSON.parse(JSON.stringify(source.custom)) } : {}),
    ...(source.imageSettings ? { imageSettings: { ...source.imageSettings } } : {}),
    ...(source.navigation ? { navigation: JSON.parse(JSON.stringify(source.navigation)) } : {}),
    ...(source.layout ? { layout: { ...source.layout } } : {}),
    ...(source.appearance ? { appearance: { ...source.appearance } } : {}),
    ...(source.container ? { container: { ...source.container } } : {}),
    ...(source.sizing ? { sizing: { ...source.sizing } } : {}),
    ...(source.devices ? { devices: JSON.parse(JSON.stringify(source.devices)) } : {}),
    id: crypto.randomUUID(),
    items: source.items.map((item) => ({
      ...item,
      ...(item.textBoxes ? { textBoxes: JSON.parse(JSON.stringify(item.textBoxes)) } : {}),
      ...(item.linkRichText ? { linkRichText: JSON.parse(JSON.stringify(item.linkRichText)) } : {}),
      ...(item.titleRichText
        ? { titleRichText: JSON.parse(JSON.stringify(item.titleRichText)) }
        : {}),
      ...(item.textRichText ? { textRichText: JSON.parse(JSON.stringify(item.textRichText)) } : {}),
      ...(item.imageSettings ? { imageSettings: { ...item.imageSettings } } : {}),
      id: crypto.randomUUID(),
    })),
  }
}

export function copyPage(source: WebsitePage, pages: WebsitePage[]): WebsitePage {
  const copy = {
    ...source,
    ...(source.grid ? { grid: { ...source.grid } } : {}),
    ...(source.layout ? { layout: { ...source.layout } } : {}),
    id: crypto.randomUUID(),
    title: `${source.title.slice(0, 93)} (copy)`,
    slug: uniqueSlug(`${source.slug.slice(0, 53)}-copy`, pages),
    sections: source.sections.map(copySection),
  }
  const ids = new Map(
    source.sections.map((section, index) => [section.id, copy.sections[index]!.id]),
  )
  if (copy.html)
    copy.html = copy.html.replace(
      /<website-widget\s+id="([a-zA-Z0-9_-]+)"\s*><\/website-widget\s*>/g,
      (source, id) =>
        ids.has(id) ? '<website-widget id="' + ids.get(id) + '"></website-widget>' : source,
    )
  for (const section of copy.sections)
    if (section.parentId) section.parentId = ids.get(section.parentId)
  for (const section of copy.sections) {
    for (const link of menuLinks(section.navigation?.links || []))
      if (link.url === pageUrl(source.slug)) link.url = pageUrl(copy.slug)
    for (const item of [section, ...section.items]) {
      for (const rich of [item.titleRichText, item.textRichText])
        mapRichTextLinks(rich, (url) => (url === pageUrl(source.slug) ? pageUrl(copy.slug) : url))
      if (item.textFormat === 'markdown')
        item.text = item.text.replace(
          /(\[[^\]\n]+\]\()([^\s)]+)(\))/g,
          (all, prefix, url, suffix) =>
            url === pageUrl(source.slug) ? prefix + pageUrl(copy.slug) + suffix : all,
        )
      if (item.linkUrl === pageUrl(source.slug)) item.linkUrl = pageUrl(copy.slug)
    }
  }
  return copy
}

export function pageFromTemplate(template: PageTemplate, pages: WebsitePage[]): WebsitePage {
  const hero = { ...newSection('hero'), title: pageTemplates[template], text: '' }
  const content = newSection(
    template === 'contact' ? 'contact' : template === 'company' ? 'image-text' : 'cards',
  )
  content.title = {
    company: 'Who we are',
    projects: 'Our projects',
    careers: 'Opportunities',
    services: 'What we do',
    contact: 'Get in touch',
  }[template]
  if (content.type === 'cards') content.items = [{ ...newItem(), title: 'Add your details' }]
  return {
    id: crypto.randomUUID(),
    chrome: 'widgets',
    layout: { desktop: 'flow', mobile: 'flow', tablet: 'flow' },
    title: pageTemplates[template],
    slug: uniqueSlug(template, pages),
    description: '',
    inNavigation: true,
    sections: [newSection('navigation'), hero, content, newSection('footer')],
  }
}
