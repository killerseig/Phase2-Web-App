import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SdsFileViewer from '@/components/dashboard/SdsFileViewer.vue'
import { sdsCommand } from '@/services/sds'
vi.mock('@/services/sds', () => ({ sdsCommand: vi.fn(), sdsErrorMessage: (e: Error) => e.message }))
vi.mock('@/components/dashboard/PdfCanvasViewer.vue', () => ({
  __esModule: true,
  default: { props: ['url'], template: '<div data-testid="pdf-preview" :data-url="url"></div>' },
}))
const sheet = {
  id: 'a',
  name: 'Adhesive',
  folderId: '',
  order: 0,
  manufacturer: 'Example',
  productCode: '',
  language: 'English',
  revisionId: 'r1',
  revisionDate: '',
  archived: false,
}
const props = { sheet, jobId: '', version: '1:0', earlierRevision: false }
describe('SDS inline preview', () => {
  beforeEach(() => vi.clearAllMocks())
  it('ignores an earlier file response after the user selects another file', async () => {
    let finishFirst!: (value: { url: string }) => void
    vi.mocked(sdsCommand)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve
          }),
      )
      .mockResolvedValueOnce({ url: 'https://example.invalid/second.pdf' })
    const wrapper = mount(SdsFileViewer, { props })
    await wrapper.setProps({ sheet: { ...sheet, id: 'b', name: 'Paint' } })
    await flushPromises()
    expect(wrapper.get('[data-testid=pdf-preview]').attributes('data-url')).toContain('second.pdf')
    finishFirst({ url: 'https://example.invalid/first.pdf' })
    await flushPromises()
    expect(wrapper.get('[data-testid=pdf-preview]').attributes('data-url')).toContain('second.pdf')
    wrapper.unmount()
  })
  it('removes the old preview on a job change and shows authorization failure with retry', async () => {
    vi.mocked(sdsCommand)
      .mockResolvedValueOnce({ url: 'https://example.invalid/master.pdf' })
      .mockRejectedValueOnce(new Error('Job access denied.'))
      .mockResolvedValueOnce({ url: 'https://example.invalid/authorized.pdf' })
    const wrapper = mount(SdsFileViewer, { props })
    await flushPromises()
    await wrapper.setProps({ jobId: 'job-b' })
    await flushPromises()
    expect(wrapper.find('[data-testid=pdf-preview]').exists()).toBe(false)
    expect(wrapper.get('[role=alert]').text()).toContain('Job access denied.')
    await wrapper.get('[role=alert] button').trigger('click')
    await flushPromises()
    expect(sdsCommand).toHaveBeenLastCalledWith('openSheet', {
      id: 'a',
      jobId: 'job-b',
      download: false,
    })
    expect(wrapper.get('[data-testid=pdf-preview]').attributes('data-url')).toContain(
      'authorized.pdf',
    )
    wrapper.unmount()
  })
})
