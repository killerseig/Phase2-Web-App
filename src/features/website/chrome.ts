import { materializeGrid } from './grid'
import type { WebsitePage, WebsiteSection, WebsiteSite } from './types'

export function convertPageChrome(page: WebsitePage, site: WebsiteSite): WebsitePage {
  if (page.chrome === 'widgets') return page
  const sections = materializeGrid(page.sections)
  // Leave unusually full legacy pages intact until the admin makes room.
  if (
    sections.length > 28 ||
    sections.some((section) => !section.parentId && section.layout!.y + section.layout!.h > 9992)
  )
    return page
  const roots = sections.filter((section) => !section.parentId)
  const width = Math.max(24, ...roots.map((section) => section.layout!.x + section.layout!.w))
  const bottom = Math.max(0, ...roots.map((section) => section.layout!.y + section.layout!.h)) + 4
  const z = Math.max(0, ...sections.map((section) => section.layout!.z))
  function chrome(type: 'navigation' | 'footer', y: number): WebsiteSection {
    return {
      id: crypto.randomUUID(),
      type,
      title: type === 'navigation' ? 'Navigation' : 'Footer',
      text: type === 'footer' ? site.branding?.footerText || '' : '',
      imageId: '',
      alt: '',
      linkLabel: '',
      linkUrl: '',
      hidden: false,
      items: [],
      layout: { x: 0, y, w: width, h: 4, z: Math.min(10000, z + 1) },
      navigation: {
        showBrand: true,
        showPages: type === 'navigation',
        showLogin: type === 'navigation',
        links:
          type === 'footer' ? (site.branding?.footerLinks || []).map((link) => ({ ...link })) : [],
      },
      appearance: {
        padding: 16,
        ...(type === 'footer'
          ? { background: '#172c40', color: '#ffffff' }
          : { background: '#ffffff' }),
      },
    }
  }
  return {
    ...page,
    chrome: 'widgets',
    sections: [
      chrome('navigation', 0),
      ...sections.map((section) =>
        section.parentId
          ? section
          : { ...section, layout: { ...section.layout!, y: section.layout!.y + 4 } },
      ),
      chrome('footer', bottom),
    ],
  }
}
