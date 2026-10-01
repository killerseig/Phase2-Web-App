<script setup lang="ts">
import type { WebsiteItem } from '@/features/website/types'
import type { ImageSettings } from '../../../functions/src/websiteContent'
import WebsiteImage from './WebsiteImage.vue'
import WebsiteImagePicker from './WebsiteImagePicker.vue'
import WebsiteImageOverlay from './WebsiteImageOverlay.vue'
import WebsiteOverlayControls from './WebsiteOverlayControls.vue'
const props = defineProps<{
  item: WebsiteItem
  ratio: number
  contain?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{
  update: [value: Pick<WebsiteItem, 'imageId' | 'alt' | 'imageSettings'>]
  uploading: [value: boolean]
  done: []
}>()
function settings(value: ImageSettings | undefined) {
  emit('update', { imageId: props.item.imageId, alt: props.item.alt, imageSettings: value })
}
function focusAt(event: MouseEvent) {
  if (!event.detail) return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!box.width || !box.height) return
  settings({
    ...props.item.imageSettings,
    focusX: Math.round(Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100))),
    focusY: Math.round(Math.max(0, Math.min(100, ((event.clientY - box.top) / box.height) * 100))),
  })
}
function arrow(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  const key = ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 'focusX' : 'focusY'
  const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -5 : 5
  settings({
    ...props.item.imageSettings,
    [key]: Math.max(0, Math.min(100, (props.item.imageSettings?.[key] ?? 50) + delta)),
  })
}
function range(key: 'focusX' | 'focusY' | 'zoom' | 'darken', event: Event) {
  settings({ ...props.item.imageSettings, [key]: Number((event.target as HTMLInputElement).value) })
}
</script>
<template>
  <section
    class="image-editor"
    aria-label="Image editor"
    @keydown.esc.prevent.stop="!disabled && emit('done')"
  >
    <header>
      <h2>Edit image</h2>
      <button type="button" :disabled="disabled" @click="emit('done')">Done</button>
    </header>
    <fieldset :disabled="disabled">
      <template v-if="item.imageId">
        <div
          class="focal-preview"
          :style="{ aspectRatio: ratio, width: `min(100%, ${180 * ratio}px)` }"
        >
          <WebsiteImage
            :id="item.imageId"
            :alt="item.alt"
            preview
            :contain="contain"
            :settings="item.imageSettings"
          />
          <WebsiteImageOverlay :settings="item.imageSettings" />
        </div>
        <label>
          Darken image: {{ item.imageSettings?.darken ?? 0 }}%
          <input
            type="range"
            aria-label="Darken image"
            min="0"
            max="100"
            step="1"
            :value="item.imageSettings?.darken ?? 0"
            @input="range('darken', $event)"
          />
        </label>
        <WebsiteOverlayControls :value="item.imageSettings" @update="settings" />
        <details>
          <summary>Crop and focal point</summary>
          <p>
            Click the original below to keep that part of the image in focus. The cropped preview
            updates above. Arrow keys adjust the focal point.
          </p>
          <button
            class="focal-picker"
            type="button"
            aria-label="Set image focal point"
            @click="focusAt"
            @keydown="arrow"
          >
            <WebsiteImage :id="item.imageId" :alt="item.alt" preview />
            <span
              class="focal-marker"
              :style="{
                left: `${item.imageSettings?.focusX ?? 50}%`,
                top: `${item.imageSettings?.focusY ?? 50}%`,
              }"
              aria-hidden="true"
            />
          </button>
          <label
            v-for="field in [
              {
                key: 'focusX',
                label: 'Horizontal focal point',
                min: 0,
                max: 100,
                step: 1,
                fallback: 50,
              },
              {
                key: 'focusY',
                label: 'Vertical focal point',
                min: 0,
                max: 100,
                step: 1,
                fallback: 50,
              },
              { key: 'zoom', label: 'Crop zoom', min: 1, max: 3, step: 0.05, fallback: 1 },
            ] as const"
            :key="field.key"
          >
            {{ field.label }}
            <output>{{ item.imageSettings?.[field.key] ?? field.fallback }}</output>
            <input
              type="range"
              :aria-label="field.label"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :value="item.imageSettings?.[field.key] ?? field.fallback"
              @input="range(field.key, $event)"
            />
          </label>
          <button
            type="button"
            @click="settings({ ...item.imageSettings, focusX: 50, focusY: 50, zoom: 1 })"
          >
            Reset crop
          </button>
        </details>
      </template>
      <WebsiteImagePicker
        :image-id="item.imageId"
        :alt="item.alt"
        compact
        @update="emit('update', { ...$event, imageSettings: item.imageSettings })"
        @uploading="emit('uploading', $event)"
      />
      <small>Changes update your draft. Save when ready.</small>
    </fieldset>
  </section>
</template>
<style scoped>
.image-editor,
fieldset {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
h2 {
  margin: 0;
  font-size: 1rem;
}
button {
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.focal-preview {
  position: relative;
  overflow: hidden;
  background: var(--field);
  border-radius: 4px;
  margin-inline: auto;
}
.focal-picker {
  display: block;
  width: fit-content;
  max-width: 100%;
  position: relative;
  padding: 0;
  overflow: hidden;
  cursor: crosshair;
  margin-inline: auto;
}
.focal-picker :deep(img) {
  height: auto;
  width: auto;
  max-width: 100%;
  max-height: 160px;
}
.focal-marker {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 0 0 2px #168bd4;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
label {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.3rem;
  font-size: 0.8rem;
  margin: 0.6rem 0;
}
input {
  width: 100%;
  min-width: 0;
  grid-column: 1 / -1;
}
p,
small {
  font-size: 0.75rem;
  color: var(--text-muted);
}
summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}
</style>
