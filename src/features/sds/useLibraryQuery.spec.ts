import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibraryQuery } from './useLibraryQuery'
import type { SdsLibrary } from './types'

const fake = vi.hoisted(() => ({ load: vi.fn(), page: vi.fn() }))
vi.mock('@/services/sds', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/sds')>(), loadSds: fake.load, loadSdsPage: fake.page,
}))
const scopes: EffectScope[] = []
const library = (): SdsLibrary => ({ version: 3, folders: [], sheets: [], binder: { version: 2, selections: [] } })
function fixture(job = '') {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const state = {
      jobId: ref(job), search: ref(''), showArchived: ref(false), library: ref(library()),
      loading: ref(true), loadFailed: ref(false), nextPage: ref(''), pageBusy: ref(false), error: ref(''),
      onLoaded: vi.fn(),
    }
    return { ...state, ...useLibraryQuery(state) }
  })!
}
beforeEach(() => { fake.load.mockReset(); fake.page.mockReset(); fake.load.mockImplementation(async () => library()) })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.useRealTimers() })

describe('bounded Library queries', () => {
  it('loads company metadata then one filtered page and retains a continuation through empty results', async () => {
    const state = fixture()
    state.search.value = 'safety'; state.showArchived.value = true
    fake.page.mockResolvedValue({ sheets: [], after: 'continuation' })
    await state.refresh()
    expect(fake.load).toHaveBeenCalledWith('', true)
    expect(fake.page).toHaveBeenCalledWith({ search: 'safety', showArchived: true })
    expect(state.nextPage.value).toBe('continuation')
    fake.page.mockResolvedValue({ sheets: [], after: '' })
    await state.moreDocuments()
    expect(fake.page).toHaveBeenLastCalledWith({ after: 'continuation', search: 'safety', showArchived: true })
    expect(state.nextPage.value).toBe('')
    state.dispose()
  })
  it('loads a job book without a company paging request', async () => {
    const state = fixture('job-1')
    await state.refresh()
    expect(fake.load).toHaveBeenCalledWith('job-1', false)
    expect(fake.page).not.toHaveBeenCalled()
    expect(state.onLoaded).toHaveBeenCalledOnce()
    state.dispose()
  })
  it('ignores an older metadata response after a newer refresh has applied', async () => {
    const state = fixture('job-1')
    let finish!: (value: SdsLibrary) => void
    fake.load.mockReturnValueOnce(new Promise<SdsLibrary>(resolve => { finish = resolve }))
    const old = state.refresh()
    await state.refresh()
    finish({ ...library(), version: 1 })
    await old
    expect(state.library.value.version).toBe(3)
    expect(state.onLoaded).toHaveBeenCalledOnce()
    state.dispose()
  })
  it('reports failed refresh and supports an explicit retry', async () => {
    const state = fixture('job-1')
    fake.load.mockRejectedValueOnce(new Error('Unavailable'))
    await state.refresh()
    expect(state.loadFailed.value).toBe(true)
    expect(state.error.value).toBe('Unavailable')
    expect(state.loading.value).toBe(false)
    await state.refresh()
    expect(state.loadFailed.value).toBe(false)
    expect(state.error.value).toBe('')
    expect(state.library.value.version).toBe(3)
    state.dispose()
  })
  it('debounces company searches and cancels pending work when disposed', async () => {
    vi.useFakeTimers()
    const state = fixture()
    fake.page.mockResolvedValue({ sheets: [], after: '' })
    state.search.value = 'a'; await nextTick()
    state.search.value = 'ab'; await nextTick()
    await vi.advanceTimersByTimeAsync(299)
    expect(fake.load).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fake.load).toHaveBeenCalledOnce()
    state.search.value = 'abc'; await nextTick(); state.dispose()
    await vi.advanceTimersByTimeAsync(300)
    expect(fake.load).toHaveBeenCalledOnce()
  })
  it('does not start duplicate pages and ignores a pending page after disposal', async () => {
    const state = fixture()
    state.nextPage.value = 'cursor'
    let finish!: (value: { sheets: never[]; after: string }) => void
    fake.page.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const pending = state.moreDocuments()
    await state.moreDocuments()
    expect(fake.page).toHaveBeenCalledOnce()
    state.dispose(); finish({ sheets: [], after: 'later' }); await pending
    expect(state.nextPage.value).toBe('cursor')
    expect(state.pageBusy.value).toBe(false)
  })
})
