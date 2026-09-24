<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps<{ url: string }>()
const pdf = shallowRef<PDFDocumentProxy>()
const pageNumber = ref(1)
const zoom = ref(1)
const loading = ref(true)
const rendering = ref(false)
const error = ref('')
const surface = ref<HTMLElement>()
const width = ref(300)
let observer: ResizeObserver | undefined
watch(
  () => props.url,
  async (url, _, cleanup) => {
    let active = true
    const ticket = new URL(url).searchParams.get('ticket')
    const task = getDocument({
      url: `/sds-file?ticket=${encodeURIComponent(ticket ?? '')}`,
      cMapUrl: '/sds-pdf-assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/sds-pdf-assets/standard_fonts/',
      wasmUrl: '/sds-pdf-assets/wasm/',
    })
    cleanup(() => {
      active = false
      void task.destroy()
    })
    pdf.value = undefined
    surface.value?.replaceChildren()
    loading.value = true
    error.value = ''
    pageNumber.value = 1
    zoom.value = 1
    try {
      const document = await task.promise
      if (active) pdf.value = document
    } catch {
      if (active) error.value = 'The PDF could not be loaded. Reload the preview to try again.'
    } finally {
      if (active) loading.value = false
    }
  },
  { immediate: true },
)
watch(
  () => [pdf.value, pageNumber.value, zoom.value, width.value] as const,
  async ([document, number, scale, availableWidth], _, cleanup) => {
    if (!document) return
    let active = true
    let cancel: (() => void) | undefined
    cleanup(() => {
      active = false
      cancel?.()
    })
    rendering.value = true
    error.value = ''
    surface.value?.replaceChildren()
    try {
      const page = await document.getPage(number)
      if (!active) return
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({
        scale: (Math.max(80, availableWidth - 16) / base.width) * scale,
      })
      const canvas = window.document.createElement('canvas')
      const density = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(12000000 / (viewport.width * viewport.height)),
      )
      canvas.width = Math.ceil(viewport.width * density)
      canvas.height = Math.ceil(viewport.height * density)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', `PDF page ${number} of ${document.numPages}`)
      canvas.dataset.page = String(number)
      const task = page.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] })
      cancel = () => task.cancel()
      await task.promise
      await nextTick()
      if (active) {
        surface.value?.replaceChildren(canvas)
        surface.value?.scrollTo(0, 0)
      }
    } catch {
      if (active)
        error.value =
          'This PDF page could not be displayed. Try reloading or open the original PDF.'
    } finally {
      if (active) rendering.value = false
    }
  },
)
function changePage(event: Event) {
  const input = event.target as HTMLInputElement
  const value = Math.trunc(Number(input.value))
  pageNumber.value = Math.max(1, Math.min(pdf.value?.numPages ?? 1, value || 1))
  input.value = String(pageNumber.value)
}
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = entry.contentRect.width
  })
  if (surface.value) observer.observe(surface.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div class="pdf-canvas-viewer">
    <div v-if="pdf" class="pdf-controls">
      <button
        type="button"
        aria-label="Previous page"
        :disabled="pageNumber <= 1"
        @click="pageNumber--"
      >
        ‹
      </button>
      <input
        aria-label="PDF page"
        type="number"
        min="1"
        :max="pdf.numPages"
        :value="pageNumber"
        @change="changePage"
      />
      <span>/ {{ pdf.numPages }}</span>
      <button
        type="button"
        aria-label="Next page"
        :disabled="pageNumber >= pdf.numPages"
        @click="pageNumber++"
      >
        ›
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        :disabled="zoom <= 0.5"
        @click="zoom = Math.max(0.5, zoom - 0.25)"
      >
        −
      </button>
      <button type="button" aria-label="Fit page width" @click="zoom = 1">Fit</button>
      <button
        type="button"
        aria-label="Zoom in"
        :disabled="zoom >= 3"
        @click="zoom = Math.min(3, zoom + 0.25)"
      >
        +
      </button>
    </div>
    <p v-if="loading || rendering" class="pdf-status" role="status">
      {{ loading ? 'Loading PDF…' : 'Rendering page…' }}
    </p>
    <p v-if="error" class="pdf-status" role="alert">{{ error }}</p>
    <div ref="surface" class="pdf-surface" :aria-busy="loading || rendering" />
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
.pdf-surface :deep(canvas) {
  display: block;
  margin: 0 auto;
  background: white;
  box-shadow: 0 1px 5px #0004;
}
.pdf-status {
  margin: 0;
  padding: 0.5rem;
  font-size: 0.8rem;
}
</style>
