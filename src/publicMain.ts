import { createApp, ref } from 'vue'
import { createWebHistory } from 'vue-router'
import PublicRoot from './PublicRoot.vue'
import { publicRouter } from './publicRouter'
import { initialPublicSnapshot } from './services/publicWebsite'
import { publicApplicationKey, publicSnapshotKey } from './features/website/publicSnapshot'
import { installPublicNavigation } from './features/website/publicNavigation'
import './styles/public.css'
import 'primeicons/primeicons.css'
const snapshot = initialPublicSnapshot(), root = document.getElementById('app')!
// Keep generated HTML visible until the renderer loads, then create a client-
// owned tree from its embedded data. Hydrated shared-layout fragments retained
// the initial page body when the router changed the destination.
const app = createApp(PublicRoot)
const router = publicRouter(createWebHistory())
app.provide(publicApplicationKey, true).provide(publicSnapshotKey, ref(snapshot)).use(router)
await router.isReady()
app.mount(root)
installPublicNavigation(router, root)
root.dataset.publicReady = 'true'
