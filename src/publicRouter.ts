import { createRouter, type RouterHistory } from 'vue-router'
import PublicWebsiteView from './views/PublicWebsiteView.vue'
import { publicPageUrl } from '../functions/src/publicWebsiteRoutes'
export function publicRouter(history: RouterHistory) {
  return createRouter({ history, routes: [{ path: '/website/:slug?', redirect: to => ({ path: publicPageUrl(String(to.params.slug || 'home')), query: to.query, hash: to.hash }) }, { path: '/:slug?', name: 'public-website', component: PublicWebsiteView }], scrollBehavior(to, from, saved) { return saved || (to.hash ? { el: to.hash } : to.path !== from.path ? { top: 0 } : undefined) } })
}
