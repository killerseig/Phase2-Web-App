import { ref, type Ref } from 'vue'
import { libraryCommand } from './commands'
import { sdsErrorMessage } from '@/services/sds'
import type { DocumentOpener } from '@/features/documents/documentWindow'

/** Export request/status lifetime only. Selection, prompts and mutation locking stay in the workspace. */
export function useLibraryBookExport(options: { error: Ref<string>; opener: DocumentOpener }) {
  const id = ref(''), state = ref(''), error = ref(''), pages = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let disposed = false
  const current = (request: number) => !disposed && request === generation
  function clear() {
    generation++
    if (timer) clearTimeout(timer)
    timer = undefined
    id.value = ''; state.value = ''; error.value = ''; pages.value = 0
  }
  async function poll(request: number, exportId: string) {
    try {
      const result = await libraryCommand('exportStatus', { id: exportId })
      if (!current(request)) return
      state.value = result.status
      error.value = result.error ?? ''
      pages.value = result.pageCount ?? 0
      if (result.status === 'queued' || result.status === 'running')
        timer = setTimeout(() => void poll(request, exportId), 2500)
    } catch (caught) {
      if (!current(request)) return
      error.value = sdsErrorMessage(caught)
      state.value = 'failed'
    }
  }
  function resume(exportId: string) {
    if (disposed) return
    clear(); id.value = exportId
    void poll(generation, exportId)
  }
  async function request(input: { jobId: string; version: number; printableOnly: boolean }) {
    if (disposed) return
    clear()
    const request = generation, exportId = crypto.randomUUID()
    try {
      await libraryCommand('requestExport', { ...input, requestId: exportId })
      if (!current(request)) return
      id.value = exportId; state.value = 'queued'
      void poll(request, exportId)
    } catch (caught) {
      if (current(request)) options.error.value = sdsErrorMessage(caught)
    }
  }
  async function retrieve(download: boolean) {
    const request = generation, exportId = id.value
    if (disposed || !exportId) return
    try {
      await options.opener.open(
        async () => {
          const result = await libraryCommand('exportStatus', { id: exportId, download, link: true })
          return current(request) ? result : {}
        },
        'Opening document book', 'Opening your document book…',
      )
    } catch (caught) {
      if (current(request)) options.error.value = sdsErrorMessage(caught)
    }
  }
  return { id, state, error, pages, clear, resume, request, retrieve, dispose() { disposed = true; clear() } }
}
