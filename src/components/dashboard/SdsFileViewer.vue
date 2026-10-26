<script setup lang="ts">
import { libraryCommand } from '@/features/sds/commands'
import { defineAsyncComponent, inject, onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import type { SdsSheet } from '@/features/sds/types'
import { sdsErrorMessage } from '@/services/sds'
import { createViewerSession, loadFileViewer, loadPdfViewer, viewerSessionKey } from '@/features/documents/viewerSession'
import type { RenewDocumentTicket } from '@/features/documents/authorizedFetch'
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
const loading = ref(false)
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
    url.value = ''
    cacheKey.value = ''
    renewTicket.value = undefined
    extension.value = props.sheet?.extension ?? 'pdf'
    error.value = ''
    loading.value = !!props.sheet
    if (!props.sheet || !session.isCurrent(accessContext)) { loading.value = false; return }
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
      if (active && session.isCurrent(accessContext)) { session.cache.clear(); error.value = sdsErrorMessage(e) }
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
    <p v-if="sheet.archived" class="viewer-note">
      Archived — resolve before exporting the job book.
    </p>
    <p v-else-if="earlierRevision" class="viewer-note">
      Job’s saved revision. Choose “Use latest revision” from the file menu to update it.
    </p>
    <p v-if="loading" class="viewer-state" role="status">Loading preview…</p>
    <div v-else-if="error" class="viewer-state">
      <AppStatusMessage :message="error" tone="error" />
      <AppButton type="button" @click="reloadPreview">Retry preview</AppButton>
    </div>
    <PdfCanvasViewer v-else-if="url && extension === 'pdf'" :key="url" :url="url" :cache-key="cacheKey" :renew-ticket="renewTicket" />
    <FileContentViewer
      v-else-if="url"
      :key="url"
      :url="url"
      :extension="extension"
      :name="sheet.name"
      :cache-key="cacheKey"
      :renew-ticket="renewTicket"
    />
  </template>
  <div v-else class="viewer-state viewer-placeholder">
    <i class="pi pi-file" aria-hidden="true" />
    <p>Select a file to preview it.</p>
  </div>
</template>

<style scoped>
.viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem 0.45rem;
  border-bottom: 1px solid var(--border);
  min-height: 32px;
}
.viewer-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}
.viewer-toolbar .app-icon-button { flex-shrink: 0; }
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
