import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadSdsPage, sdsErrorMessage } from '@/services/sds'
import { readIntranetContent } from '@/services/intranet'
import { INTRANET_CONTENT_FILENAME, type IntranetContent } from './content'
import type { SdsSheet } from '@/features/sds/types'

/** Each existing screen owns its private read; nothing is persisted in browser storage. */
export function usePrivateReferences(options: { enabled: () => boolean; context: () => string }) {
  const content = ref<IntranetContent | null>(null), packages = ref<SdsSheet[]>([])
  const selectedPackage = ref(''), loading = ref(false), error = ref(''), notice = ref('')
  let controller: AbortController | undefined, generation = 0, disposed = false, mounted = false
  const current = (request: number) => !disposed && options.enabled() && request === generation
  function reset() {
    generation++
    controller?.abort()
    content.value = null; packages.value = []; selectedPackage.value = ''
    loading.value = false; error.value = ''; notice.value = ''
  }
  async function open() {
    if (disposed || !options.enabled()) return
    const active = ++generation
    controller?.abort(); controller = new AbortController()
    content.value = null; error.value = ''; notice.value = ''; loading.value = false
    if (!selectedPackage.value) return
    loading.value = true
    try {
      const data = await readIntranetContent(selectedPackage.value, controller.signal)
      if (current(active)) content.value = data
    } catch (caught) {
      if (current(active) && !controller.signal.aborted) error.value = sdsErrorMessage(caught)
    } finally { if (current(active)) loading.value = false }
  }
  async function reload() {
    if (disposed || !options.enabled()) return
    const active = ++generation
    controller?.abort(); content.value = null; packages.value = []; selectedPackage.value = ''; error.value = ''; notice.value = ''; loading.value = true
    try {
      const found: SdsSheet[] = [], visited = new Set<string>()
      let after = ''
      for (let step = 0; step < 20; step++) {
        const result = await loadSdsPage({ search: 'Phase2 intranet content', after, pageSize: 100 })
        if (!current(active)) return
        found.push(...result.sheets.filter(item => item.extension === 'txt' && !item.archived && item.originalName === INTRANET_CONTENT_FILENAME))
        if (!result.after) break
        if (visited.has(result.after) || step === 19) throw new Error('The reference search could not finish. Try again.')
        visited.add(result.after); after = result.after
      }
      packages.value = found
      if (found.length === 1) { selectedPackage.value = found[0]!.id; await open() }
    } catch (caught) { if (current(active)) error.value = sdsErrorMessage(caught) }
    finally { if (current(active)) loading.value = false }
  }
  function cancel() { generation++; controller?.abort(); loading.value = false; notice.value = 'Loading canceled. No content was saved.' }
  function selectSource(id: string) {
    if (disposed || !options.enabled()) return
    selectedPackage.value = id; return open()
  }
  watch([options.context, options.enabled], () => {
    reset()
    if (mounted) void reload()
  }, { flush: 'sync' })
  onMounted(() => { mounted = true; void reload() })
  onBeforeUnmount(() => { disposed = true; reset() })
  return { content, packages, selectedPackage, loading, error, notice, selectSource, reload, cancel }
}
