import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SdsExplorerModule from '@/components/dashboard/SdsExplorerModule.vue'
import { loadSds, loadSdsPage, sdsCommand, uploadDocument } from '@/services/sds'

const access = vi.hoisted(() => ({ role: 'admin', jobId: '' }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ rawRole: access.role, currentUser: { uid: 'admin' } }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/test-upload', query: access.jobId ? { sdsJob: access.jobId } : {} }),
  onBeforeRouteLeave: vi.fn(),
  RouterLink: { template: '<a><slot /></a>' },
}))
vi.mock('@/services/sds', () => ({
  loadSds: vi.fn(),
  loadSdsPage: vi.fn(),
  preflightSdsImport: vi.fn(),
  sdsCommand: vi.fn(),
  uploadDocument: vi.fn(),
  sdsErrorMessage: (error: Error) => error.message,
}))
const cleanup = vi.fn()
const uploadId = '00000000-0000-4000-8000-000000000001'
const mountModule = (toolbar = false, initialFolderId = '') =>
  mount(SdsExplorerModule, {
    props: { initialFolderId },
    global: {
      stubs: {
        DocumentExplorer: {
          props: ['selectedId'],
          template: `<div :data-selected="selectedId">${toolbar ? '<slot name="toolbar" />' : ''}<button @click="$emit('action', 'new-sheet', {kind: 'folder', id: 'materials'})">Add file here</button><slot name="viewer" /></div>`,
        },
        SdsFileViewer: true,
      },
    },
  })
async function choose(wrapper: ReturnType<typeof mountModule>, file?: File) {
  const input = wrapper.get<HTMLInputElement>('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: file ? [file] : [], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('direct document upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    access.role = 'admin'; access.jobId = ''; localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true })
    vi.mocked(loadSds).mockResolvedValue({
      version: 7,
      folders: [{ id: 'materials', name: 'Materials', parentId: '', order: 0 }],
      sheets: [],
      binder: { version: 0, selections: [] },
    })
    vi.mocked(loadSdsPage).mockImplementation(async () => ({
      sheets: (await loadSds()).sheets,
      after: '',
      scanned: 0,
      searchMode: 'bounded-metadata-scan',
    }))
    vi.mocked(uploadDocument).mockResolvedValue({
      uploadId,
      uploadExtension: 'pdf',
      originalName: 'Safety sheet.pdf',
      cleanup,
    })
    vi.mocked(sdsCommand).mockResolvedValue({ id: 'new-file' } as never)
  })
  it('uploads immediately with the filename into the context-menu folder and selects it', async () => {
    const wrapper = mountModule()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
    const file = new File(['pdf'], 'Safety sheet.pdf', { type: 'application/pdf' })
    await choose(wrapper, file)
    expect(uploadDocument).toHaveBeenCalledWith(file, expect.any(Function))
    expect(sdsCommand).toHaveBeenCalledWith(
      'saveSheet',
      expect.objectContaining({
        name: 'Safety sheet.pdf',
        folderId: 'materials',
        version: 7,
        uploadId,
        uploadExtension: 'pdf',
        originalName: 'Safety sheet.pdf',
        archived: false,
      }),
    )
    expect(wrapper.find('[data-selected="new-file"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('File added.')
    expect(cleanup).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
  it('canceling the picker performs no upload or write', async () => {
    const wrapper = mountModule()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await choose(wrapper)
    expect(uploadDocument).not.toHaveBeenCalled()
    expect(sdsCommand).not.toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })
  it('reports a failed save, cleans up staging, and allows retrying the same file', async () => {
    vi.mocked(sdsCommand).mockRejectedValueOnce(new Error('Please try again.'))
    const wrapper = mountModule()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    const file = new File(['pdf'], 'Safety sheet.pdf', { type: 'application/pdf' })
    await choose(wrapper, file)
    expect(wrapper.get('[role=alert]').text()).toBe('Please try again.')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(wrapper.get<HTMLInputElement>('input[type=file]').element.value).toBe('')
    await wrapper.get('button').trigger('click')
    await choose(wrapper, file)
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    expect(wrapper.text()).toContain('File added.')
    expect(sdsCommand).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
  it('makes upload discoverable and saves into the displayed folder using the existing service', async () => {
    const wrapper = mountModule(true, 'materials'); await flushPromises()
    const upload = wrapper.findAll('button').find(button => button.text() === 'Upload document')!
    expect(upload.exists()).toBe(true)
    await upload.trigger('click')
    await choose(wrapper, new File(['pdf'], 'Safety sheet.pdf', { type: 'application/pdf' }))
    expect(sdsCommand).toHaveBeenCalledWith('saveSheet', expect.objectContaining({ folderId: 'materials', uploadId }))
    wrapper.unmount()
  })
  it('canceling the visible picker or new-folder editor makes no writes', async () => {
    const wrapper = mountModule(true); await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Upload document')!.trigger('click')
    await choose(wrapper)
    await wrapper.findAll('button').find(button => button.text() === 'New folder')!.trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    await wrapper.findAll('form button').find(button => button.text() === 'Cancel')!.trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(uploadDocument).not.toHaveBeenCalled(); expect(sdsCommand).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps master upload controls unavailable to readers and job views', async () => {
    access.role = 'foreman'
    const reader = mountModule(true); await flushPromises()
    expect(reader.text()).not.toContain('Upload document'); expect(reader.find('input[type=file]').exists()).toBe(false)
    reader.unmount()
    access.role = 'admin'; access.jobId = 'job-one'
    const job = mountModule(true); await flushPromises()
    expect(job.text()).not.toContain('Upload document'); expect(job.text()).not.toContain('New folder')
    expect(job.find('input[type=file]').exists()).toBe(false)
    job.unmount()
  })
})
