import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrivateReferences } from './usePrivateReferences'
import { sampleContent } from './__tests__/fixtures'
import type { SdsPage } from '@/services/sds'
import type { SdsSheet } from '@/features/sds/types'
const mocks = vi.hoisted(() => ({
  page: vi.fn<typeof import('@/services/sds').loadSdsPage>(),
  read: vi.fn<typeof import('@/services/intranet').readIntranetContent>(),
}))
vi.mock('@/services/sds', () => ({ loadSdsPage: mocks.page, sdsErrorMessage: (e: Error) => e.message }))
vi.mock('@/services/intranet', () => ({ readIntranetContent: mocks.read }))
const row: SdsSheet = { id: 'content', extension: 'txt', archived: false, originalName: 'Phase2 intranet content.txt', name: 'References', folderId: '', order: 0, manufacturer: '', productCode: '', language: 'English', revisionId: '1', revisionDate: '' }
const page = (sheets: SdsSheet[] = [], after = ''): SdsPage => ({ sheets, after, scanned: sheets.length, searchMode: 'bounded-metadata-scan' })
function render(options: Parameters<typeof usePrivateReferences>[0] = { enabled: () => true, context: () => 'synthetic-admin' }) {
  let state!: ReturnType<typeof usePrivateReferences>
  const view = mount(defineComponent({ setup() { state = usePrivateReferences(options); return () => h('div') } }))
  return { state, view }
}
beforeEach(() => { mocks.page.mockReset(); mocks.read.mockReset(); mocks.page.mockResolvedValue(page([row])); mocks.read.mockResolvedValue(sampleContent()) })
describe('private reference loading', () => {
  it('does not read while access is unavailable and loads when access becomes available', async () => {
    const allowed = ref(false)
    const { state, view } = render({ enabled: () => allowed.value, context: () => 'owner' })
    await flushPromises(); await state.reload(); await state.selectSource('content')
    expect(mocks.page).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
    expect(state.selectedPackage.value).toBe('')
    allowed.value = true
    await flushPromises()
    expect(state.content.value?.resources).toHaveLength(1)
    view.unmount()
  })
  it('clears loaded private content synchronously when access is revoked', async () => {
    const allowed = ref(true)
    const { state, view } = render({ enabled: () => allowed.value, context: () => 'owner' })
    await flushPromises()
    expect(state.content.value).not.toBeNull()
    allowed.value = false
    expect(state.content.value).toBeNull(); expect(state.packages.value).toEqual([])
    expect(state.selectedPackage.value).toBe(''); expect(state.loading.value).toBe(false)
    expect(mocks.page).toHaveBeenCalledOnce()
    view.unmount()
  })
  it.each(['success', 'failure'])('ignores an old account read %s without clearing the new account loading state', async outcome => {
    const owner = ref('A')
    let resolveOld!: (value: ReturnType<typeof sampleContent>) => void
    let rejectOld!: (error: Error) => void
    mocks.read.mockImplementationOnce(() => new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject }))
    const { state, view } = render({ enabled: () => true, context: () => owner.value })
    await flushPromises()
    const signal = mocks.read.mock.calls[0]![1] as AbortSignal
    let finishNew!: (value: SdsPage) => void
    mocks.page.mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve }))
    owner.value = 'B'
    expect(signal.aborted).toBe(true); expect(state.packages.value).toEqual([])
    if (outcome === 'success') resolveOld(sampleContent())
    else rejectOld(new Error('Old account failure'))
    await flushPromises()
    expect(state.loading.value).toBe(true); expect(state.content.value).toBeNull(); expect(state.error.value).toBe('')
    finishNew(page()); await flushPromises()
    expect(state.loading.value).toBe(false)
    view.unmount()
  })
  it('does not continue an obsolete paginated search after account change', async () => {
    const owner = ref('A')
    let finish!: (value: SdsPage) => void
    mocks.page.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { state, view } = render({ enabled: () => true, context: () => owner.value })
    mocks.page.mockResolvedValueOnce(page())
    owner.value = 'B'; await flushPromises()
    finish(page([row], 'old-page')); await flushPromises()
    expect(mocks.page).toHaveBeenCalledTimes(2)
    expect(mocks.read).not.toHaveBeenCalled(); expect(state.packages.value).toEqual([])
    view.unmount()
  })
  it('aborts and rejects a late read after unmount', async () => {
    let finish!: (value: ReturnType<typeof sampleContent>) => void
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { state, view } = render(); await flushPromises()
    const signal = mocks.read.mock.calls[0]![1] as AbortSignal
    view.unmount(); finish(sampleContent()); await flushPromises()
    expect(signal.aborted).toBe(true); expect(state.content.value).toBeNull()
    await state.reload(); expect(mocks.page).toHaveBeenCalledOnce()
  })
  it('loads the existing private ticket source', async () => {
    const { state, view } = render(); await flushPromises()
    expect(mocks.read).toHaveBeenCalledWith('content', expect.any(AbortSignal))
    expect(state.content.value?.resources).toHaveLength(1)
    view.unmount()
  })
  it('does not fetch absent files or choose between ambiguous sources', async () => {
    mocks.page.mockResolvedValueOnce(page())
    const first = render(); await flushPromises(); expect(first.state.content.value).toBeNull(); first.view.unmount()
    mocks.page.mockResolvedValueOnce(page([row, { ...row, id: 'other' }]))
    const second = render(); await flushPromises(); expect(second.state.packages.value).toHaveLength(2)
    expect(mocks.read).not.toHaveBeenCalled()
    await second.state.selectSource('other')
    expect(mocks.read).toHaveBeenCalledWith('other', expect.any(AbortSignal))
    expect(second.state.content.value?.forms).toHaveLength(1)
    second.view.unmount()
  })
  it('retains access errors and retries without writing', async () => {
    mocks.read.mockRejectedValueOnce(new Error('Access denied'))
    const { state, view } = render(); await flushPromises(); expect(state.error.value).toBe('Access denied')
    await state.reload(); expect(state.content.value?.forms).toHaveLength(1); view.unmount()
  })
  it('ignores late results after cancellation', async () => {
    let finish!: (value: ReturnType<typeof sampleContent>) => void
    mocks.read.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { state, view } = render(); await flushPromises(); state.cancel(); finish(sampleContent()); await flushPromises()
    expect(state.content.value).toBeNull(); expect(state.notice.value).toContain('Loading canceled'); view.unmount()
  })
  it('clears a selected source during an in-flight read without leaving a spinner or accepting a late result', async () => {
    let finish!: (value: ReturnType<typeof sampleContent>) => void
    mocks.read.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { state, view } = render(); await flushPromises()
    expect(state.loading.value).toBe(true)
    await state.selectSource('')
    finish(sampleContent()); await flushPromises()
    expect(state.selectedPackage.value).toBe('')
    expect(state.loading.value).toBe(false)
    expect(state.content.value).toBeNull()
    view.unmount()
  })
})
