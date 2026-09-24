<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { WebsiteSection } from '@/features/website/types'
import { publicHttpsUrl, websiteVideo } from '../../../functions/src/websiteInteractive'
import WebsiteMedia from './WebsiteMedia.vue'
import WebsiteText from './WebsiteText.vue'
const props = defineProps<{ section: WebsiteSection; preview?: boolean }>()
const id = useId()
const selected = ref('')
const active = computed(
  () => props.section.items.find((item) => item.id === selected.value) || props.section.items[0],
)
const video = computed(() => websiteVideo(props.section.linkUrl))
const playing = ref(false)
watch(
  () => props.section.linkUrl,
  () => {
    playing.value = false
  },
)
function tabKey(event: KeyboardEvent, index: number) {
  const count = props.section.items.length
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % count
          : event.key === 'ArrowLeft'
            ? (index + count - 1) % count
            : -1
  if (next < 0) return
  event.preventDefault()
  selected.value = props.section.items[next]!.id
  ;(event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [next]?.focus()
}
</script>
<template>
  <div class="interactive-widget" @pointerdown.stop @keydown.stop>
    <h2 v-if="section.title" class="widget-title">{{ section.title }}</h2>
    <WebsiteText
      v-if="section.text"
      :text="section.text"
      :format="section.textFormat"
      :preview="preview"
    />
    <template v-if="section.type === 'accordion'">
      <details v-for="item in section.items" :key="item.id" class="accordion-item">
        <summary>{{ item.title || 'Untitled item' }}</summary>
        <div class="item-content">
          <WebsiteMedia v-if="item.imageId" :item="item" :preview="preview" />
          <WebsiteText :text="item.text" :format="item.textFormat" :preview="preview" />
          <a
            v-if="item.linkUrl && item.linkLabel"
            :href="item.linkUrl"
            @click="preview && $event.preventDefault()"
            >{{ item.linkLabel }}</a
          >
        </div>
      </details>
    </template>
    <template v-else-if="section.type === 'tabs'">
      <div role="tablist" :aria-label="section.title || 'Content tabs'" class="tab-list">
        <button
          v-for="(item, index) in section.items"
          :id="`${id}-tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="active?.id === item.id"
          :aria-controls="`${id}-panel-${item.id}`"
          :tabindex="active?.id === item.id ? 0 : -1"
          @click="selected = item.id"
          @keydown="tabKey($event, index)"
        >
          {{ item.title || 'Untitled tab' }}
        </button>
      </div>
      <div
        v-for="item in section.items"
        v-show="active?.id === item.id"
        :id="`${id}-panel-${item.id}`"
        :key="item.id"
        role="tabpanel"
        :aria-labelledby="`${id}-tab-${item.id}`"
        tabindex="0"
        class="item-content"
      >
        <WebsiteMedia v-if="item.imageId" :item="item" :preview="preview" />
        <WebsiteText :text="item.text" :format="item.textFormat" :preview="preview" />
        <a
          v-if="item.linkUrl && item.linkLabel"
          :href="item.linkUrl"
          @click="preview && $event.preventDefault()"
          >{{ item.linkLabel }}</a
        >
      </div>
    </template>
    <template v-else-if="section.type === 'video'">
      <template v-if="video">
        <div v-if="!playing" class="video-placeholder">
          <button type="button" :disabled="preview" @click="playing = true">
            {{ preview ? 'Video playback is available on the public page' : 'Load video' }}
          </button>
        </div>
        <iframe
          v-else-if="video.kind === 'embed'"
          :src="video.url"
          :title="section.title || 'Video'"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        />
        <video
          v-else
          :src="video.url"
          controls
          playsinline
          preload="metadata"
          :aria-label="section.title || 'Video'"
        />
        <a
          :href="section.linkUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="preview && $event.preventDefault()"
          >{{ section.linkLabel || 'Open video' }}</a
        >
      </template>
      <p v-else-if="preview">Choose a YouTube, Vimeo, or HTTPS MP4/WebM link.</p>
    </template>
    <ul v-else-if="section.type === 'downloads'" class="downloads">
      <li v-for="item in section.items" :key="item.id">
        <h3>{{ item.title || 'Document' }}</h3>
        <WebsiteText :text="item.text" :format="item.textFormat" :preview="preview" />
        <a
          v-if="publicHttpsUrl(item.linkUrl)"
          :href="item.linkUrl"
          target="_blank"
          rel="noopener noreferrer"
          download
          @click="preview && $event.preventDefault()"
          >{{ item.linkLabel || 'Download'
          }}<span class="link-note"> (opens in a new tab if needed)</span></a
        >
      </li>
    </ul>
    <p v-if="preview && section.type !== 'video' && !section.items.length">
      Add items in the editor.
    </p>
  </div>
</template>
<style scoped>
.interactive-widget {
  min-width: 0;
  width: 100%;
  overflow-wrap: anywhere;
  touch-action: pan-y;
  user-select: text;
}
.interactive-widget h2 {
  margin-top: 0;
}
.accordion-item {
  border-bottom: 1px solid #c8d0d8;
  padding: 0.7rem 0;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
.item-content {
  padding: 1rem 0.2rem;
}
.tab-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  border-bottom: 1px solid #c8d0d8;
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0.65rem 1rem;
  background: transparent;
  border: 1px solid #c8d0d8;
  border-radius: 4px;
}
[role='tab'][aria-selected='true'] {
  border-bottom: 3px solid currentColor;
  font-weight: bold;
}
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
.video-placeholder {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 0.6rem;
  border: 1px solid #c8d0d8;
  padding: 1rem;
}
button:disabled {
  cursor: default;
}
iframe,
video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  background: #111;
  margin-bottom: 0.6rem;
}
.downloads {
  list-style: none;
  padding: 0;
}
.downloads li {
  border-bottom: 1px solid #c8d0d8;
  padding: 0.8rem 0;
}
.downloads h3 {
  margin: 0;
}
.link-note {
  font-size: 0.8em;
}
a {
  color: inherit;
  text-decoration: underline;
}
</style>
