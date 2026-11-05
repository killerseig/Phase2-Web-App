<script setup lang="ts">
import { libraryCommand } from '@/features/sds/commands'
import { computed, defineAsyncComponent, inject, onBeforeUnmount, onErrorCaptured, provide, ref, shallowRef, watch } from 'vue'
import type { SdsSheet } from '@/features/sds/types'
import { sdsErrorMessage } from '@/services/sds'
import { createViewerSession, loadFileViewer, loadPdfViewer, viewerSessionKey } from '@/features/documents/viewerSession'
import type { RenewDocumentTicket } from '@/features/documents/authorizedFetch'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'
import DocumentZoomControls from './DocumentZoomControls.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppIconButton from '@/components/common/AppIconButton.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
const PdfCanvasViewer = defineAsyncComponent(loadPdfViewer)
const FileContentViewer = defineAsyncComponent(loadFileViewer)
const inheritedSession = inject(viewerSessionKey, undefined)
const session = inheritedSession ?? createViewerSession()
provide(viewerSessionKey, session)
onBeforeUnmount(() => { if (!inheritedSession) session.dispose() })

const props = defineProps<{
  sheet?: SdsSheet
  jobId: string
  version: string
  earlierRevision: boolean
}>()
const emit = defineEmits<{ open: [download: boolean] }>()
const url = ref('')
const cacheKey = ref('')
const renewTicket = shallowRef<RenewDocumentTicket>()
const extension = ref('pdf')
const zoom = ref(1)
const zoomable = computed(() => ['pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp'].includes(extension.value))
const loading = ref(false)
const rendering = ref(false)
function previewSettled(source: string) { if (source && source === url.value) rendering.value = false }
onErrorCaptured(() => {
  error.value = 'The preview could not be prepared. Reload the preview to try again.'
  rendering.value = false
  return false
})
const error = ref('')
const retry = ref(0)
function reloadPreview() { session.cache.clear(); retry.value++ }
watch(
  () => [props.sheet?.id, props.sheet?.revisionId, props.jobId, props.version, retry.value],
  async (_, __, cleanup) => {
    const accessContext = session.cache.generation
    let active = true
    cleanup(() => {
      active = false
    })
    zoom.value = 1
    url.value = ''
    cacheKey.value = ''
    renewTicket.value = undefined
    extension.value = props.sheet?.extension ?? 'pdf'
    error.value = ''
    rendering.value = !!props.sheet
    loading.value = !!props.sheet
    if (!props.sheet || !session.isCurrent(accessContext)) { loading.value = false; rendering.value = false; return }
    // Only public renderer code/worker startup overlaps authorization. The
    // private file is still requested only after openSheet succeeds.
    void session.prepare(extension.value).catch(() => undefined)
    try {
      const result = await libraryCommand('openSheet', {
        id: props.sheet.id,
        jobId: props.jobId,
        download: false,
      })
      if (active && session.isCurrent(accessContext)) {
        const id = props.sheet.id, jobId = props.jobId
        const expectedExtension = result.extension ?? props.sheet.extension ?? 'pdf'
        renewTicket.value = async () => {
          const current = () => active && session.isCurrent(accessContext)
          if (!current()) throw new DOMException('Document closed', 'AbortError')
          const fresh = await libraryCommand('openSheet', { id, jobId, download: false })
          if (!current()) throw new DOMException('Document closed', 'AbortError')
          if (!result.revisionId || fresh.revisionId !== result.revisionId || (fresh.extension ?? expectedExtension) !== expectedExtension)
            throw new Error('The document version changed. Reopen it to continue.')
          return fresh.url
        }
        cacheKey.value = session.cache.authorize(props.sheet.id, result.revisionId)
        url.value = result.url
        extension.value = result.extension ?? props.sheet.extension ?? 'pdf'
      }
    } catch (e) {
      if (active && session.isCurrent(accessContext)) { session.cache.clear(); error.value = sdsErrorMessage(e); rendering.value = false }
    } finally {
      if (active) loading.value = false
    }
  },
  { immediate: true, flush: 'sync' },
)
</script>

