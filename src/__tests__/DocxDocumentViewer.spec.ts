import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderDocxPages, docxFrame, type DocxPages } from '@/features/documents/docxPreview'
import DocxDocumentViewer from '@/components/dashboard/DocxDocumentViewer.vue'
vi.mock('@/features/documents/docxPreview', () => ({ renderDocxPages: vi.fn(), docxFrame: vi.fn(() => '<html><body>Safe document pages</body></html>') }))
const page: DocxPages = { markup: '<section>Pages</section>', styles: '', pageCount: 2, pageWidth: 816, empty: false, omittedExternalContent: false }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }) })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
it('uses a scriptless frame with a meaningful title and scrolling guidance', async () => {
  vi.mocked(renderDocxPages).mockResolvedValueOnce(page)
  const wrapper = mount(DocxDocumentViewer, { props: { bytes: new ArrayBuffer(2), name: 'Poster' } })
  await flushPromises()
  expect(wrapper.get('iframe').attributes('sandbox')).toBe('')
  expect(wrapper.get('iframe').attributes('title')).toContain('Poster')
  expect(wrapper.get('.docx-note').attributes('title')).toContain('Scroll to view pages')
  expect(docxFrame).toHaveBeenCalled()
  wrapper.unmount()
})
it('shows a useful empty state instead of a blank page', async () => {
  vi.mocked(renderDocxPages).mockResolvedValueOnce({ ...page, empty: true })
  const wrapper = mount(DocxDocumentViewer, { props: { bytes: new ArrayBuffer(2), name: 'Empty' } })
  await flushPromises()
  expect(wrapper.find('iframe').exists()).toBe(false)
  expect(wrapper.get('[role=status]').text()).toContain('no displayable text or images')
  wrapper.unmount()
})
it('discards stale render results when switching documents and clears prior errors', async () => {
  let first!: (value: DocxPages) => void
  vi.mocked(renderDocxPages).mockImplementationOnce(() => new Promise(resolve => { first = resolve })).mockRejectedValueOnce(Error('Corrupt file')).mockResolvedValueOnce(page)
  const wrapper = mount(DocxDocumentViewer, { props: { bytes: new ArrayBuffer(2), name: 'First' } })
  await wrapper.setProps({ bytes: new ArrayBuffer(3), name: 'Broken' }); await flushPromises()
  first(page); await flushPromises()
  expect(wrapper.find('iframe').exists()).toBe(false)
  expect(wrapper.get('[role=alert]').text()).toContain('could not be previewed')
  await wrapper.setProps({ bytes: new ArrayBuffer(4), name: 'Next' }); await flushPromises()
  expect(wrapper.get('iframe').attributes('title')).toContain('Next')
  expect(wrapper.find('[role=alert]').exists()).toBe(false)
  wrapper.unmount()
})
it('times out safely and ignores a late renderer result', async () => {
  vi.useFakeTimers()
  let resolve!: (value: DocxPages) => void
  vi.mocked(renderDocxPages).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const wrapper = mount(DocxDocumentViewer, { props: { bytes: new ArrayBuffer(2), name: 'Slow' } })
  await vi.advanceTimersByTimeAsync(20000)
  resolve(page); await flushPromises()
  expect(wrapper.find('iframe').exists()).toBe(false)
  expect(wrapper.get('[role=alert]').text()).toContain('timed out')
  wrapper.unmount()
})
