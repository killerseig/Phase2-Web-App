<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  loadSds,
  preflightSdsImport,
  sdsCommand,
  uploadDocument,
  sdsErrorMessage,
  type SdsImportRow,
} from '@/services/sds'
const props = defineProps<{ folderId: string }>()
const emit = defineEmits<{ completed: []; busy: [value: boolean] }>()
const auth = useAuthStore()
const indexFile = ref<File>()
const selectedFiles = ref<File[]>([])
const rows = ref<Array<{ row: SdsImportRow; file: File; id: string; status: string }>>([])
const busy = ref(false)
watch(busy, (value) => emit('busy', value), { flush: 'sync' })
const paused = ref(false)
const error = ref('')
const progress = ref(0)
const duplicates = ref(0)
const destination = ref('')
const complete = computed(() => rows.value.filter((r) => r.status === 'saved').length)
const digest = async (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
function reset() {
  rows.value = []
  error.value = ''
}
async function preflight() {
  if (!indexFile.value || !selectedFiles.value.length) return
  busy.value = true
  error.value = ''
  rows.value = []
  try {
    const result = await preflightSdsImport(JSON.parse(await indexFile.value.text()))
    const files = new Map<string, File>()
    for (const file of selectedFiles.value) {
      const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/')
      if (files.has(path)) throw new Error(`Duplicate selected path: ${path}`)
      files.set(path, file)
    }
    if (files.size !== result.files.length)
      throw new Error(
        'The selected files and index must match exactly, without missing or extra files.',
      )
    destination.value = props.folderId
    const verified = []
    for (const row of result.files) {
      const file = files.get(row.path)
      if (!file)
        throw new Error(
          `Missing selected file: ${row.path}. Index paths must include the selected folder name.`,
        )
      if (file.size !== row.size || (await digest(await file.arrayBuffer())) !== row.sha256)
        throw new Error(`Size or SHA-256 mismatch: ${row.path}`)
      const identity = new TextEncoder().encode(
        `${auth.currentUser?.uid}\n${destination.value}\n${row.path}\n${row.sha256}`,
      )
      const id = `import_${(await digest(identity.buffer)).slice(0, 48)}`
      verified.push({ row, file, id, status: 'ready' })
      progress.value = Math.round((verified.length / result.files.length) * 100)
    }
    rows.value = verified
    duplicates.value = result.duplicateByteGroups.length
  } catch (e) {
    error.value = sdsErrorMessage(e)
  } finally {
    busy.value = false
    progress.value = 0
  }
}
async function run() {
  busy.value = true
  paused.value = false
  error.value = ''
  try {
    let version = (await loadSds('', true)).version
    for (const entry of rows.value) {
      if (paused.value) break
      if (entry.status === 'saved') continue
      entry.status = 'uploading'
      let staged: Awaited<ReturnType<typeof uploadDocument>> | undefined
      try {
        staged = await uploadDocument(entry.file, (percent) => {
          progress.value = percent
        })
        const result = await sdsCommand<{ id: string; reused?: boolean }>('saveSheet', {
          ...entry.row,
          id: entry.id,
          folderId: destination.value,
          order: 0,
          archived: false,
          sourcePath: entry.row.path,
          expectedSize: entry.row.size,
          expectedSha256: entry.row.sha256,
          uploadId: staged.uploadId,
          uploadExtension: staged.uploadExtension,
          originalName: staged.originalName,
          version,
        })
        if (!result.reused) version++
        entry.status = 'saved'
      } catch (e) {
        entry.status = 'retry'
        throw e
      } finally {
        await staged?.cleanup()
      }
    }
  } catch (e) {
    error.value = sdsErrorMessage(e)
  } finally {
    busy.value = false
    progress.value = 0
    emit('completed')
  }
}
function pickIndex(event: Event) {
  indexFile.value = (event.target as HTMLInputElement).files?.[0]
  reset()
}
function pickFiles(event: Event) {
  selectedFiles.value = Array.from((event.target as HTMLInputElement).files ?? [])
  reset()
}
</script>
<template>
  <section aria-label="Bulk PDF import" class="bulk-import">
    <h3>Bulk PDF import</h3>
    <p>
      Choose a version 1 JSON index and matching PDFs. Paths include the selected folder name.
      Uploaded safety text stays unchanged; currency remains unverified.
    </p>
    <label
      >Metadata index
      <input type="file" accept=".json,application/json" :disabled="busy" @change="pickIndex"
    /></label>
    <label
      >PDF folder <input type="file" webkitdirectory multiple :disabled="busy" @change="pickFiles"
    /></label>
    <label
      >Or select PDFs
      <input
        type="file"
        accept=".pdf,application/pdf"
        multiple
        :disabled="busy"
        @change="pickFiles"
    /></label>
    <button :disabled="busy || !indexFile || !selectedFiles.length" @click="preflight">
      Validate and preview
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">Processing {{ progress }}%</p>
    <template v-if="rows.length">
      <p>
        {{ complete }} / {{ rows.length }} saved. {{ duplicates }} duplicate-byte groups remain
        separate records for review. Destination: {{ destination || 'Root folder' }}.
      </p>
      <button :disabled="busy || complete === rows.length" @click="run">
        {{ complete ? 'Resume import' : 'Import validated files' }}
      </button>
      <button v-if="busy" @click="paused = true">Pause after current file</button>
      <p>
        Retry resumes saved rows. After closing or refreshing, reselect the same index and files;
        matching committed rows are reused.
      </p>
      <ol>
        <li v-for="entry in rows.slice(0, 20)" :key="entry.id">
          {{ entry.row.path }} — {{ entry.status }}
        </li>
      </ol>
      <p v-if="rows.length > 20">Showing the first 20 records.</p>
    </template>
  </section>
</template>
<style scoped>
.bulk-import {
  padding: 1rem;
  border: 1px solid var(--border);
}
label {
  display: block;
  margin: 0.6rem 0;
}
button {
  margin: 0.4rem;
}
</style>
