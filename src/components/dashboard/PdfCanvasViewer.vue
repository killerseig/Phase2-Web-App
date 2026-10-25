<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { previewFileUrl } from '@/features/documents/formats'
import PdfPageCanvas from './PdfPageCanvas.vue'
GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps<{ url: string }>()
const pdf = shallowRef<PDFDocumentProxy>(), pageNumber = ref(1), zoom = ref(1)
const loading = ref(true), error = ref(''), surface = ref<HTMLElement>()
const width = ref(300), viewportHeight = ref(600), scrollTop = ref(0), firstRatio = ref(792 / 612)
const ratios = ref<Record<number, number>>({})
const maxCanvases = 6
let observer: ResizeObserver | undefined
const layouts = computed(() => {
  let top = 8
  const pageWidth = Math.max(80, width.value) * zoom.value
  return Array.from({ length: pdf.value?.numPages || 0 }, (_, index) => {
    const number = index + 1, height = pageWidth * (ratios.value[number] || firstRatio.value)
    const row = { number, top, height, width: pageWidth }
    top += height + 12
    return row
  })
})
function indexAt(top: number) {
  let low = 0, high = layouts.value.length - 1
  while (low < high) { const mid = Math.floor((low + high) / 2); if (layouts.value[mid]!.top + layouts.value[mid]!.height + 12 <= top) low = mid + 1; else high = mid }
  return low
}
const renderPages = computed(() => {
  if (!layouts.value.length) return new Set<number>()
  const first = indexAt(scrollTop.value), last = indexAt(scrollTop.value + viewportHeight.value)
  const start = Math.max(0, first - (last - first + 1 < maxCanvases ? 1 : 0))
  const end = Math.min(layouts.value.length, last + 2, start + maxCanvases)
  return new Set(layouts.value.slice(start, end).map(row => row.number))
})
function readScroll() {
  if (!surface.value) return
  scrollTop.value = surface.value.scrollTop
  viewportHeight.value = surface.value.clientHeight || 600
  if (pdf.value) {
    const atEnd = scrollTop.value > 0 && surface.value.scrollHeight > viewportHeight.value && surface.value.scrollHeight - viewportHeight.value - scrollTop.value <= 1
    pageNumber.value = atEnd ? pdf.value.numPages : (layouts.value[indexAt(scrollTop.value + 1)]?.number || 1)
  }
}
function anchor() {
  const row = layouts.value[indexAt(scrollTop.value)]
  return row ? { number: row.number, fraction: Math.max(0, (scrollTop.value - row.top) / (row.height + 12)) } : { number: 1, fraction: 0 }
}
function restore(position: ReturnType<typeof anchor>) {
  void nextTick(() => {
    const row = layouts.value[position.number - 1]
    if (surface.value && row) { surface.value.scrollTop = row.top + position.fraction * (row.height + 12); readScroll() }
  })
}
function setZoom(value: number) { const position = anchor(); zoom.value = value; restore(position) }
function jumpTo(value: number) {
  const number = Math.max(1, Math.min(pdf.value?.numPages || 1, Math.trunc(value) || 1)), row = layouts.value[number - 1]
  if (surface.value && row) { surface.value.scrollTop = row.top; pageNumber.value = number; readScroll() }
}
function measure(number: number, ratio: number) {
  if (Number.isFinite(ratio) && ratio > 0 && ratios.value[number] !== ratio) {
    const position = anchor()
    ratios.value = { ...ratios.value, [number]: ratio }
    restore(position)
  }
}
watch(() => props.url, async (url, _, cleanup) => {
  let active = true, task: ReturnType<typeof getDocument> | undefined
  cleanup(() => { active = false; void task?.destroy().catch(() => undefined) })
  pdf.value = undefined; loading.value = true; error.value = ''; pageNumber.value = 1; zoom.value = 1
  ratios.value = {}; scrollTop.value = 0; if (surface.value) surface.value.scrollTop = 0
  try {
    task = getDocument({ url: previewFileUrl(url), cMapUrl: '/sds-pdf-assets/cmaps/', cMapPacked: true, standardFontDataUrl: '/sds-pdf-assets/standard_fonts/', wasmUrl: '/sds-pdf-assets/wasm/' })
    const document = await task.promise
    if (!active) return
    const first = await document.getPage(1)
    if (!active) { first.cleanup(); return }
    const base = first.getViewport({ scale: 1 }); firstRatio.value = base.height / base.width; first.cleanup()
    pdf.value = document
    await nextTick(); if (active) readScroll()
  } catch { if (active) error.value = 'The PDF could not be loaded. Reload the preview to try again.' }
  finally { if (active) loading.value = false }
}, { immediate: true })
function changePage(event: Event) { const input = event.target as HTMLInputElement; jumpTo(Number(input.value)); input.value = String(pageNumber.value) }
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    const position = anchor()
    width.value = entry.contentRect.width || 300; viewportHeight.value = surface.value?.clientHeight || 600
    restore(position)
  })
  if (surface.value) observer.observe(surface.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div class="pdf-canvas-viewer">
    <div v-if="pdf" class="pdf-controls">
      <button type="button" aria-label="Previous page" :disabled="pageNumber <= 1" @click="jumpTo(pageNumber - 1)">&lt;</button>
      <input aria-label="PDF page" type="number" min="1" :max="pdf.numPages" :value="pageNumber" @change="changePage" />
      <span>/ {{ pdf.numPages }}</span>
      <button type="button" aria-label="Next page" :disabled="pageNumber >= pdf.numPages" @click="jumpTo(pageNumber + 1)">&gt;</button>
      <button type="button" aria-label="Zoom out" :disabled="zoom <= .5" @click="setZoom(Math.max(.5, zoom - .25))">-</button>
      <button type="button" aria-label="Fit page width" @click="setZoom(1)">Fit</button>
      <button type="button" aria-label="Zoom in" :disabled="zoom >= 3" @click="setZoom(Math.min(3, zoom + .25))">+</button>
    </div>
    <p v-if="loading" class="pdf-status" role="status">Loading PDF.</p>
    <p v-if="error" class="pdf-status" role="alert">{{ error }}</p>
    <div ref="surface" class="pdf-surface" role="region" aria-label="PDF pages" tabindex="0" :aria-busy="loading" @scroll.passive="readScroll">
      <div class="pdf-page-stack">
        <div v-for="row in layouts" :key="row.number" :data-pdf-page="row.number" class="pdf-page" :style="{ width: row.width + 'px', height: row.height + 'px' }">
          <PdfPageCanvas v-if="pdf && renderPages.has(row.number)" :document="pdf" :number="row.number" :width="row.width" :pixel-budget="4000000" @measure="measure" />
          <span v-else class="pdf-placeholder" aria-hidden="true">Page {{ row.number }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.pdf-canvas-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.pdf-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.15rem;
  padding: 0.15rem;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--border);
}
button,
input {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 3px;
}
button {
  min-width: 26px;
  min-height: 28px;
  cursor: pointer;
}
button:hover:not(:disabled),
button:focus-visible {
  background: var(--field-hover);
  outline: 1px solid var(--accent);
}
button:disabled {
  opacity: 0.4;
}
input {
  width: 2.6rem;
  border: 1px solid var(--border);
  text-align: center;
  padding: 0.15rem;
}
.pdf-surface {
  overflow: auto;
  flex: 1;
  min-height: 0;
  padding: 8px;
  background: #525659;
}
.pdf-page-stack { display:flex;flex-direction:column;gap:12px;min-width:100%;width:max-content; }
.pdf-page { position:relative;flex:none;margin:0 auto;background:white;color:#222;box-shadow:0 1px 5px #0004; }
.pdf-placeholder { display:block;padding:1rem;font-size:.85rem;color:#555; }
.pdf-surface:focus-visible { outline:2px solid var(--accent);outline-offset:-2px; }
.pdf-status {
  margin: 0;
  padding: 0.5rem;
  font-size: 0.8rem;
}
</style>
