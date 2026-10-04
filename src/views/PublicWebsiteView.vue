<script setup lang="ts">
import { computed, onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WebsiteScriptFrame from '@/components/website/WebsiteScriptFrame.vue'
import WebsiteCanvas from '@/components/website/WebsiteCanvas.vue'
import { loadPublishedWebsite } from '@/services/website'
import type { WebsiteSite } from '@/features/website/types'
const route = useRoute()
const router = useRouter()
let active = true
const site = ref<WebsiteSite | null>(null)
const loading = ref(true)
const error = ref('')
const page = computed(() =>
  site.value?.pages.find((page) => page.slug === (route.params.slug || 'home')),
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    const published = await loadPublishedWebsite()
    if (!active) return
    site.value = published
    if (!published) await router.replace({ name: 'login' })
  } catch {
    if (active) error.value = 'The website could not be loaded. Please try again.'
  } finally {
    if (active) loading.value = false
  }
}
const description = document.createElement('meta')
description.name = 'description'
onMounted(() => {
  document.head.appendChild(description)
  void load()
})
onBeforeUnmount(() => {
  active = false
  description.remove()
})
watch(page, (page) => {
  document.title = page ? `${page.title} | ${site.value?.name}` : 'Phase 2'
  description.content = page?.description || ''
})
</script>
<template>
  <main class="public-website">
    <p v-if="loading" role="status">Loading website…</p>
    <div v-else-if="error" role="alert">
      {{ error }} <button type="button" @click="load">Try again</button>
    </div>
    <WebsiteScriptFrame
      v-else-if="site && page && (site.js?.trim() || page.js?.trim())"
      :key="page.id"
      :site="site"
      :page-id="page.id"
    />
    <WebsiteCanvas v-else-if="site && page" :site="site" :page-id="page.id" />
    <div v-else-if="site" class="unavailable">
      <h1>Page not found</h1>
      <a href="/website">Back to home</a><a href="/login">Employee Login</a>
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
