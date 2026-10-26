import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibraryQuery } from './useLibraryQuery'
import type { SdsLibrary } from './types'
import type { SdsPage } from '@/services/sds'

const fake = vi.hoisted(() => ({ load: vi.fn<typeof import('@/services/sds').loadSds>(), page: vi.fn<typeof import('@/services/sds').loadSdsPage>() }))
vi.mock('@/services/sds', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/sds')>(), loadSds: fake.load, loadSdsPage: fake.page,
}))
const scopes: EffectScope[] = []
const library = (): SdsLibrary => ({ version: 3, folders: [], sheets: [], binder: { version: 2, selections: [] } })
const pageResult = (after: string): SdsPage => ({ sheets: [], after, scanned: 0, searchMode: 'bounded-metadata-scan' })
function fixture(job = '') {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const state = {
      jobId: ref(job), search: ref(''), showArchived: ref(false), library: ref(library()),
      loading: ref(true), loadFailed: ref(false), nextPage: ref(''), pageBusy: ref(false), error: ref(''),
      onLoaded: vi.fn<(library: SdsLibrary) => void>(),
    }
    return { ...state, ...useLibraryQuery(state) }
  })!
}
beforeEach(() => { fake.load.mockReset(); fake.page.mockReset(); fake.load.mockImplementation(async () => library()) })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.useRealTimers() })

describe('bounded Library queries', () => {
  it('retains the newer search cursor when an older page completes last', async () => {
    const state = fixture()
    let finish!: (value: SdsPage) => void
    fake.page.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const old = state.refresh()
    await Promise.resolve()
    state.search.value = 'new query'
    fake.page.mockResolvedValueOnce(pageResult('new-cursor'))
    await state.refresh()
    finish(pageResult('old-cursor')); await old
    expect(state.nextPage.value).toBe('new-cursor')
    expect(state.onLoaded).toHaveBeenCalledOnce()
    state.dispose()
  })
  it('ignores an old pagination failure after a new context loads', async () => {
    const state = fixture()
    state.nextPage.value = 'cursor'
    let fail!: (error: Error) => void
    fake.page.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject }))
    const old = state.moreDocuments()
    state.jobId.value = 'job-2'
    await state.refresh()
    fail(new Error('Old context unavailable')); await old
    expect(state.error.value).toBe('')
    expect(state.nextPage.value).toBe('')
    expect(state.pageBusy.value).toBe(false)
    state.dispose()
  })
  it('does not publish a page cursor or error after disposal', async () => {
    const state = fixture()
    let finish!: (value: SdsPage) => void
    fake.page.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const old = state.refresh(); await Promise.resolve()
    state.dispose(); finish(pageResult('stale')); await old
    expect(state.nextPage.value).toBe('')
    expect(state.onLoaded).not.toHaveBeenCalled()
  })
  it('ignores a pending page as soon as search changes, before debounce fires', async () => {
    vi.useFakeTimers()
    const state = fixture()
    state.nextPage.value = 'old-cursor'
    let finish!: (value: SdsPage) => void
    fake.page.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = state.moreDocuments()
    state.search.value = 'new search'; await nextTick()
    finish(pageResult('stale')); await pending
    expect(state.nextPage.value).toBe('old-cursor')
    expect(state.library.value.sheets).toEqual([])
    state.dispose()
  })
  it('does not clear a newer page busy flag when an older page completes', async () => {
    const state = fixture()
    state.nextPage.value = 'old'
    let finishOld!: (value: SdsPage) => void
    let finishNew!: (value: SdsPage) => void
    fake.page.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve }))
    const old = state.moreDocuments()
    fake.page.mockResolvedValueOnce(pageResult('new'))
    await state.refresh()
    fake.page.mockReturnValueOnce(new Promise(resolve => { finishNew = resolve }))
    const newer = state.moreDocuments()
    finishOld(pageResult('stale')); await old
    expect(state.pageBusy.value).toBe(true)
    finishNew(pageResult('final')); await newer
    expect(state.nextPage.value).toBe('final')
    expect(state.pageBusy.value).toBe(false)
    state.dispose()
  })
  it('loads company metadata then one filtered page and retains a continuation through empty results', async () => {
    const state = fixture()
    state.search.value = 'safety'; state.showArchived.value = true
    fake.page.mockResolvedValue(pageResult('continuation'))
    await state.refresh()
    expect(fake.load).toHaveBeenCalledWith('', true)
    expect(fake.page).toHaveBeenCalledWith({ search: 'safety', showArchived: true })
    expect(state.nextPage.value).toBe('continuation')
    fake.page.mockResolvedValue(pageResult(''))
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
    fake.page.mockResolvedValue(pageResult(''))
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
    let finish!: (value: SdsPage) => void
    fake.page.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const pending = state.moreDocuments()
    await state.moreDocuments()
    expect(fake.page).toHaveBeenCalledOnce()
    state.dispose(); finish(pageResult('later')); await pending
    expect(state.nextPage.value).toBe('cursor')
    expect(state.pageBusy.value).toBe(false)
  })
})
