<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { previewFileUrl, type FilePreview } from '@/features/documents/formats'
const props = defineProps<{ url: string; extension: string; name: string }>()
const imageUrl = ref('')
const preview = ref<FilePreview>()
const loading = ref(true)
const error = ref('')
const sheetIndex = ref(0)
const zoom = ref(1)
const table = computed(() =>
  preview.value && 'tables' in preview.value ? preview.value.tables[sheetIndex.value] : undefined,
)
watch(
  () => [props.url, props.extension],
  async (_, __, cleanup) => {
    let active = true,
      objectUrl = ''
    let worker: Worker | undefined
    const controller = new AbortController()
    cleanup(() => {
      active = false
      controller.abort()
      worker?.terminate()
      clearTimeout(timeout)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })
    loading.value = true
    imageUrl.value = ''
    preview.value = undefined
    error.value = ''
    sheetIndex.value = 0
    zoom.value = 1
    const timeout = setTimeout(() => {
      controller.abort()
      worker?.terminate()
      if (active) {
        loading.value = false
        error.value = 'Preview timed out. Reload or download the original file.'
      }
    }, 20000)
    try {
      const response = await fetch(previewFileUrl(props.url), {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('File unavailable')
      const bytes = await response.arrayBuffer()
      if (!active) return
      if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('File too large')
      if (['jpg', 'jpeg', 'png', 'webp'].includes(props.extension)) {
        objectUrl = URL.createObjectURL(
          new Blob([bytes], {
            type: response.headers.get('Content-Type') ?? 'application/octet-stream',
          }),
        )
        imageUrl.value = objectUrl
        loading.value = false
        clearTimeout(timeout)
      } else {
        worker = new Worker(
          new URL('../../features/documents/preview.worker.ts', import.meta.url),
          { type: 'module' },
        )
        worker.onmessage = (event: MessageEvent<{ result?: FilePreview; error?: string }>) => {
          if (active) {
            preview.value = event.data.result
            error.value = event.data.error ?? ''
            loading.value = false
          }
          clearTimeout(timeout)
          worker?.terminate()
        }
        worker.onerror = () => {
          if (active) {
            error.value = 'This preview is unavailable. Download the original file.'
            loading.value = false
          }
          clearTimeout(timeout)
          worker?.terminate()
        }
        worker.postMessage({ extension: props.extension, bytes }, [bytes])
      }
    } catch {
      if (active) {
        error.value = 'The file could not be loaded. Reload the preview to try again.'
        loading.value = false
      }
      clearTimeout(timeout)
    }
  },
  { immediate: true },
)
</script>
<template>
  <div class="file-content">
    <p v-if="loading" role="status">Loading preview…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="imageUrl && !error">
      <div class="content-toolbar">
        <button aria-label="Zoom out" type="button" :disabled="zoom <= 0.5" @click="zoom -= 0.25">
          −</button
        ><button type="button" @click="zoom = 1">Fit</button
        ><button aria-label="Zoom in" type="button" :disabled="zoom >= 3" @click="zoom += 0.25">
          +
        </button>
      </div>
      <div class="image-scroll">
        <img
          :src="imageUrl"
          :alt="name"
          :style="{ width: `${zoom * 100}%` }"
          @error="error = 'This image could not be displayed. Try downloading the original.'"
        />
      </div>
    </template>
    <template v-else-if="preview && 'text' in preview">
      <p v-if="extension === 'docx'" class="content-note">
        Text preview. Download the original for images and full formatting.
      </p>
      <p v-if="preview.truncated" class="content-note">
        Showing the first 200,000 characters. Download for the full document.
      </p>
      <pre>{{ preview.text || 'This document contains no previewable text.' }}</pre>
    </template>
    <template v-else-if="preview && 'tables' in preview">
      <div class="content-toolbar">
        <select v-if="preview.tables.length > 1" v-model="sheetIndex" aria-label="Worksheet">
          <option v-for="(sheet, index) in preview.tables" :key="index" :value="index">
            {{ sheet.name }}
          </option></select
        ><span v-else>{{ table?.name }}</span>
      </div>
      <p v-if="extension === 'xlsx'" class="content-note">
        Values preview. Charts, images, formatting and recalculation are available in the original
        file.
      </p>
      <p v-if="table?.truncated" class="content-note">
        Showing up to 500 rows and 50 columns. Download for all data.
      </p>
      <div class="table-scroll">
        <table v-if="table?.rows.length" :aria-label="table.name">
          <tbody>
            <tr v-for="(row, i) in table.rows" :key="i">
              <th scope="row">{{ i + 1 }}</th>
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else>No populated cells.</p>
      </div>
    </template>
  </div>
</template>
<style scoped>
.file-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.file-content > p {
  padding: 0.4rem;
  margin: 0;
  font-size: 0.8rem;
}
.content-toolbar {
  display: flex;
  gap: 0.3rem;
  justify-content: center;
  align-items: center;
  padding: 0.2rem;
  font-size: 0.8rem;
}
button,
select {
  font: inherit;
  color: inherit;
  background: var(--panel-background);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.3rem;
  max-width: 100%;
}
button {
  cursor: pointer;
  min-width: 28px;
}
.content-note {
  color: var(--text-muted);
}
pre,
.table-scroll,
.image-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 0.5rem;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}
.image-scroll {
  background: #525659;
}
img {
  display: block;
  height: auto;
  margin: 0 auto;
}
table {
  border-collapse: collapse;
  font-size: 0.8rem;
  background: var(--panel-background);
}
td,
th {
  border: 1px solid var(--border);
  padding: 0.3rem 0.5rem;
  white-space: pre-wrap;
  min-width: 60px;
  max-width: 350px;
  overflow-wrap: anywhere;
}
th {
  color: var(--text-muted);
  min-width: 25px;
}
</style>
