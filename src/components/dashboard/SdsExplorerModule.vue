<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute } from 'vue-router'
import Button from './DashboardButton.vue'
import DocumentExplorer from './DocumentExplorer.vue'
import SdsFileViewer from './SdsFileViewer.vue'
import { documentAccept, documentFormatsLabel, printableFile } from '@/features/documents/formats'
import { useAuthStore } from '@/stores/auth'
import { loadSds, loadSdsPage, sdsCommand, uploadDocument, sdsErrorMessage } from '@/services/sds'
import SdsBulkImport from './SdsBulkImport.vue'
import {
  folderAncestors,
  inFolder,
  visibleFolders,
  type ExplorerFolder,
  type SdsLibrary,
  type SdsSelection,
  type SdsSheet,
} from '@/features/sds/types'
import { getSdsViewState, rememberSdsViewState } from '@/features/sds/viewState'
import type { ExplorerMenuAction, ExplorerMenuTarget } from '@/features/sds/explorerMenu'

const props = withDefaults(defineProps<{ expanded?: boolean; title?: string; initialFolderId?: string }>(), { title: 'Documents', initialFolderId: '' })
const auth = useAuthStore()
const route = useRoute()
const viewRoute = route.path
const viewUid = auth.currentUser?.uid ?? ''
const requestedJobId = typeof route.query.sdsJob === 'string' ? route.query.sdsJob : ''
const previousView = getSdsViewState(viewUid, viewRoute)
const restored = previousView?.jobId === requestedJobId ? previousView : undefined
const isAdmin = computed(() => auth.rawRole === 'admin')
const jobId = ref(requestedJobId)
const folderId = ref(
  props.initialFolderId || (typeof route.query.folder === 'string' ? route.query.folder : (restored?.folderId ?? '')),
)
const search = ref(
  typeof route.query.search === 'string' ? route.query.search : (restored?.search ?? ''),
)
const library = ref<SdsLibrary>({
  version: 0,
  folders: [],
  sheets: [],
  binder: { version: 0, selections: [] },
})
const loading = ref(true)
const loadFailed = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const editing = ref(false)
const selection = ref<SdsSelection[]>([])
const selectedId = ref('')
const showArchived = ref(false)
const nextPage = ref('')
const pageBusy = ref(false)
const bulkOpen = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
const editor = ref<'' | 'folder' | 'sheet'>('')
const progress = ref<number | null>(null)
const form = reactive({
  id: '',
  name: '',
  manufacturer: '',
  productCode: '',
  language: 'English',
  revisionDate: '',
  folderId: '',
  parentId: '',
  order: 0,
  archived: false,
})
const file = ref<File | null>(null)
const addFileInput = ref<HTMLInputElement>()
let addFileFolder = ''
const editorElement = ref<HTMLFormElement>()
const exportId = ref('')
const exportState = ref('')
const exportError = ref('')
const exportPages = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let disposed = false
const dirty = computed(
  () =>
    editing.value &&
    JSON.stringify(selection.value) !== JSON.stringify(library.value.binder.selections),
)
const hasDraft = computed(() => dirty.value || !!editor.value)
const checkedIds = computed(() => selection.value.map((s) => s.documentId))
const sheets = computed(() => {
  if (jobId.value && !editing.value)
    return library.value.sheets.filter((s) =>
      library.value.binder.selections.some((v) => v.documentId === s.id),
    )
  return library.value.sheets.filter(
    (s) =>
      !s.archived ||
      (!jobId.value && showArchived.value) ||
      (editing.value && checkedIds.value.includes(s.id)),
  )
})
const folders = computed(() =>
  jobId.value && !editing.value
    ? visibleFolders(sheets.value, library.value.folders)
    : library.value.folders,
)
const selected = computed(() => sheets.value.find((s) => s.id === selectedId.value))
const currentFolder = computed(() => library.value.folders.find((f) => f.id === folderId.value))

const expandedLocation = computed(() => ({
  path: '/safety/sds',
  query: {
    sdsJob: jobId.value || undefined,
    folder: folderId.value || undefined,
    search: search.value || undefined,
  },
}))
const revisionChanged = (sheet: SdsSheet) =>
  !!jobId.value &&
  !!library.value.binder.selections.find(
    (s) => s.documentId === sheet.id && s.revisionId !== sheet.revisionId,
  )
