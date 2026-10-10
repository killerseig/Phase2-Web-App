<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { configuredFormSiteUrl, publishedFormLink, type ServerFormTemplate } from '@/features/forms/publicLinks'
const props = defineProps<{ template: ServerFormTemplate }>()
const status = ref('')
const copying = ref(false)
let generation = 0
const link = computed(() => publishedFormLink(props.template, configuredFormSiteUrl(
  import.meta.env.VITE_PUBLIC_SITE_URL,
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
)))
watch(() => link.value.url, () => { generation++; status.value = ''; copying.value = false })
async function copyLink() {
  if (copying.value || !link.value.url) return
  const current = ++generation, url = link.value.url
  copying.value = true
  status.value = ''
  try {
    await navigator.clipboard.writeText(url)
    if (current === generation) status.value = 'Link copied.'
  } catch {
    if (current === generation) status.value = 'Copy failed. Select and copy the link below.'
  } finally {
    if (current === generation) copying.value = false
  }
}
</script>
<template>
  <div class="form-share-links">
    <p>{{ link.state }}</p>
    <template v-if="link.url">
      <button class="library-action" type="button" :disabled="copying" :aria-busy="copying" @click="copyLink"><i class="pi pi-copy" aria-hidden="true" /> {{ copying ? 'Copying link…' : 'Copy link' }}</button>
      <a class="library-open" :href="link.url" target="_blank" rel="noopener noreferrer"><i class="pi pi-external-link" aria-hidden="true" /> Open form</a>
      <input :value="link.url" readonly aria-label="Published public form link" @focus="($event.target as HTMLInputElement).select()" />
    </template>
    <p v-if="link.url" class="copy-feedback" :role="status ? 'status' : undefined" aria-live="polite">{{ status || '\u00a0' }}</p>
  </div>
</template>
<style scoped>
.form-share-links { grid-column: 1 / -1; width: 100%; min-width: 0; padding: .5rem 0; }
p { margin: .25rem 0; font-size: .85rem; }
button, a { display: inline-flex; align-items: center; gap: .3rem; padding: .4rem; margin-right: .4rem; }
button { min-inline-size: 7.5rem; }
.copy-feedback { min-height: 1.25em; }
input { display: block; width: 100%; min-width: 0; box-sizing: border-box; margin-top: .4rem; padding: .4rem; font-size: .8rem; }
</style>
