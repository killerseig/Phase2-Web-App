<script setup lang="ts">
import { computed, inject } from 'vue'
import { navigationEditingKey } from '@/features/website/inlineEditing'
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
</script>
<template>
  <component
    :is="section.type === 'footer' ? 'footer' : 'header'"
    :class="['navigation-widget', section.type === 'footer' ? 'page-footer' : 'page-header']"
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
        />
        <WebsiteMenuLabel
          v-else
          :entry="link"
          :section-id="section.id"
          :preview="preview"
          :current="!!link.pageId && link.pageId === pageId"
        />
      </template>
    </nav>
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
