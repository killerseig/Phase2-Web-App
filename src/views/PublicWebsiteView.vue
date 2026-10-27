<script setup lang="ts">
import { computed, inject, onMounted, provide, ref, watch, onBeforeUnmount } from 'vue'
import WebsiteCanvas from '@/components/website/WebsiteCanvas.vue'
import WebsiteScriptFrame from '@/components/website/WebsiteScriptFrame.vue'
import { useRoute, useRouter } from 'vue-router'
import { initialPublicSnapshot, loadPublicSnapshot } from '@/services/publicWebsite'
import { publicApplicationKey, publicAssetVersionKey, publicSnapshotKey } from '@/features/website/publicSnapshot'
import type { WebsiteSite } from '@/features/website/types'
import { pageUrl } from '@/features/website/types'
import { publicUsageKey } from '@/features/analytics/useUsageAnalytics'
const analytics = inject(publicUsageKey, undefined)
const route = useRoute()
const router = useRouter()
let active = true
const initial = inject(publicSnapshotKey, undefined)?.value || initialPublicSnapshot()
const standalone = inject(publicApplicationKey, false)
const site = ref<WebsiteSite | null>(initial?.site || null)
const version = ref<string | null>(initial?.version || null)
provide(publicAssetVersionKey, version)
const loading = ref(!initial)
const error = ref('')
const page = computed(() =>
  site.value?.pages.find((page) => page.slug === (route.params.slug || 'home')),
)
async function load(refresh = false) {
  if (!site.value) loading.value = true
  error.value = ''
  try {
    const published = await loadPublicSnapshot(refresh)
    if (!active) return
    site.value = published.site
    version.value = published.version
    if (!published.site) {
      if (standalone) window.location.replace('/login')
      else await router.replace({ name: 'login' })
    }
  } catch {
    if (active && (!refresh || !site.value)) error.value = 'The website could not be loaded. Please try again.'
  } finally {
    if (active) loading.value = false
  }
}
const description = typeof document === 'undefined' ? null : document.createElement('meta')
const canonical = typeof document === 'undefined' ? null : document.querySelector<HTMLLinkElement>('link[rel="canonical"]') || document.createElement('link')
if (canonical) canonical.rel = 'canonical'
if (description) description.name = 'description'
let refreshTimer: ReturnType<typeof setInterval> | undefined
const refresh = () => { if (document.visibilityState === 'visible') void load(true) }
onMounted(() => {
  if (description) document.head.appendChild(description)
  if (canonical) document.head.appendChild(canonical)
  if (!initial) void load()
  refreshTimer = setInterval(refresh, 30000)
  window.addEventListener('focus', refresh)
})
onBeforeUnmount(() => {
  active = false
  description?.remove()
  canonical?.remove()
  if (refreshTimer) clearInterval(refreshTimer)
  window.removeEventListener('focus', refresh)
})
watch(page, (page) => {
  // Only the standalone public application provides this controller; editor previews do not.
  analytics?.view(page?.slug, typeof window === 'undefined' ? '' : window.location.search)
  if (typeof document !== 'undefined') document.title = page ? `${page.title} | ${site.value?.name}` : 'Phase 2'
  if (description) description.content = page?.description || ''
  if (canonical && page) canonical.setAttribute('href', pageUrl(page.slug))
}, { immediate: true })
watch(() => route.fullPath, () => { if (!initial) void load() })
</script>
<template>
  <main class="public-website">
    <p v-if="loading" role="status">Loading website…</p>
    <div v-else-if="error" role="alert">
      {{ error }} <button type="button" @click="load()">Try again</button>
    </div>
    <WebsiteScriptFrame
      v-else-if="site && page && (site.js?.trim() || page.js?.trim())"
      :key="`${version}:${page.id}`"
      :site="site"
      :page-id="page.id"
    />
    <WebsiteCanvas v-else-if="site && page" :key="`${version}:${page.id}`" :site="site" :page-id="page.id" />
    <div v-else-if="site" class="unavailable">
      <h1>Page not found</h1>
      <a href="/">Back to home</a><a href="/login">Employee Login</a>
    </div>
  </main>
</template>
<style scoped>
/* The internal app owns its scroll panels; public pages use document scrolling. */
:global(body:has(.public-website)) {
  overflow: auto;
}
.public-website {
  min-height: 100vh;
  background: #fff;
  color: #172c40;
}
.public-website > p,
.public-website > [role='alert'],
.unavailable {
  padding: 3rem;
}
.unavailable a {
  display: inline-block;
  margin: 1rem;
  color: #174878;
}
</style>
