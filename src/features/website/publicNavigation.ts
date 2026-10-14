import type { Router } from 'vue-router'
import { canonicalPublicUrl, isPublicPagePath } from '../../../functions/src/publicWebsiteRoutes'
export const isPublicWebsitePath = isPublicPagePath
export function installPublicNavigation(router: Router, root: HTMLElement) {
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
    if (!anchor || !root.contains(anchor) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self') || anchor.rel.split(/\s+/).includes('external')) return
    const url = new URL(anchor.href, location.href)
    if (url.origin !== location.origin || !isPublicWebsitePath(url.pathname)) return
    if (url.pathname === location.pathname && url.hash && !url.search) return
    event.preventDefault()
    void router.push(canonicalPublicUrl(url.pathname + url.search + url.hash))
  }
  root.addEventListener('click', click, true)
  return () => root.removeEventListener('click', click, true)
}
