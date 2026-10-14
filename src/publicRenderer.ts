import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory } from 'vue-router'
import PublicRoot from './PublicRoot.vue'
import { publicRouter } from './publicRouter'
import { publicApplicationKey, publicSnapshotKey } from './features/website/publicSnapshot'
import type { WebsiteSite } from './features/website/types'
import { publicPageUrl } from '../functions/src/publicWebsiteRoutes'
export async function renderPublicPage(site: WebsiteSite, slug: string, version: string) {
  const router = publicRouter(createMemoryHistory()), app = createSSRApp(PublicRoot)
  app.provide(publicApplicationKey, true).provide(publicSnapshotKey, ref({ site, version })).use(router)
  await router.push(publicPageUrl(slug)); await router.isReady()
  return renderToString(app)
}
