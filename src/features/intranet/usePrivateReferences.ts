import { onBeforeUnmount, onMounted, ref } from 'vue'
import { loadSdsPage, sdsErrorMessage } from '@/services/sds'
import { readIntranetContent } from '@/services/intranet'
import { INTRANET_CONTENT_FILENAME, type IntranetContent } from './content'
import type { SdsSheet } from '@/features/sds/types'

/** Each existing screen owns its private read; nothing is persisted in browser storage. */
export function usePrivateReferences(enabled: () => boolean = () => true) {
  const content = ref<IntranetContent | null>(null), packages = ref<SdsSheet[]>([])
  const selectedPackage = ref(''), loading = ref(false), error = ref(''), notice = ref('')
  let controller: AbortController | undefined, generation = 0, disposed = false
  async function open() {
    if (!enabled()) return
    const active = ++generation
    controller?.abort(); controller = new AbortController()
    content.value = null; error.value = ''; notice.value = ''; loading.value = false
    if (!selectedPackage.value) return
    loading.value = true
    try {
      const data = await readIntranetContent(selectedPackage.value, controller.signal)
      if (!disposed && active === generation) content.value = data
    } catch (caught) {
      if (!disposed && active === generation && !controller.signal.aborted) error.value = sdsErrorMessage(caught)
    } finally { if (!disposed && active === generation) loading.value = false }
  }
  async function reload() {
    if (!enabled()) return
    const active = ++generation
    controller?.abort(); content.value = null; packages.value = []; selectedPackage.value = ''; error.value = ''; notice.value = ''; loading.value = true
    try {
      const found: SdsSheet[] = [], visited = new Set<string>()
      let after = ''
      for (let step = 0; step < 20; step++) {
        const result = await loadSdsPage({ search: 'Phase2 intranet content', after, pageSize: 100 })
        if (disposed || active !== generation) return
        found.push(...result.sheets.filter(item => item.extension === 'txt' && !item.archived && item.originalName === INTRANET_CONTENT_FILENAME))
        if (!result.after) break
        if (visited.has(result.after) || step === 19) throw new Error('The reference search could not finish. Try again.')
        visited.add(result.after); after = result.after
      }
      packages.value = found
      if (found.length === 1) { selectedPackage.value = found[0]!.id; await open() }
    } catch (caught) { if (!disposed && active === generation) error.value = sdsErrorMessage(caught) }
    finally { if (!disposed && active === generation) loading.value = false }
  }
  function cancel() { generation++; controller?.abort(); loading.value = false; notice.value = 'Loading canceled. No content was saved.' }
  function selectSource(id: string) { selectedPackage.value = id; return open() }
  onMounted(() => { void reload() })
  onBeforeUnmount(() => { disposed = true; generation++; controller?.abort() })
  return { content, packages, selectedPackage, loading, error, notice, selectSource, reload, cancel }
}
