<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import DocumentZoomControls from './DocumentZoomControls.vue'
import { docxFrame, renderDocxPages, type DocxPages } from '@/features/documents/docxPreview'
const props = defineProps<{ bytes: ArrayBuffer; name: string; hideZoomControls?: boolean }>()
const emit = defineEmits<{ settled: [] }>()
const frameReady = ref(false)
function frameLoaded(event: Event) {
  if (event.currentTarget === previewFrame.value && previewFrame.value?.getAttribute('srcdoc') === frame.value) frameReady.value = true
}
const previewFrame = ref<HTMLIFrameElement>()
const host = ref<HTMLElement>(), pages = shallowRef<DocxPages>(), loading = ref(true), error = ref(''), width = ref(816)
const zoom = defineModel<number>('zoom', { default: 1 })
const frame = computed(() => pages.value ? docxFrame(pages.value, width.value, zoom.value) : '')
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width; if (next && Math.abs(next - width.value) > 1) width.value = next })
  if (host.value) { width.value = host.value.clientWidth || 816; observer.observe(host.value) }
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.bytes, async (bytes, _, cleanup) => {
  let active = true
  zoom.value = 1; frameReady.value = false; pages.value = undefined; error.value = ''; loading.value = true
  const timer = setTimeout(() => { if (active) { active = false; loading.value = false; error.value = 'The Word preview timed out. Download the original to open it in Word.' } }, 20000)
  const stopReady = watch(frameReady, ready => { if (ready) clearTimeout(timer) })
  cleanup(() => { active = false; clearTimeout(timer); stopReady() })
  try { const result = await renderDocxPages(bytes); if (active) pages.value = result }
  catch { if (active) error.value = 'This Word document could not be previewed. Download the original to open it in Word.' }
  finally { if (error.value || pages.value?.empty) clearTimeout(timer); if (active) loading.value = false }
}, { immediate: true })
watch([loading, error, frameReady], () => {
  if (!loading.value && (error.value || pages.value?.empty || frameReady.value)) emit('settled')
}, { flush: 'post' })
</script>
<template>
  <div ref="host" class="docx-viewer">
    <p v-if="loading" role="status">Preparing document pages.</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="pages?.empty" role="status">This document has no displayable text or images. It may be empty or contain unsupported Word objects. Open the original in Word.</p>
    <template v-else-if="pages">
      <div v-if="!hideZoomControls" class="docx-toolbar"><DocumentZoomControls :zoom="zoom" fit-label="Fit page width" group-label="Word document zoom" @change="zoom = $event" /><span aria-live="polite">{{ Math.round(zoom * 100) }}% of fit</span></div>
      <p class="docx-note" title="Scroll to view pages. Pages follow saved Word breaks; fonts, complex objects and exact pagination may differ. Open the original for full fidelity.">{{ pages.pageCount }} {{ pages.pageCount === 1 ? 'page' : 'pages' }} · Word preview<span v-if="pages.omittedExternalContent"> · External links disabled</span></p>
      <iframe ref="previewFrame" @load="frameLoaded" :srcdoc="frame" sandbox="" referrerpolicy="no-referrer" :title="`${name} — document pages`" class="docx-pages" />
    </template>
  </div>
</template>
<style scoped>
.docx-viewer { display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:hidden;background:#525659; }
.docx-viewer > p { margin:0;padding:.5rem;font-size:.8rem; }
.docx-toolbar { display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.5rem;flex:none;padding:.25rem;background:var(--panel-background);color:var(--text-muted);font-size:.8rem; }
.docx-note { background:var(--panel-background);color:var(--text-muted);flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25; }
.docx-pages { display:block;width:100%;flex:1;min-height:0;border:0;background:#525659; }
</style>
