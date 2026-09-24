<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import WebsiteWidget from './WebsiteWidget.vue'
import {
  customDefinition,
  customDocument,
  resolvedCustom,
  customBounds,
  visibleCustomSections,
} from '../../../functions/src/websiteCustom'
import type { WebsiteSection, WebsiteSite } from '@/features/website/types'
const props = defineProps<{
  section: WebsiteSection
  site?: WebsiteSite
  pageId?: string
  preview?: boolean
}>()
const definition = computed(() => customDefinition(props.section.custom, props.site?.customWidgets))
const resolved = computed(() =>
  definition.value ? resolvedCustom(definition.value, props.section.custom?.values) : undefined,
)
const sections = computed(() => visibleCustomSections(resolved.value?.sections || []))
const bounds = computed(() => customBounds(resolved.value?.sections || []))
const root = ref<HTMLElement>(),
  width = ref(1080)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => {
    width.value = root.value?.clientWidth || 1080
  })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
const document = computed(() => {
  if (resolved.value?.kind !== 'code') return ''
  try {
    return customDocument(resolved.value)
  } catch {
    return ''
  }
})
</script>
<template>
  <div ref="root" class="custom-widget-content">
    <p v-if="!resolved">Custom widget unavailable.</p>
    <iframe
      v-else-if="resolved.kind === 'code'"
      :title="resolved.name"
      :srcdoc="document"
      sandbox="allow-top-navigation-by-user-activation"
      referrerpolicy="no-referrer"
      :tabindex="preview ? -1 : undefined"
      :class="{ editing: preview }"
    />
    <div
      v-else
      class="custom-visual-viewport"
      :style="{ height: (bounds.height * width) / bounds.width + 'px' }"
    >
      <div
        class="custom-visual-surface"
        :style="{
          width: bounds.width + 'px',
          height: bounds.height + 'px',
          transform: `scale(${width / bounds.width})`,
        }"
        :inert="preview || undefined"
      >
        <WebsiteWidget
          v-for="child in sections.filter((entry) => !entry.parentId)"
          :key="child.id"
          :section="child"
          :sections="sections"
          :site="site"
          :page-id="pageId"
          grid-mode
          :private-images="preview"
        />
      </div>
    </div>
  </div>
</template>
<style scoped>
.custom-widget-content {
  width: 100%;
  height: 100%;
  min-height: 80px;
}
iframe {
  width: 100%;
  height: 100%;
  min-height: 200px;
  border: 0;
  display: block;
  background: white;
}
iframe.editing {
  pointer-events: none;
}
.custom-visual-viewport {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.custom-visual-surface {
  position: relative;
  transform-origin: top left;
}
</style>
