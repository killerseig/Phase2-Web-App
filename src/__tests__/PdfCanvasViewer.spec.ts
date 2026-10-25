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
    const destroy = vi.fn().mockResolvedValue(undefined)
    const page = { getViewport: ({ scale }: { scale: number }) => ({ width: 200 * scale, height: 300 * scale }), cleanup: vi.fn(), render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }) }
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve({ numPages: 2, getPage: vi.fn().mockResolvedValue(page) }), destroy } as unknown as ReturnType<typeof getDocument>)
    const wrapper = mount(PdfCanvasViewer, { props: { url: link } })
    await flushPromises()
    expect(wrapper.get('canvas').attributes('aria-label')).toBe('PDF page 1 of 2')
    expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: '/sds-file?ticket=synthetic-test' }))
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.reject(Error('Forbidden')), destroy: vi.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof getDocument>)
    await wrapper.setProps({ url: link + '-expired' })
    await flushPromises()
    expect(destroy).toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.get('[role=alert]').text()).toContain('could not be loaded')
    wrapper.unmount()
  })
  it('keeps a 387-page book lazy, supports distant jumps and releases old pages', async () => {
    const cleanup = vi.fn(), getPage = vi.fn().mockImplementation(async () => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale }),
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }), cleanup,
    }))
    const destroy = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve({ numPages: 387, getPage }), destroy } as unknown as ReturnType<typeof getDocument>)
    const wrapper = mount(PdfCanvasViewer, { props: { url: link } })
    await flushPromises()
    expect(wrapper.findAll('[data-pdf-page]')).toHaveLength(387)
    expect(wrapper.findAll('canvas').length).toBeLessThanOrEqual(6)
    expect(getPage.mock.calls.length).toBeLessThan(8)
    await wrapper.get('input[aria-label="PDF page"]').setValue('200')
    await flushPromises()
    expect(wrapper.find('canvas[data-page="200"]').exists()).toBe(true)
    expect(wrapper.find('canvas[data-page="1"]').exists()).toBe(false)
    expect(wrapper.findAll('canvas').length).toBeLessThanOrEqual(6)
    expect(cleanup).toHaveBeenCalled()
    wrapper.unmount(); await flushPromises()
    expect(destroy).toHaveBeenCalled()
  })
  it('cancels unfinished page rendering and prevents stale content after a document switch', async () => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const cancel = vi.fn(), oldCleanup = vi.fn(), destroy = vi.fn().mockResolvedValue(undefined)
    const page = (slow = false) => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 200 * scale, height: 300 * scale }),
      cleanup: slow ? oldCleanup : vi.fn(),
      render: () => ({ promise: slow ? pending : Promise.resolve(), cancel: slow ? cancel : vi.fn() }),
    })
    vi.mocked(getDocument)
      .mockReturnValueOnce({ promise: Promise.resolve({ numPages: 387, getPage: vi.fn(async number => page(number === 2)) }), destroy } as unknown as ReturnType<typeof getDocument>)
      .mockReturnValueOnce({ promise: Promise.resolve({ numPages: 1, getPage: vi.fn(async () => page()) }), destroy: vi.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof getDocument>)
    const wrapper = mount(PdfCanvasViewer, { props: { url: link } })
    await flushPromises()
    await wrapper.setProps({ url: link + '-next' }); await flushPromises()
    expect(cancel).toHaveBeenCalled(); expect(destroy).toHaveBeenCalled()
    finish(); await flushPromises()
    expect(oldCleanup).toHaveBeenCalled()
    expect(wrapper.findAll('canvas')).toHaveLength(1)
    expect(wrapper.get('canvas').attributes('aria-label')).toBe('PDF page 1 of 1')
    wrapper.unmount()
  })
})