const sheetSearch = (sheet: SdsSheet) => `${sheet.name} ${sheet.manufacturer} ${sheet.productCode}`
const message = sdsErrorMessage

async function refresh() {
  const request = ++generation
  loading.value = true
  loadFailed.value = false
  error.value = ''
  try {
    const loaded = await loadSds(jobId.value, !jobId.value)
    if (!jobId.value) {
      const page = await loadSdsPage({ search: search.value, showArchived: showArchived.value })
      loaded.sheets = page.sheets
      nextPage.value = page.after
    }
    if (request !== generation || disposed) return
    library.value = loaded
    selection.value = loaded.binder.selections.map((s) => ({ ...s }))
    if (!folders.value.some((f) => f.id === folderId.value)) folderId.value = ''
    if (loaded.exportId && loaded.exportId !== exportId.value) {
      clearExport()
      exportId.value = loaded.exportId
      void pollExport(loaded.exportId)
    }
  } catch (e) {
    if (request !== generation || disposed) return
    loadFailed.value = true
    library.value = { version: 0, folders: [], sheets: [], binder: { version: 0, selections: [] } }
    error.value = message(e)
  } finally {
    if (request === generation) loading.value = false
  }
}
async function moreDocuments() {
  if (!nextPage.value || pageBusy.value) return
  const request = generation
  pageBusy.value = true
  try {
    const page = await loadSdsPage({
      after: nextPage.value,
      search: search.value,
      showArchived: showArchived.value,
    })
    if (request !== generation || disposed) return
    library.value.sheets.push(...page.sheets)
    nextPage.value = page.after
  } catch (e) {
    error.value = message(e)
  } finally {
    pageBusy.value = false
  }
}
watch([search, showArchived], () => {
  if (jobId.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void refresh()
  }, 300)
})
function clearExport() {
  if (timer) clearTimeout(timer)
  exportId.value = ''
  exportState.value = ''
  exportError.value = ''
}
async function reload() {
  if (hasDraft.value && !window.confirm('Discard your unsaved changes and reload?')) return
  editing.value = false
  editor.value = ''
  await refresh()
}
function beginSelection() {
  editing.value = true
  selection.value = library.value.binder.selections.map((s) => ({ ...s }))
  notice.value = ''
}
function cancelSelection() {
  editing.value = false
  selection.value = library.value.binder.selections.map((s) => ({ ...s }))
  if (!folders.value.some((f) => f.id === folderId.value)) folderId.value = ''
}
function toggle(sheet: SdsSheet) {
  if (checkedIds.value.includes(sheet.id))
    selection.value = selection.value.filter((s) => s.documentId !== sheet.id)
  else if (!sheet.archived)
    selection.value.push({ documentId: sheet.id, revisionId: sheet.revisionId })
}
function toggleFolder(folder: ExplorerFolder) {
  const children = sheets.value.filter((s) => inFolder(s, folder.id, library.value.folders))
  const remove = children.every((s) => checkedIds.value.includes(s.id))
  if (
    !window.confirm(
      `${remove ? 'Uncheck' : 'Check'} ${children.length} files in ${folder.name}, including its subfolders?`,
    )
  )
    return
  children.forEach((s) => {
    if (remove || !checkedIds.value.includes(s.id)) toggle(s)
  })
}
async function saveSelection() {
  busy.value = true
  error.value = ''
  try {
    await sdsCommand('saveSelection', {
      jobId: jobId.value,
      selections: selection.value,
      version: library.value.binder.version,
    })
    editing.value = false
    clearExport()
    await refresh()
    notice.value = 'Job file selection saved.'
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
function latestRevision(sheet: SdsSheet) {
  selection.value = selection.value.map((s) =>
    s.documentId === sheet.id ? { documentId: sheet.id, revisionId: sheet.revisionId } : s,
  )
}
function openEditor(kind: 'folder' | 'sheet', record?: SdsSheet | ExplorerFolder) {
  if (editor.value && !window.confirm('Discard your unsaved document changes?')) return false
  Object.assign(
    form,
    {
      id: '',
      name: '',
      manufacturer: '',
      productCode: '',
      language: 'English',
      revisionDate: '',
      folderId: folderId.value,
      parentId: folderId.value,
      order: 0,
      archived: false,
    },
    record ?? {},
  )
  editor.value = kind
  file.value = null
  error.value = ''
  progress.value = null
  void nextTick(() => {
    editorElement.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    editorElement.value?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  })
  return true
}
function menuActions(target: ExplorerMenuTarget): ExplorerMenuAction[] {
  const items: ExplorerMenuAction[] = []
  const sheet =
    target.kind === 'document' ? sheets.value.find((s) => s.id === target.id) : undefined
  const folder =
    target.kind !== 'document' ? library.value.folders.find((f) => f.id === target.id) : undefined
  const masterAdmin = isAdmin.value && !jobId.value
  if (sheet) {
    items.push(
      {
        id: 'open',
        label: (sheet.extension ?? 'pdf') === 'pdf' ? 'Open PDF' : 'Open original',
        icon: 'pi-external-link',
      },
      { id: 'download', label: 'Download file', icon: 'pi-download' },
    )
    if (masterAdmin)
      items.push(
        { id: 'edit-sheet', label: 'Rename / move / edit file', icon: 'pi-pencil' },
        { id: 'revision', label: 'Upload new version', icon: 'pi-upload' },
        {
          id: 'archive',
          label: sheet.archived ? 'Restore file' : 'Archive file',
          icon: 'pi-folder',
          danger: !sheet.archived,
          disabled: !!editor.value,
        },
      )
    if (jobId.value) {
      const included = checkedIds.value.includes(sheet.id)
      items.push({
        id: 'toggle-sheet',
        label: included ? 'Uncheck for job book' : 'Check for job book',
        icon: included ? 'pi-minus' : 'pi-check',
        disabled: sheet.archived && !included,
      })
      if (
        included &&
        selection.value.find((s) => s.documentId === sheet.id)?.revisionId !== sheet.revisionId
      )
        items.push({
          id: 'latest',
          label: 'Use latest revision',
          icon: 'pi-refresh',
          disabled: sheet.archived,
        })
    }
  } else {
    if (target.kind === 'folder')
      items.push({ id: 'open-folder', label: 'Open folder', icon: 'pi-folder-open' })
    if (masterAdmin) {
      items.push({
        id: 'archived-view',
        label: showArchived.value ? 'Hide archived files' : 'Show archived files',
        icon: 'pi-eye',
      })
      items.push(
        { id: 'new-sheet', label: 'Add file here', icon: 'pi-file-pdf' },
        { id: 'new-folder', label: 'New folder', icon: 'pi-folder-plus' },
      )
      if (folder)
        items.push(
          { id: 'edit-folder', label: 'Rename / move folder', icon: 'pi-pencil' },
          {
            id: 'remove-folder',
            label: 'Remove empty folder',
            icon: 'pi-trash',
            danger: true,
            disabled:
              !!editor.value ||
              library.value.folders.some((f) => f.parentId === folder.id) ||
              library.value.sheets.some((s) => s.folderId === folder.id),
          },
        )
    }
    if (jobId.value && folder && editing.value) {
      const children = sheets.value.filter((s) => inFolder(s, folder.id, library.value.folders))
      const all = children.length > 0 && children.every((s) => checkedIds.value.includes(s.id))
      items.push({
        id: 'toggle-folder',
        label: all ? 'Uncheck folder for job book' : 'Check folder for job book',
        icon: 'pi-check-square',
        disabled: !children.length,
      })
    }
    if (jobId.value && !editing.value)
      items.push({ id: 'selection', label: 'Edit job selection', icon: 'pi-check-square' })
    items.push(
      {
        id: 'export',
        label: 'Make PDF / print book',
        icon: 'pi-print',
        disabled:
          hasDraft.value ||
          !sheets.value.length ||
          ['queued', 'running'].includes(exportState.value),
      },
      { id: 'refresh', label: 'Refresh', icon: 'pi-refresh' },
    )
  }
  return items.map((item) => ({ ...item, disabled: item.disabled || busy.value || loading.value }))
}
async function menuAction(action: string, target: ExplorerMenuTarget) {
  if (!menuActions(target).some((a) => a.id === action && !a.disabled)) return
  const sheet =
    target.kind === 'document' ? sheets.value.find((s) => s.id === target.id) : undefined
  const folder =
    target.kind !== 'document' ? library.value.folders.find((f) => f.id === target.id) : undefined
  if (sheet) {
    selectedId.value = sheet.id
    if (action === 'open' || action === 'download') return openSheet(action === 'download', sheet)
    if (action === 'edit-sheet' || action === 'revision') {
      const opened = openEditor('sheet', sheet)
      if (opened && action === 'revision')
        void nextTick(() =>
          editorElement.value?.querySelector<HTMLInputElement>('input[type=file]')?.focus(),
        )
    }
    if (action === 'archive') {
      if (
        !sheet.archived &&
        !window.confirm(
          `Archive “${sheet.name}”? Jobs using it will need to resolve their selection before exporting.`,
        )
      )
        return
      busy.value = true
      error.value = ''
      try {
        await sdsCommand('saveSheet', {
          ...sheet,
          archived: !sheet.archived,
          version: library.value.version,
        })
        clearExport()
        await refresh()
        notice.value = sheet.archived ? 'File restored.' : 'File archived.'
      } catch (e) {
        error.value = message(e)
      } finally {
        busy.value = false
      }
    }
    if (action === 'toggle-sheet' || action === 'latest') {
      if (!editing.value) beginSelection()
      if (action === 'latest') latestRevision(sheet)
      else toggle(sheet)
    }
  } else {
    if (action === 'open-folder') {
      folderId.value = target.id
      search.value = ''
    }
    if (action === 'new-sheet') {
      if (editor.value && !window.confirm('Discard your unsaved document changes?')) return
      editor.value = ''
      addFileFolder = target.id
      if (addFileInput.value) {
        addFileInput.value.value = ''
        addFileInput.value.click()
      }
    }
    if (action === 'new-folder') {
      // Set the destination explicitly without navigating or modifying job records.
      if (openEditor('folder')) {
        form.folderId = target.id
        form.parentId = target.id
      }
    }
    if (action === 'edit-folder' && folder) openEditor('folder', folder)
    if (action === 'remove-folder' && folder) return deleteFolder(folder)
    if (action === 'toggle-folder' && folder) {
      if (!editing.value) beginSelection()
      toggleFolder(folder)
    }
    if (action === 'archived-view') showArchived.value = !showArchived.value
    if (action === 'selection') beginSelection()
    if (action === 'export') return exportBook()
    if (action === 'refresh') return reload()
  }
}
async function addFile(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (!picked || busy.value || loading.value || !isAdmin.value || jobId.value) return
  const destination = addFileFolder
  busy.value = true
  error.value = ''
  notice.value = ''
  progress.value = 0
  let staged: Awaited<ReturnType<typeof uploadDocument>> | undefined
  try {
    staged = await uploadDocument(picked, (percent) => {
      progress.value = percent
    })
    const result = await sdsCommand<{ id: string }>('saveSheet', {
      name: picked.name.slice(0, 160),
      folderId: destination,
      manufacturer: '',
      productCode: '',
      language: 'English',
      revisionDate: '',
      order: 0,
      archived: false,
      version: library.value.version,
      uploadId: staged.uploadId,
      uploadExtension: staged.uploadExtension,
      originalName: staged.originalName,
    })
    clearExport()
    folderId.value = destination
    search.value = ''
    selectedId.value = result.id
    await refresh()
    notice.value = 'File added.'
  } catch (e) {
    error.value = message(e)
  } finally {
    await staged?.cleanup()
    busy.value = false
    progress.value = null
  }
}
function pickFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  if (file.value && !form.name) form.name = file.value.name.replace(/\.[^.]+$/, '').slice(0, 160)
}
async function saveRecord() {
  busy.value = true
  error.value = ''
  let staged: Awaited<ReturnType<typeof uploadDocument>> | undefined
  try {
    if (editor.value === 'sheet' && !form.id && !file.value)
      throw new Error('Choose a file before saving.')
    if (file.value)
      staged = await uploadDocument(file.value, (percent) => {
        progress.value = percent
      })
    await sdsCommand(editor.value === 'folder' ? 'saveFolder' : 'saveSheet', {
      ...form,
      version: library.value.version,
      uploadId: staged?.uploadId ?? '',
      uploadExtension: staged?.uploadExtension,
      originalName: staged?.originalName,
    })
    editor.value = ''
    clearExport()
    await refresh()
    notice.value = 'Company documents updated.'
  } catch (e) {
    error.value = message(e)
  } finally {
    await staged?.cleanup()
    busy.value = false
    progress.value = null
  }
}
async function deleteFolder(folder = currentFolder.value) {
  if (!folder || !window.confirm(`Remove empty folder “${folder.name}”?`)) return
  busy.value = true
  try {
    await sdsCommand('deleteFolder', { id: folder.id, version: library.value.version })
    if (folderId.value === folder.id) folderId.value = folder.parentId
    await refresh()
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
async function openSheet(download = false, sheet = selected.value) {
  if (!sheet || busy.value || loading.value) return
  const id = sheet.id
  busy.value = true
  error.value = ''
  const tab = window.open('about:blank', '_blank')
  if (tab) {
    tab.opener = null
    tab.document.title = 'Opening file'
    tab.document.body.textContent = 'Opening your file…'
  }
  try {
    const result = await sdsCommand<{ url: string }>('openSheet', {
      id,
      jobId: jobId.value,
      download,
    })
    if (tab) tab.location.replace(result.url)
    else error.value = 'Allow a new tab to open the PDF, then try again.'
  } catch (e) {
    tab?.close()
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
async function pollExport(id: string) {
  try {
    const result = await sdsCommand<{ status: string; error?: string; pageCount?: number }>(
      'exportStatus',
      { id },
    )
    if (disposed || id !== exportId.value) return
    exportState.value = result.status
    exportError.value = result.error ?? ''
    exportPages.value = result.pageCount ?? 0
    if (result.status === 'queued' || result.status === 'running')
      timer = setTimeout(() => void pollExport(id), 2500)
  } catch (e) {
    if (id === exportId.value) {
      exportError.value = message(e)
      exportState.value = 'failed'
    }
  }
}
async function exportBook() {
  if (dirty.value || editor.value) {
    error.value = 'Save or cancel your changes before making a book.'
    return
  }
  const excluded = sheets.value.filter(
    (sheet) => !sheet.archived && !printableFile(sheet.extension),
  ).length
  if (
    excluded &&
    !window.confirm(
      `The book will include PDFs and images only. ${excluded} other files will be excluded. Continue?`,
    )
  )
    return
  busy.value = true
  error.value = ''
  clearExport()
  const id = crypto.randomUUID()
  try {
    await sdsCommand('requestExport', {
      requestId: id,
      printableOnly: excluded > 0,
      jobId: jobId.value,
      version: library.value.binder.version,
    })
    exportId.value = id
    exportState.value = 'queued'
    void pollExport(id)
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
async function retrieveBook(download: boolean) {
  // Open synchronously to avoid popup blocking after the authorization request.
  const tab = window.open('about:blank', '_blank')
  if (tab) {
    tab.opener = null
    tab.document.title = 'Opening document book'
    tab.document.body.textContent = 'Opening your document book…'
  }
  try {
    const result = await sdsCommand<{ url: string }>('exportStatus', {
      id: exportId.value,
      download,
      link: true,
    })
    if (tab) tab.location.replace(result.url)
    else {
      error.value = 'Allow a new tab to open the PDF, then try again.'
    }
  } catch (e) {
    tab?.close()
    error.value = message(e)
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (hasDraft.value || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(
  () =>
    !(hasDraft.value || busy.value) ||
    window.confirm('Leave this page and discard unsaved changes?'),
)
watch(
  () => auth.profile,
  () => {
    editing.value = false
    editor.value = ''
    clearExport()
    void refresh()
  },
)
onMounted(() => {
  void refresh()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  rememberSdsViewState(viewUid, viewRoute, {
    jobId: jobId.value,
    folderId: folderId.value,
    search: search.value,
  })
  disposed = true
  if (searchTimer) clearTimeout(searchTimer)
  generation++
  if (timer) clearTimeout(timer)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <div class="sds-module" :class="{ 'sds-module--expanded': expanded }" data-testid="sds-module">
    <div v-if="error" role="alert" class="sds-message sds-message--error">{{ error }}</div>
    <p v-if="notice" role="status" class="sds-message">{{ notice }}</p>
    <input
      v-if="isAdmin && !jobId"
      ref="addFileInput"
      type="file"
      hidden
      aria-label="Add file"
      :accept="documentAccept"
      @change="addFile"
    />
    <p v-if="progress !== null" role="status" class="sds-message">
      Uploading file: {{ progress }}%{{ progress === 100 ? ' · Validating and saving…' : '' }}
    </p>
    <div v-if="editing" class="sds-selection-bar">
      <strong>{{ selection.length }} files selected{{ dirty ? ' · Unsaved changes' : '' }}</strong>

      <Button label="Save selection" :disabled="busy" @click="saveSelection" /><Button
        label="Cancel"
        severity="secondary"
        :disabled="busy"
        @click="cancelSelection"
      />
    </div>
    <p v-if="loadFailed" role="status">
      The documents have not loaded. <button type="button" @click="reload">Retry</button>
    </p>
    <fieldset v-if="!loadFailed" :disabled="busy || loading" class="sds-fieldset">
      <DocumentExplorer
        v-model:folder-id="folderId"
        v-model:search="search"
        :title="title"
        :folders="folders"
        :documents="sheets"
        :selected-id="selectedId"
        :loading="loading"
        :disabled="busy"
        :menu-actions="menuActions"
        :editing="editing"
        :checked-ids="checkedIds"
        :search-text="sheetSearch"
        @select="selectedId = $event.id"
        @toggle="toggle"
        @toggle-folder="toggleFolder"
        @action="menuAction"
        @open="openSheet(false, $event)"
      >
        <template #toolbar>
          <Button
            v-if="!jobId && nextPage"
            :label="pageBusy ? 'Loading…' : 'Load more files'"
            :disabled="pageBusy || busy"
            @click="moreDocuments"
          />
          <Button
            v-if="isAdmin && !jobId"
            label="Bulk PDF import"
            :disabled="busy"
            @click="bulkOpen = !bulkOpen"
          />
          <RouterLink
            v-if="!expanded"
            :to="expandedLocation"
            class="sds-expand"
            aria-label="Expand explorer"
            title="Expand explorer"
            ><i class="pi pi-expand" aria-hidden="true"
          /></RouterLink>
        </template>
        <template #viewer>
          <SdsFileViewer
            v-if="!editor"
            :sheet="selected"
            :job-id="jobId"
            :version="library.version + ':' + library.binder.version"
            :earlier-revision="!!selected && revisionChanged(selected)"
            @open="openSheet"
          />
          <!-- Record editor stays inside the viewer pane. -->
          <form v-if="editor" ref="editorElement" class="sds-editor" @submit.prevent="saveRecord">
            <h3>{{ form.id ? 'Edit' : 'Add' }} {{ editor === 'folder' ? 'folder' : 'file' }}</h3>
            <fieldset :disabled="busy" class="sds-form-grid">
              <label
                >{{ editor === 'folder' ? 'Folder name' : 'File name'
                }}<input v-model="form.name" required :maxlength="editor === 'folder' ? 100 : 160"
              /></label>
              <label
                >Folder<select v-if="editor === 'folder'" v-model="form.parentId">
                  <option value="">Root folder</option>
                  <option
                    v-for="folder in library.folders.filter(
                      (f) =>
                        f.id !== form.id &&
                        !folderAncestors(f.id, library.folders).some((p) => p.id === form.id),
                    )"
                    :key="folder.id"
                    :value="folder.id"
                  >
                    {{
                      folderAncestors(folder.id, library.folders)
                        .map((f) => f.name)
                        .join(' / ')
                    }}
                  </option></select
                ><select v-else v-model="form.folderId">
                  <option value="">Root folder</option>
                  <option v-for="folder in library.folders" :key="folder.id" :value="folder.id">
                    {{
                      folderAncestors(folder.id, library.folders)
                        .map((f) => f.name)
                        .join(' / ')
                    }}
                  </option>
                </select></label
              >
              <label
                >Display order<input
                  v-model.number="form.order"
                  type="number"
                  min="-1000000"
                  max="1000000"
                  step="1"
                  required
              /></label>
              <template v-if="editor === 'sheet'">
                <label
                  >Manufacturer (optional)<input
                    v-model="form.manufacturer"
                    maxlength="160" /></label
                ><label
                  >Product identifier<input v-model="form.productCode" maxlength="100" /></label
                ><label>Language<input v-model="form.language" required maxlength="40" /></label>
                <label
                  >Revision date (if supplied)<input
                    v-model="form.revisionDate"
                    type="date"
                    :disabled="!!form.id && !file"
                /></label>
                <label
                  >{{ form.id ? 'Replacement file (optional)' : 'File'
                  }}<input
                    type="file"
                    :aria-label="form.id ? 'Replacement file' : 'File'"
                    :accept="documentAccept"
                    :required="!form.id"
                    @change="pickFile"
                  /><small
                    >{{ documentFormatsLabel }}. Maximum 20 MB (TXT/CSV: 2 MB; PDFs: 500 pages). New
                    uploads preserve previous versions.</small
                  ></label
                >
                <label
                  ><input v-model="form.archived" type="checkbox" /> Archived — retained for
                  history; unavailable for new selection</label
                >
              </template>
            </fieldset>
            <div class="sds-actions">
              <Button type="submit" :label="busy ? 'Saving…' : 'Save'" :disabled="busy" /><Button
                label="Cancel"
                severity="secondary"
                :disabled="busy"
                @click="editor = ''"
              />
            </div>
          </form>
        </template>
      </DocumentExplorer>
    </fieldset>
    <SdsBulkImport
      v-if="bulkOpen && isAdmin && !jobId"
      :folder-id="folderId"
      @busy="busy = $event"
      @completed="refresh"
    />
    <section v-if="exportState" class="sds-export" aria-label="Book export" aria-live="polite">
      <h3>Document book</h3>
      <p v-if="exportState === 'queued' || exportState === 'running'">
        {{
          exportState === 'queued'
            ? 'Book queued…'
            : 'Combining files and building the table of contents…'
        }}
        You can continue browsing.
      </p>
      <p v-if="exportState === 'failed'" role="alert">
        {{ exportError }} No complete book was produced. Review the files and try again.
      </p>
      <template v-if="exportState === 'complete'"
        ><p>
          Your book is ready · {{ exportPages }} pages. This is a snapshot of the saved selection
          when you requested it.
        </p>
        <div class="sds-actions">
          <Button label="Download PDF" @click="retrieveBook(true)" /><Button
            label="Open book to print"
            severity="secondary"
            @click="retrieveBook(false)"
          />
        </div>
        <small
          >Use the opened PDF viewer’s Print button. Downloaded books are also available without an
          internet connection.</small
        ></template
      >
    </section>
  </div>
</template>

<style scoped>
.sds-module {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}
.sds-module--expanded {
  --explorer-height: min(72vh, 780px);
}
.sds-actions,
.sds-selection-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
label {
  display: grid;
  gap: 0.25rem;
}
input,
select {
  font: inherit;
  color: inherit;
  padding: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel-background);
  min-width: 0;
  max-width: 100%;
}
input[type='checkbox'] {
  width: 18px;
  height: 18px;
}
.sds-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
}
.sds-fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.sds-form-grid {
  border: 0;
  padding: 0;
  margin: 0 0 0.6rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
.sds-editor {
  overflow: auto;
  padding: 0.75rem;
  margin: 0;
  background: var(--panel-background);
}
.sds-editor h3 {
  font-size: 1rem;
}
.sds-editor label {
  font-size: 0.8rem;
}
.sds-export {
  padding: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 5px;
}
.sds-selection-bar {
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  background: var(--field-hover);
  border-radius: 4px;
}
.sds-message {
  margin: 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  background: var(--field-hover);
  border-radius: 4px;
}
.sds-message--error {
  border-left: 3px solid #b23c35;
  background: #b23c3514;
}
small {
  display: block;
  color: var(--text-muted);
}
h3 {
  margin-top: 0;
}
a {
  color: var(--accent);
}
@media (max-width: 700px) {
  .sds-editor {
    padding: 0.4rem;
  }
  .sds-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
