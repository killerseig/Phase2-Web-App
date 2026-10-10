<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { formApi } from '@/services/forms'
const props = defineProps<{ templateId: string }>()
type Entry = {
  id: string
  title: string
  templateVersion: number
  submittedAt: number
  jobId: string
}
const entries = ref<Entry[]>([]),
  error = ref(''),
  busy = ref(false),
  loaded = ref(false),
  nextCursor = ref<string | null>(null),
  pageCursor = ref(''),
  snapshotBefore = ref<number>(),
  priorCursors = ref<string[]>([])
let generation = 0
async function load(reset = true) {
  if (reset) {
    pageCursor.value = ''
    snapshotBefore.value = undefined
    priorCursors.value = []
  }
  const current = ++generation
  entries.value = []
  loaded.value = false
  nextCursor.value = null
  error.value = ''
  busy.value = true
  try {
    const result = await formApi<{
      entries: Entry[]
      nextCursor: string | null
      snapshotBefore: number
    }>('formEntries', {
      action: 'list',
      templateId: props.templateId,
      cursor: pageCursor.value,
      snapshotBefore: snapshotBefore.value,
    })
    if (current === generation) {
      entries.value = result.entries
      nextCursor.value = result.nextCursor
      snapshotBefore.value = result.snapshotBefore
      loaded.value = true
    }
  } catch (caught) {
    if (current === generation) {
      const code = caught && typeof caught === 'object' && 'code' in caught ? String(caught.code) : ''
      error.value = /functions\/(not-found|unavailable|internal)/.test(code)
        ? 'Completed entries are unavailable. Ask your administrator to confirm the entries service is deployed and you have access.'
        : caught instanceof Error ? caught.message : 'Completed entries could not be loaded.'
    }
  } finally {
    if (current === generation) busy.value = false
  }
}
async function download(format: 'csv' | 'xlsx', all = false) {
  if (busy.value || !loaded.value) return
  const current = generation
  busy.value = true
  error.value = ''
  try {
    const result = await formApi<{ base64: string; contentType: string; filename: string }>(
      'formEntries',
      {
        action: all ? 'export-all' : 'export',
        templateId: props.templateId,
        format,
        cursor: pageCursor.value,
        snapshotBefore: snapshotBefore.value,
      },
    )
    if (current !== generation) return
    const url = URL.createObjectURL(
      new Blob([Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))], {
        type: result.contentType,
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    link.click()
    URL.revokeObjectURL(url)
  } catch (caught) {
    if (current === generation) error.value = (caught as Error).message
  } finally {
    if (current === generation) busy.value = false
  }
}
async function nextPage() {
  if (!nextCursor.value) return
  priorCursors.value.push(pageCursor.value)
  pageCursor.value = nextCursor.value
  await load(false)
}
async function previousPage() {
  const previous = priorCursors.value.pop()
  if (previous === undefined) return
  pageCursor.value = previous
  await load(false)
}
watch(
  () => props.templateId,
  () => load(),
  { immediate: true },
)
onBeforeUnmount(() => { generation++ })
</script>
<template>
  <section aria-label="View Entries">
    <h2>View Entries</h2>
    <p>This view lists submitted records. Form preview shows questions only. Private completed entries retain their original questions and issued version.</p>
    <button :disabled="busy" @click="load()">Refresh</button>
    <button :disabled="busy || !loaded || !!error" @click="download('xlsx', true)">Export all entries to Excel</button>
    <button :disabled="busy || !loaded || !!error" @click="download('csv', true)">Export all entries to CSV</button>
    <button :disabled="busy || !loaded || !!error || !entries.length" @click="download('xlsx')">Download Excel (this page)</button>
    <button :disabled="busy || !loaded || !!error || !entries.length" @click="download('csv')">Download CSV (this page)</button>
    <p>
      Page {{ priorCursors.length + 1 }}. Page downloads include all answers for this page only;
      Export all entries includes the complete snapshot or reports a limit error. Continue through
      every page to include the complete snapshot; entries submitted after Refresh are excluded.
    </p>
    <button :disabled="busy || !priorCursors.length" @click="previousPage">Previous entries</button>
    <button :disabled="busy || !nextCursor" @click="nextPage">Next entries</button>
    <p v-if="!busy && !error">{{ nextCursor ? 'More entries remain.' : 'End of snapshot.' }}</p>
    <p v-if="busy" role="status">Loading entries…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <table v-if="entries.length">
      <thead>
        <tr>
          <th>Completed form</th>
          <th>Submitted</th>
          <th>Version</th>
          <th>Job</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in entries" :key="entry.id">
          <td>
            <RouterLink :to="{ name: 'form-submission-view', params: { id: entry.id } }"
              >{{ entry.title }} · {{ entry.id }}</RouterLink
            >
          </td>
          <td>{{ new Date(entry.submittedAt).toLocaleString() }}</td>
          <td>{{ entry.templateVersion }}</td>
          <td>{{ entry.jobId || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!busy && !error">{{ nextCursor
      ? 'No accessible entries on this page. Continue if more entries remain.'
      : 'No accessible completed entries.' }}</p>
  </section>
</template>
<style scoped>
section {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  padding: 0.6rem;
  border-bottom: 1px solid var(--border);
}
button {
  margin: 0.3rem;
}
</style>