<template>
  <template v-if="sheet">
    <div class="viewer-toolbar">
      <span
        class="viewer-name"
        :title="
          [sheet.name, sheet.manufacturer, sheet.productCode, sheet.language]
            .filter(Boolean)
            .join(' · ')
        "
        >{{ sheet.name }}</span
      >
      <DocumentZoomControls v-if="url && zoomable && !error" class="viewer-zoom" :zoom="zoom" fit-label="Fit file width" :group-label="extension === 'docx' ? 'Word document zoom' : 'Document zoom'" @change="zoom = $event" />
      <span v-if="url && zoomable" class="viewer-zoom-status" role="status">{{ Math.round(zoom * 100) }}% of fit</span>
      <div class="viewer-operations" role="group" aria-label="File actions">
      <AppIconButton
        type="button"
        label="Reload preview"
        title="Reload preview"
        :disabled="loading"
        @click="reloadPreview"
      >
        <i class="pi pi-refresh" aria-hidden="true" />
      </AppIconButton>
      <AppIconButton
        type="button"
        :label="extension === 'pdf' ? 'Open PDF' : 'Open original'"
        title="Open original in a new tab"
        @click="emit('open', false)"
      >
        <i class="pi pi-external-link" aria-hidden="true" />
      </AppIconButton>
      <AppIconButton
        type="button"
        label="Download file"
        title="Download file"
        @click="emit('open', true)"
      >
        <i class="pi pi-download" aria-hidden="true" />
      </AppIconButton>
      </div>
    </div>
    <p v-if="sheet.archived" class="viewer-note">
      Archived — resolve before exporting the job book.
    </p>
    <p v-else-if="earlierRevision" class="viewer-note">
      Job’s saved revision. Choose “Use latest revision” from the file menu to update it.
    </p>
    <AppLoadingRegion class="viewer-loading-region" :loading="loading || rendering" :label="`Loading ${sheet.name}.`" aria-label="Document preview">
    <div v-if="error" class="viewer-state">
      <AppStatusMessage :message="error" tone="error" />
      <AppButton type="button" @click="reloadPreview">Retry preview</AppButton>
    </div>
    <PdfCanvasViewer v-else-if="url && extension === 'pdf'" :key="url" v-model:zoom="zoom" hide-zoom-controls :url="url" :cache-key="cacheKey" :renew-ticket="renewTicket" @settled="previewSettled" />
    <FileContentViewer
      v-else-if="url"
      :key="url"
      v-model:zoom="zoom"
      hide-zoom-controls
      :url="url"
      :extension="extension"
      :name="sheet.name"
      :cache-key="cacheKey"
      :renew-ticket="renewTicket"
      @settled="previewSettled"
    />
    </AppLoadingRegion>
  </template>
  <div v-else class="viewer-state viewer-placeholder">
    <i class="pi pi-file" aria-hidden="true" />
    <p>Select a file to preview it.</p>
  </div>
</template>

<style scoped>
.viewer-loading-region { flex: 1; --loading-region-min-height: 12rem; --loading-region-gap: 0; overflow: hidden; }
.viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-wrap: wrap;
  padding: 0.25rem 0.45rem;
  border-bottom: 1px solid var(--border);
  min-height: 32px;
}
.viewer-name {
  flex: 1 1 2rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}
.viewer-toolbar :deep(.app-icon-button) { flex-shrink: 0; --app-icon-button-size: 1.8rem; }
.viewer-operations { display:flex;align-items:center;gap:.2rem;flex-shrink:0;margin-inline-start:2rem; }
.viewer-zoom :deep(.app-button) { min-height: 1.8rem; padding-inline: .4rem; }
.viewer-zoom-status { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap; }
.viewer-state > .app-button { margin-top: .75rem; }
.viewer-pdf {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 0;
  background: #525659;
}
.viewer-state {
  margin: auto;
  padding: 1rem;
  text-align: center;
  font-size: 0.85rem;
}
.viewer-placeholder {
  color: var(--text-muted);
}
.viewer-placeholder > i {
  font-size: 2rem;
  opacity: 0.6;
}
.viewer-note {
  font-size: 0.75rem;
  padding: 0.3rem 0.5rem;
  margin: 0;
  background: var(--field-hover);
}
.viewer-hint {
  font-size: 0.65rem;
  color: var(--text-muted);
  padding: 0.15rem 0.4rem;
}
</style>
