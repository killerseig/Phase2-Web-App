<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import WebsiteWidget from './WebsiteWidget.vue'
import type { SavedWebsiteSection, WebsiteSite } from '@/features/website/types'
import { materializeGrid } from '@/features/website/grid'
import { visualGeometry } from '@/features/website/appearance'
const props = defineProps<{ entry: SavedWebsiteSection; accent: string; site?: WebsiteSite }>()
const viewport = ref<HTMLElement>()
const width = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => {
    width.value = viewport.value?.clientWidth || 640
  })
  if (viewport.value) observer.observe(viewport.value)
})
onBeforeUnmount(() => observer?.disconnect())
const sections = computed(() =>
  materializeGrid(props.entry.sections).map((section) => ({ ...section, hidden: false })),
)
const roots = computed(() => sections.value.filter((section) => !section.parentId))
const bounds = computed(() => {
  const layouts = roots.value.map((section) =>
    visualGeometry(section.layout!, section.appearance?.rotation),
  )
  const left = Math.min(0, ...layouts.map((layout) => layout.x)) * 45 - 16
  const top = Math.min(0, ...layouts.map((layout) => layout.y)) * 32 - 16
  return {
    left,
    top,
    width: Math.max(...layouts.map((layout) => layout.x + layout.w)) * 45 - left + 16,
    height: Math.max(...layouts.map((layout) => layout.y + layout.h)) * 32 - top + 16,
  }
})
const scale = computed(() => Math.min(1, width.value / bounds.value.width))
</script>
<template>
  <div
    ref="viewport"
    class="saved-section-preview"
    :style="{ '--website-accent': accent }"
    @click.capture.prevent
  >
    <div :style="{ height: bounds.height * scale + 'px', position: 'relative' }">
      <div
        class="saved-preview-canvas"
        :style="{
          width: bounds.width + 'px',
          height: bounds.height + 'px',
          transform: `scale(${scale})`,
        }"
      >
        <div :style="{ position: 'absolute', left: -bounds.left + 'px', top: -bounds.top + 'px' }">
          <WebsiteWidget
            v-for="section in roots"
            :key="section.id"
            :section="section"
            :site="site"
            :sections="sections"
            grid-mode
            private-images
          />
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.saved-section-preview {
  max-height: 60vh;
  overflow: auto;
  min-width: 0;
  background: #fff;
  color: #172c40;
  font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
}
.saved-preview-canvas {
  position: relative;
  transform-origin: top left;
}
</style>
