<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIconButton from '@/components/common/AppIconButton.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import DocumentZoomControls from '@/components/dashboard/DocumentZoomControls.vue'
const props = defineProps<{ photo: { name: string; url: string; description: string }; sectionTitle: string; position: number; total: number }>()
const emit = defineEmits<{ close: []; previous: []; next: [] }>()
const panel = ref<HTMLElement | null>(null), scroll = ref<HTMLElement | null>(null), zoom = ref(1)
const dimensions = ref<{ width: number; height: number } | null>(null), failed = ref(false)
const lowResolution = computed(() => dimensions.value && Math.max(dimensions.value.width, dimensions.value.height) <= 480)
let zoomEpoch = 0, priorFocus: HTMLElement | null = null, priorOverflow = '', dragged = false
let drag: { x: number; y: number; left: number; top: number } | null = null
async function setZoom(value: number) {
  const viewport = scroll.value, current = ++zoomEpoch
  const x = viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(1, viewport.scrollWidth) : .5
  const y = viewport ? (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(1, viewport.scrollHeight) : .5
  zoom.value = Math.max(1, Math.min(3, value))
  await nextTick()
  if (current !== zoomEpoch || !scroll.value) return
  scroll.value.scrollLeft = x * scroll.value.scrollWidth - scroll.value.clientWidth / 2
  scroll.value.scrollTop = y * scroll.value.scrollHeight - scroll.value.clientHeight / 2
}
function loaded(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  dimensions.value = { width: image.naturalWidth, height: image.naturalHeight }
}
function toggleZoom() {
  if (dragged) { dragged = false; return }
  void setZoom(zoom.value === 1 ? 2 : 1)
}
function startDrag(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0 || zoom.value <= 1 || !scroll.value) return
  drag = { x: event.clientX, y: event.clientY, left: scroll.value.scrollLeft, top: scroll.value.scrollTop }
  dragged = false
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}
function moveDrag(event: PointerEvent) {
  if (!drag || !scroll.value) return
  const x = event.clientX - drag.x, y = event.clientY - drag.y
  dragged ||= Math.abs(x) + Math.abs(y) > 4
  scroll.value.scrollLeft = drag.left - x; scroll.value.scrollTop = drag.top - y
}
function endDrag() { drag = null }
function cancelDrag() { drag = null; dragged = false }
function keydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); void setZoom(zoom.value + .25); return }
  if (event.key === '-') { event.preventDefault(); void setZoom(zoom.value - .25); return }
  if (event.key === '0') { event.preventDefault(); void setZoom(1); return }
  if (event.key.startsWith('Arrow') && (event.target as HTMLElement)?.closest('.daily-log-gallery__image-scroll') && zoom.value > 1) return
  if (event.key === 'ArrowLeft') { event.preventDefault(); emit('previous') }
  if (event.key === 'ArrowRight') { event.preventDefault(); emit('next') }
  if (event.key === 'Tab' && panel.value) {
    const focusable = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length)
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first?.focus() }
  }
}
watch(() => props.photo.url, async () => {
  zoomEpoch++; zoom.value = 1; dimensions.value = null; failed.value = false; drag = null; dragged = false
  await nextTick()
  if (scroll.value) { scroll.value.scrollLeft = 0; scroll.value.scrollTop = 0 }
}, { immediate: true })
onMounted(() => {
  priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  priorOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  panel.value?.focus()
})
onBeforeUnmount(() => {
  zoomEpoch++
  if (document.body.style.overflow === 'hidden') document.body.style.overflow = priorOverflow
  if (priorFocus?.isConnected) priorFocus.focus()
})
</script>
<template>
  <div ref="panel" class="daily-log-gallery__lightbox" role="dialog" aria-modal="true" :aria-label="'Photo viewer: ' + photo.name" tabindex="-1" @keydown="keydown">
    <div class="daily-log-gallery__lightbox-bar">
      <span>{{ sectionTitle }}: {{ position }} of {{ total }}</span>
      <div class="daily-log-gallery__photo-tools">
        <DocumentZoomControls :zoom="zoom" :min-zoom="1" group-label="Photo zoom" fit-label="Fit photo" @change="setZoom" />
        <span aria-live="polite" :aria-label="Math.round(zoom * 100) + '% of fitted view'">{{ Math.round(zoom * 100) }}%</span>
        <a class="app-button app-button--ghost" :href="photo.url" target="_blank" rel="noopener noreferrer">Open original</a>
      </div>
      <AppIconButton label="Close photo viewer" @click="emit('close')"><i class="pi pi-times" aria-hidden="true"></i></AppIconButton>
    </div>
    <AppStatusMessage v-if="failed" tone="error" message="This photo could not be displayed. Try opening the original file." />
    <div class="daily-log-gallery__lightbox-stage">
      <div ref="scroll" class="daily-log-gallery__image-scroll" tabindex="0" aria-label="Photo detail. Zoom in, then scroll or drag to inspect the image.">
        <button class="daily-log-gallery__image-canvas" :class="{ 'is-zoomed': zoom > 1 }" :style="{ width: zoom * 100 + '%', height: zoom * 100 + '%' }" type="button" :aria-label="zoom === 1 ? 'Zoom photo in' : 'Fit photo to screen'" @click="toggleZoom" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="cancelDrag">
          <img :key="photo.url" :src="photo.url" :alt="photo.name" draggable="false" @load="loaded" @error="failed = true" />
        </button>
      </div>
      <AppIconButton v-if="total > 1" class="daily-log-gallery__lightbox-nav daily-log-gallery__lightbox-nav--previous" label="Previous photo" @click="emit('previous')"><i class="pi pi-chevron-left" aria-hidden="true"></i></AppIconButton>
      <AppIconButton v-if="total > 1" class="daily-log-gallery__lightbox-nav daily-log-gallery__lightbox-nav--next" label="Next photo" @click="emit('next')"><i class="pi pi-chevron-right" aria-hidden="true"></i></AppIconButton>
    </div>
    <div class="daily-log-gallery__lightbox-caption">
      <strong>{{ photo.name }}</strong><span v-if="photo.description">{{ photo.description }}</span>
      <span v-if="dimensions">Stored original: {{ dimensions.width }} × {{ dimensions.height }} pixels.<template v-if="lowResolution"> This file has limited detail; zoom cannot restore missing resolution.</template></span>
    </div>
  </div>
