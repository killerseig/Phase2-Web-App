<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { navigationEditingKey } from '@/features/website/inlineEditing'
import { websiteDeviceKey } from '@/features/website/responsive'
import WebsiteMedia from './WebsiteMedia.vue'
import WebsiteInlineText from './WebsiteInlineText.vue'
import WebsiteMenuLabel from './WebsiteMenuLabel.vue'
import WebsiteNavigationDropdown from './WebsiteNavigationDropdown.vue'
import { navigationEntries } from '@/features/website/navigation'
import { richTextLinks } from '../../../functions/src/websiteRichText'
import { pageUrl, type WebsiteSite, type WebsiteSection } from '@/features/website/types'
const props = defineProps<{
  section: WebsiteSection
  site?: WebsiteSite
  pageId?: string
  preview?: boolean
}>()
const settings = computed(
  () =>
    props.section.navigation || {
      showBrand: true,
      showPages: props.section.type === 'navigation',
      showLogin: false,
      links: [],
    },
)
const links = computed(() => navigationEntries(settings.value, props.site))
const logo = computed(() => ({
  ...props.section,
  imageId: props.section.imageId || props.site?.branding?.logoId || '',
  alt: props.section.imageId ? props.section.alt : props.site?.branding?.logoAlt || '',
}))
const editMenu = inject(navigationEditingKey, undefined)
const device = inject(websiteDeviceKey, undefined)
const compact = computed(
  () =>
    props.section.type === 'navigation' &&
    (device?.value === 'tablet' || device?.value === 'mobile'),
)
const open = ref(false)
const root = ref<HTMLElement>()
const toggle = ref<HTMLButtonElement>()
const panelId = useId()
function close() {
  open.value = false
}
function outside(event: PointerEvent) {
  const target = event.target
  if (
    open.value &&
    target instanceof Element &&
    !root.value?.contains(target) &&
    !target.closest('.inline-text-toolbar')
  )
    close()
}
function escape(event: KeyboardEvent) {
  if (!compact.value || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  close()
  toggle.value?.focus()
}
watch([compact, () => device?.value, () => props.pageId], close)
// Capture outside clicks even when builder controls stop propagation.
onMounted(() => document.addEventListener('pointerdown', outside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true))
</script>
<template>
  <component
    ref="root"
    :is="section.type === 'footer' ? 'footer' : 'header'"
    :class="[
      'navigation-widget',
      section.type === 'footer' ? 'page-footer' : 'page-header',
      { 'mobile-navigation': compact, 'mobile-menu-open': compact && open },
    ]"
    :style="{
      '--navigation-menu-background':
        section.appearance?.background || site?.theme?.surface || '#fff',
    }"
    @keydown.esc="escape"
  >
    <div v-if="settings.showBrand || section.text || preview" class="navigation-identity">
      <component
        :is="preview || richTextLinks(settings.brandRichText).length ? 'div' : 'a'"
        v-if="settings.showBrand"
        class="page-brand website-brand"
        :href="
          preview || richTextLinks(settings.brandRichText).length ? undefined : pageUrl('home')
        "
      >
        <span v-if="logo.imageId" class="brand-logo"
          ><WebsiteMedia :item="logo" :preview="preview" contain /></span
        ><WebsiteInlineText
          :id="section.id"
          field="brand"
          tag="div"
          :text="settings.brandText ?? site?.name ?? 'Website'"
          :rich="settings.brandRichText"
          :preview="preview"
        />
      </component>
      <WebsiteInlineText
        v-if="section.text || section.textRichText || (preview && section.type === 'footer')"
        :id="section.id"
        field="text"
        :text="section.text"
        :rich="section.textRichText"
        :format="section.textFormat"
        :preview="preview"
      />
    </div>
    <button
      v-if="compact && links.length"
      ref="toggle"
      type="button"
      class="mobile-menu-toggle"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="`${open ? 'Close' : 'Open'} navigation menu`"
      @pointerdown.stop
      @click.stop="open = !open"
      @dblclick.stop
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path v-if="open" d="m6 6 12 12M6 18 18 6" />
        <path v-else d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    <!-- Keep the panel separate: saved page CSS can override display on .page-navigation. -->
    <div v-show="!compact || open" :id="panelId" class="navigation-panel">
      <nav
        class="page-navigation"
        :aria-label="section.type === 'footer' ? 'Footer navigation' : 'Website navigation'"
        @pointerdown="preview && editMenu && $event.stopPropagation()"
      >
        <template v-for="link in links" :key="link.key">
          <WebsiteNavigationDropdown
            v-if="link.children?.length"
            :entry="link"
            :section-id="section.id"
            :preview="preview"
            :mobile="compact"
            :expanded="!compact || open"
            @navigate="close"
          />
          <WebsiteMenuLabel
            v-else
            :entry="link"
            :section-id="section.id"
            :preview="preview"
            :current="!!link.pageId && link.pageId === pageId"
            @navigate="close"
          />
        </template>
      </nav>
    </div>
  </component>
</template>
<style scoped>
.navigation-widget {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  min-height: 0;
  height: 100%;
  align-content: center;
}
.website-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: var(--heading-size, 1.5rem);
  font-family: var(--widget-font, inherit);
  font-weight: 700;
  text-decoration: none;
}
.website-brand :deep(.widget-title) {
  margin: 0;
  font: inherit;
  color: inherit;
}
.navigation-identity {
  min-width: 0;
}
.navigation-panel {
  display: contents;
}
.navigation-widget.mobile-navigation {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  row-gap: 0;
  align-content: center;
}
.mobile-menu-toggle {
  grid-column: 2;
  grid-row: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.mobile-menu-toggle svg {
  display: block;
  width: 22px;
  height: 22px;
  flex: none;
}
.mobile-menu-toggle:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.mobile-menu-toggle:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
.mobile-navigation > .navigation-panel {
  display: block;
  grid-column: 1 / -1;
  min-width: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  max-height: min(65vh, 480px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
/* Authored styles are scoped and important; retain a usable single column mobile menu. */
.navigation-widget.mobile-navigation > .navigation-panel > .page-navigation {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  flex-wrap: nowrap !important;
  gap: 2px !important;
  width: 100% !important;
  font-size: max(14px, 1em) !important;
}
.mobile-navigation .page-navigation :deep(.menu-label) {
  box-sizing: border-box;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 10px 8px;
  overflow-wrap: anywhere;
}
.mobile-navigation .page-navigation :deep(a:hover),
.mobile-navigation .page-navigation :deep(a[aria-current]) {
  background: color-mix(in srgb, currentColor 7%, transparent);
}
.brand-logo {
  width: 96px;
  height: min(48px, 100cqh);
  display: block;
}
nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
a {
  color: inherit;
  text-decoration: none;
}
nav a {
  padding: 0.35em 0.15em;
  border-radius: 4px;
  font: inherit;
}
nav a:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
a:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
a[aria-current] {
  text-decoration: underline;
}
</style>
