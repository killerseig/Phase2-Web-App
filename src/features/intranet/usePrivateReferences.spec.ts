import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrivateReferences } from './usePrivateReferences'
import { sampleContent } from './__tests__/fixtures'
const mocks = vi.hoisted(() => ({ page: vi.fn(), read: vi.fn() }))
vi.mock('@/services/sds', () => ({ loadSdsPage: mocks.page, sdsErrorMessage: (e: Error) => e.message }))
vi.mock('@/services/intranet', () => ({ readIntranetContent: mocks.read }))
const row = { id: 'content', extension: 'txt', archived: false, originalName: 'Phase2 intranet content.txt', name: 'References' }
function render() {
  let state!: ReturnType<typeof usePrivateReferences>
  const view = mount(defineComponent({ setup() { state = usePrivateReferences(); return () => h('div') } }))
  return { state, view }
}
beforeEach(() => { mocks.page.mockReset(); mocks.read.mockReset(); mocks.page.mockResolvedValue({ sheets: [row], after: '' }); mocks.read.mockResolvedValue(sampleContent()) })
describe('private reference loading', () => {
  it('loads the existing private ticket source', async () => {
    const { state, view } = render(); await flushPromises()
    expect(mocks.read).toHaveBeenCalledWith('content', expect.any(AbortSignal))
    expect(state.content.value?.resources).toHaveLength(1)
    view.unmount()
  })
  it('does not fetch absent files or choose between ambiguous sources', async () => {
    mocks.page.mockResolvedValueOnce({ sheets: [], after: '' })
    const first = render(); await flushPromises(); expect(first.state.content.value).toBeNull(); first.view.unmount()
    mocks.page.mockResolvedValueOnce({ sheets: [row, { ...row, id: 'other' }], after: '' })
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
