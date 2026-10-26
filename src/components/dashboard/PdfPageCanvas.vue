<script setup lang="ts">
import { ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
const props = defineProps<{ document: PDFDocumentProxy; number: number; width: number; pixelBudget: number }>()
const emit = defineEmits<{ measure: [number: number, ratio: number] }>()
const host = ref<HTMLElement>(), loading = ref(true), error = ref(''), retry = ref(0)
watch(() => [props.document, props.number, props.width, retry.value] as const, async ([document, number, width], _, cleanup) => {
  let active = true, page: PDFPageProxy | undefined, task: RenderTask | undefined, canvas: HTMLCanvasElement | undefined
  const release = () => { if (canvas) { canvas.width = 0; canvas.height = 0 }; page?.cleanup() }
  cleanup(() => {
    active = false; task?.cancel()
    if (task) void task.promise.catch(() => undefined).then(release)
    else release()
  })
  loading.value = true; error.value = ''; host.value?.replaceChildren()
  try {
    page = await document.getPage(number)
    if (!active) { page.cleanup(); return }
    const base = page.getViewport({ scale: 1 })
    emit('measure', number, base.height / base.width)
    const viewport = page.getViewport({ scale: width / base.width })
    canvas = window.document.createElement('canvas')
    const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(props.pixelBudget / (viewport.width * viewport.height)))
    canvas.width = Math.ceil(viewport.width * density); canvas.height = Math.ceil(viewport.height * density)
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `PDF page ${number} of ${document.numPages}`)
    canvas.dataset.page = String(number)
    task = page.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] })
    await task.promise
    if (active) host.value?.replaceChildren(canvas)
  } catch {
    if (active) error.value = `PDF page ${number} could not be displayed. Retry or open the original PDF.`
  } finally { if (active) loading.value = false }
}, { immediate: true })
</script>
<template>
  <div class="pdf-page-canvas" :aria-busy="loading">
    <div ref="host" />
    <p v-if="loading" class="page-state" role="status">Rendering page {{ number }}.</p>
    <div v-if="error" class="page-state" role="alert">{{ error }} <AppButton @click="retry++">Retry page</AppButton></div>
  </div>
</template>
<style scoped>
.pdf-page-canvas { position:relative;width:100%;height:100%; }
.page-state { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.5rem;margin:0;padding:1rem;font-size:.85rem; }
.pdf-page-canvas :deep(canvas) { display:block;background:white; }
</style>
