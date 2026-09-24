import type { MenuLabel, MenuLink, NavigationSettings } from '../../../functions/src/websiteContent'
import type { RichTextNode } from '../../../functions/src/websiteRichText'
import { pageUrl, type WebsiteSite } from './types'

export interface NavigationEntry extends MenuLabel {
  key: string
  url: string
  pageId?: string
  children?: NavigationEntry[]
}
export function navigationEntries(
  settings: NavigationSettings,
  site?: WebsiteSite,
): NavigationEntry[] {
  function custom(link: MenuLink, parent = ''): NavigationEntry {
    const key = parent ? `${parent}/${link.id}` : `custom:${link.id}`
    return { ...link, key, children: link.children?.map((child) => custom(child, key)) }
  }
  return [
    ...(settings.showPages
      ? (site?.pages || [])
          .filter((page) => page.inNavigation)
          .map((page) => ({
            label: page.title,
            ...settings.pageLabels?.find((label) => label.id === page.id),
            key: `page:${page.id}`,
            pageId: page.id,
            url: pageUrl(page.slug),
          }))
      : []),
    ...settings.links.map((link) => custom(link)),
    ...(settings.showLogin
      ? [{ label: 'Employee Login', ...settings.loginLabel, key: 'login', url: '/login' }]
      : []),
  ]
}
export function updateNavigationLabel(
  settings: NavigationSettings,
  key: string,
  label: string,
  rich: RichTextNode | undefined,
  site: WebsiteSite,
) {
  let target: MenuLabel | undefined
  if (key.startsWith('page:')) {
    const id = key.slice(5)
    if (!site.pages.some((page) => page.id === id)) return
    settings.pageLabels = (settings.pageLabels || []).filter((entry) =>
      site.pages.some((page) => page.id === entry.id),
    )
    target = settings.pageLabels.find((entry) => entry.id === id)
    if (!target) {
      target = { label }
      settings.pageLabels.push({ id, ...target })
      target = settings.pageLabels.at(-1)!
    }
  } else if (key === 'login') target = settings.loginLabel ||= { label }
  else if (key.startsWith('custom:')) {
    const [parent, child] = key.slice(7).split('/')
    const link = settings.links.find((link) => link.id === parent)
    target = child ? link?.children?.find((link) => link.id === child) : link
  }
  if (!target) return
  target.label = label
  if (rich) target.labelRichText = rich
  else delete target.labelRichText
}
