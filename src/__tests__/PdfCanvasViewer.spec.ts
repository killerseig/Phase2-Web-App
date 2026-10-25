import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { getDocument } from 'pdfjs-dist'
import PdfCanvasViewer from '@/components/dashboard/PdfCanvasViewer.vue'

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }))
const link = 'https://us-central1-phase2-website.cloudfunctions.net/downloadSdsFile?ticket=synthetic-test'
describe('PDF preview lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('shows a recoverable error for a malformed file URL without leaving a blank viewer', async () => {
    const wrapper = mount(PdfCanvasViewer, { props: { url: 'invalid URL' } })
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('could not be loaded')
    expect(wrapper.find('[role=status]').exists()).toBe(false)
    expect(getDocument).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('catches synchronous worker startup failure', async () => {
    vi.mocked(getDocument).mockImplementationOnce(() => { throw Error('Worker startup failed') })
    const wrapper = mount(PdfCanvasViewer, { props: { url: link } })
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('Reload the preview')
    expect(wrapper.find('[role=status]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('renders a loaded page then clears it on file change and exposes a failed request', async () => {
    const destroy = vi.fn()
    const page = { getViewport: () => ({ width: 200, height: 300 }), render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }) }
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve({ numPages: 2, getPage: vi.fn().mockResolvedValue(page) }), destroy } as unknown as ReturnType<typeof getDocument>)
    const wrapper = mount(PdfCanvasViewer, { props: { url: link } })
    await flushPromises()
    expect(wrapper.get('canvas').attributes('aria-label')).toBe('PDF page 1 of 2')
    expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: '/sds-file?ticket=synthetic-test' }))
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.reject(Error('Forbidden')), destroy: vi.fn() } as unknown as ReturnType<typeof getDocument>)
    await wrapper.setProps({ url: link + '-expired' })
    await flushPromises()
    expect(destroy).toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.get('[role=alert]').text()).toContain('could not be loaded')
    wrapper.unmount()
  })
})
