import { effectScope, nextTick, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useLibraryQuery } from '@/features/sds/useLibraryQuery'
import type { SdsLibrary } from '@/features/sds/types'
const { load, page } = vi.hoisted(() => ({ load: vi.fn(), page: vi.fn() }))
vi.mock('@/services/sds', () => ({ loadSds: load, loadSdsPage: page, sdsErrorMessage: String }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
it('consumes an outstanding search debounce during explicit refresh without disabling later searches', async () => {
  vi.useFakeTimers()
  const libraryValue: SdsLibrary = { version: 0, folders: [], sheets: [], binder: { version: 0, selections: [] } }
  load.mockImplementation(async () => ({ ...libraryValue }))
  page.mockResolvedValue({ sheets: [], after: '' })
  const search = ref('')
  const scope = effectScope()
  const query = scope.run(() => useLibraryQuery({
    jobId: ref(''), search, showArchived: ref(false), library: ref(libraryValue),
    loading: ref(false), loadFailed: ref(false), nextPage: ref(''), pageBusy: ref(false),
    error: ref(''), onLoaded: vi.fn(),
  }))!
  try {
    search.value = 'Paint'
    await nextTick()
    await query.refresh()
    await vi.advanceTimersByTimeAsync(300)
    expect(load).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledWith({ search: 'Paint', showArchived: false })
    search.value = 'Adhesive'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(load).toHaveBeenCalledTimes(2)
    expect(page).toHaveBeenLastCalledWith({ search: 'Adhesive', showArchived: false })
  } finally { query.dispose(); scope.stop() }
})
