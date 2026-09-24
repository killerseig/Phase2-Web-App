<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import type { SdsSheet } from '@/features/sds/types'
import { sdsCommand, sdsErrorMessage } from '@/services/sds'
const PdfCanvasViewer = defineAsyncComponent(() => import('./PdfCanvasViewer.vue'))
const FileContentViewer = defineAsyncComponent(() => import('./FileContentViewer.vue'))

const props = defineProps<{
  sheet?: SdsSheet
  jobId: string
  version: string
  earlierRevision: boolean
}>()
const emit = defineEmits<{ open: [download: boolean] }>()
const url = ref('')
const extension = ref('pdf')
const loading = ref(false)
const error = ref('')
const retry = ref(0)
watch(
  () => [props.sheet?.id, props.sheet?.revisionId, props.jobId, props.version, retry.value],
  async (_, __, cleanup) => {
    let active = true
    cleanup(() => {
      active = false
    })
    url.value = ''
    extension.value = props.sheet?.extension ?? 'pdf'
    error.value = ''
    loading.value = !!props.sheet
    if (!props.sheet) return
    try {
      const result = await sdsCommand<{ url: string; extension?: string }>('openSheet', {
        id: props.sheet.id,
        jobId: props.jobId,
        download: false,
      })
      if (active) {
        url.value = result.url
        extension.value = result.extension ?? props.sheet.extension ?? 'pdf'
      }
    } catch (e) {
      if (active) error.value = sdsErrorMessage(e)
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
      <button
        type="button"
        aria-label="Reload preview"
        title="Reload preview"
        :disabled="loading"
        @click="retry++"
      >
        <i class="pi pi-refresh" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="extension === 'pdf' ? 'Open PDF' : 'Open original'"
        title="Open original in a new tab"
        @click="emit('open', false)"
      >
        <i class="pi pi-external-link" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Download file"
        title="Download file"
        @click="emit('open', true)"
      >
        <i class="pi pi-download" aria-hidden="true" />
      </button>
    </div>
    <p v-if="sheet.archived" class="viewer-note">
      Archived — resolve before exporting the job book.
    </p>
    <p v-else-if="earlierRevision" class="viewer-note">
      Job’s saved revision. Choose “Use latest revision” from the file menu to update it.
    </p>
    <p v-if="loading" class="viewer-state" role="status">Loading preview…</p>
    <div v-else-if="error" class="viewer-state" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="retry++">Retry preview</button>
    </div>
    <PdfCanvasViewer v-else-if="url && extension === 'pdf'" :key="url" :url="url" />
    <FileContentViewer
      v-else-if="url"
      :key="url"
      :url="url"
      :extension="extension"
      :name="sheet.name"
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
button {
  font: inherit;
  color: inherit;
  border: 0;
  border-radius: 3px;
  background: transparent;
  padding: 0.35rem;
  cursor: pointer;
}
button:hover,
button:focus-visible {
  background: var(--field-hover);
  outline: 2px solid var(--accent);
}
button:disabled {
  opacity: 0.5;
}
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
