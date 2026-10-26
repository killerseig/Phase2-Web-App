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
  const context = () => ({ jobId: options.jobId.value, search: options.search.value, showArchived: options.showArchived.value })
  const current = (request: number, scope: ReturnType<typeof context>) =>
    !disposed && request === generation && scope.jobId === options.jobId.value &&
    scope.search === options.search.value && scope.showArchived === options.showArchived.value
  async function refresh() {
    if (disposed) return
    const request = ++generation
    const scope = context()
    loading.value = true
    pageBusy.value = false
    nextPage.value = ''
    loadFailed.value = false
    error.value = ''
    try {
      const loaded = await loadSds(scope.jobId, !scope.jobId)
      if (!current(request, scope)) return
      let after = ''
      if (!scope.jobId) {
        const page = await loadSdsPage({
          search: scope.search,
          showArchived: scope.showArchived,
        })
        loaded.sheets = page.sheets
        after = page.after
      }
      if (!current(request, scope)) return
      nextPage.value = after
      library.value = loaded
      options.onLoaded(loaded)
    } catch (e) {
      if (!current(request, scope)) return
      loadFailed.value = true
      library.value = {
        version: 0,
        folders: [],
        sheets: [],
        binder: { version: 0, selections: [] },
      }
      error.value = sdsErrorMessage(e)
    } finally {
      if (current(request, scope)) loading.value = false
    }
  }
  async function moreDocuments() {
    if (disposed || !nextPage.value || pageBusy.value) return
    const request = generation
    const scope = context()
    pageBusy.value = true
    try {
      const page = await loadSdsPage({
        after: nextPage.value,
        search: scope.search,
        showArchived: scope.showArchived,
      })
      if (!current(request, scope)) return
      library.value.sheets.push(...page.sheets)
      nextPage.value = page.after
    } catch (e) {
      if (!current(request, scope)) return
      error.value = sdsErrorMessage(e)
    } finally {
      if (current(request, scope)) pageBusy.value = false
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
    pageBusy.value = false
    stopSearch()
    if (searchTimer) clearTimeout(searchTimer)
  }
  return { refresh, moreDocuments, dispose }
}