</template>
<style scoped>
.daily-log-gallery__lightbox { position: fixed; inset: 0; height: 100dvh; max-height: 100dvh; z-index: 2000; display: grid; grid-template-rows: auto minmax(0,1fr) auto; gap: .75rem; min-width: 0; min-height: 0; overflow: hidden; padding: max(.75rem,env(safe-area-inset-top)) max(.75rem,env(safe-area-inset-right)) max(.75rem,env(safe-area-inset-bottom)) max(.75rem,env(safe-area-inset-left)); background: var(--bg-elevated); outline: none; }
.daily-log-gallery__lightbox:has(> .app-status-message) { grid-template-rows: auto auto minmax(0,1fr) auto; }
.daily-log-gallery__lightbox-bar { display: flex; align-items: center; justify-content: space-between; gap: .5rem; color: var(--text-muted); font-size: var(--font-size-help); }
.daily-log-gallery__photo-tools { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: .5rem; }
.daily-log-gallery__lightbox :deep(.app-icon-button) { --app-icon-button-size: 2.75rem; --app-icon-button-background: var(--surface-raised); }
.daily-log-gallery__lightbox-stage { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.daily-log-gallery__image-scroll { position: absolute; inset: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; }
.daily-log-gallery__image-canvas { position: relative; display: block; border: 0; padding: 0; margin: 0; background: transparent; cursor: zoom-in; }
.daily-log-gallery__image-canvas.is-zoomed { cursor: grab; }
.daily-log-gallery__image-canvas.is-zoomed:active { cursor: grabbing; }
.daily-log-gallery__image-canvas img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; }
.daily-log-gallery__lightbox-nav { position: absolute; top: 50%; z-index: 1; transform: translateY(-50%); }
.daily-log-gallery__lightbox-nav--previous { left: .25rem; }
.daily-log-gallery__lightbox-nav--next { right: .25rem; }
.daily-log-gallery__lightbox-caption { display: grid; gap: .2rem; justify-items: center; max-height: 20dvh; overflow: auto; color: var(--text); text-align: center; overflow-wrap: anywhere; white-space: pre-wrap; }
.daily-log-gallery__lightbox-caption span { color: var(--text-muted); font-size: var(--font-size-help); }
@media(max-width: 700px) { .daily-log-gallery__lightbox-bar { flex-wrap: wrap; } .daily-log-gallery__photo-tools { order: 3; width: 100%; } }
</style>
