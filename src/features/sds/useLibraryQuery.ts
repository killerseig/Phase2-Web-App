import { watch, type Ref } from 'vue'
import { loadSds, loadSdsPage, sdsErrorMessage } from '@/services/sds'
import type { SdsLibrary } from './types'

/** Query lifetime only; selection, export polling and viewer authorization belong to their owners. */
export function useLibraryQuery(options: {
  jobId: Ref<string>
  search: Ref<string>
  showArchived: Ref<boolean>
  library: Ref<SdsLibrary>
  loading: Ref<boolean>
  loadFailed: Ref<boolean>
  nextPage: Ref<string>
  pageBusy: Ref<boolean>
  error: Ref<string>
  onLoaded: (library: SdsLibrary) => void
}) {
  const { library, loading, loadFailed, nextPage, pageBusy, error } = options
  let generation = 0
  let disposed = false
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  async function refresh() {
    const request = ++generation
    loading.value = true
    loadFailed.value = false
    error.value = ''
    try {
      const loaded = await loadSds(options.jobId.value, !options.jobId.value)
      if (!options.jobId.value) {
        const page = await loadSdsPage({
          search: options.search.value,
          showArchived: options.showArchived.value,
        })
        loaded.sheets = page.sheets
        nextPage.value = page.after
      }
      if (request !== generation || disposed) return
      library.value = loaded
      options.onLoaded(loaded)
    } catch (e) {
      if (request !== generation || disposed) return
      loadFailed.value = true
      library.value = {
        version: 0,
        folders: [],
        sheets: [],
        binder: { version: 0, selections: [] },
      }
      error.value = sdsErrorMessage(e)
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
        search: options.search.value,
        showArchived: options.showArchived.value,
      })
      if (request !== generation || disposed) return
      library.value.sheets.push(...page.sheets)
      nextPage.value = page.after
    } catch (e) {
      error.value = sdsErrorMessage(e)
    } finally {
      pageBusy.value = false
    }
  }
  const stopSearch = watch([options.search, options.showArchived], () => {
    if (options.jobId.value) return
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      void refresh()
    }, 300)
  })

  function dispose() {
    disposed = true
    generation++
    stopSearch()
    if (searchTimer) clearTimeout(searchTimer)
  }
  return { refresh, moreDocuments, dispose }
}
