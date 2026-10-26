<script setup lang="ts">
import WebsitePageCode from './WebsitePageCode.vue'
import WebsiteThemeFields from './WebsiteThemeFields.vue'
import WebsiteBrandingFields from './WebsiteBrandingFields.vue'
import type { WebsiteSite } from '@/features/website/types'
import type { WebsiteTheme } from '../../../functions/src/websiteTheme'
defineProps<{ site: WebsiteSite; codeMode: boolean; designMode: boolean; hideFooter: boolean }>()
const emit = defineEmits<{
  update: [patch: Partial<Pick<WebsiteSite, 'name' | 'css' | 'js' | 'accent' | 'branding'>>]
  applyTheme: [value: { theme: WebsiteTheme; accent: string }]
  theme: [value: WebsiteTheme | undefined]
  uploading: [busy: boolean]
}>()
const input = (event: Event) => (event.target as HTMLInputElement).value
</script>
<template>
  <div class="website-site-inspector">
    <div class="inspector-header settings-header">
      <h2><i class="pi pi-cog" aria-hidden="true" /> Site settings</h2>
      <p class="selection-name">Shared across your website</p>
    </div>
    <label>Website name<input :value="site.name" maxlength="100" @input="emit('update', { name: input($event) })" /></label>
    <WebsitePageCode v-if="codeMode" shared :css="site.css" :js="site.js" @css="emit('update', { css: $event })" @js="emit('update', { js: $event })" />
    <label v-if="designMode">Accent color<input :value="site.accent" type="color" @input="emit('update', { accent: input($event) })" /></label>
    <WebsiteThemeFields v-if="designMode" :theme="site.theme" :accent="site.accent" @apply="emit('applyTheme', $event)" @update="emit('theme', $event)" />
    <WebsiteBrandingFields v-if="site.branding" :branding="site.branding" :hide-footer="hideFooter" @update="emit('update', { branding: $event })" @uploading="emit('uploading', $event)" />
    <p v-if="!designMode" class="subtle">Switch to Design to change shared colors, typography and spacing.</p>
  </div>
</template>
<style scoped>
.website-site-inspector { display: contents; }
.inspector-header { position: sticky; top: -.85rem; z-index: 3; padding-top: .6rem; margin-top: -.6rem; background: var(--bg-panel); }
.selection-name { margin: .2rem 0 0; font-size: .75rem; color: var(--text-muted); overflow-wrap: anywhere; }
label { display: grid; gap: .35rem; font-size: .8rem; }
input { font: inherit; width: 100%; min-width: 0; box-sizing: border-box; background: var(--field); border: 1px solid var(--border); color: var(--text); padding: .5rem; border-radius: 4px; }
.subtle { color: var(--text-muted); font-size: .8rem; }
</style>
