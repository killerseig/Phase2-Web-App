import { mount, flushPromises } from '@vue/test-utils'
import { webcrypto, createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SdsBulkImport from '@/components/dashboard/SdsBulkImport.vue'
import { loadSds, preflightSdsImport, sdsCommand, uploadDocument } from '@/services/sds'
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ currentUser: { uid: 'admin' } }) }))
vi.mock('@/services/sds', () => ({
  loadSds: vi.fn(),
  preflightSdsImport: vi.fn(),
  sdsCommand: vi.fn(),
  uploadDocument: vi.fn(),
  sdsErrorMessage: (e: Error) => e.message,
}))
const bytes = new TextEncoder().encode('%PDF-fixture')
const hash = createHash('sha256').update(bytes).digest('hex')
const row = (path: string) => ({
  path,
  size: bytes.length,
  sha256: hash,
  name: path,
  manufacturer: '',
  productCode: '',
  language: 'English',
  revisionDate: '',
  provenance: 'Source index',
})
function file(name: string) {
  const picked = new File([bytes], name)
  Object.defineProperty(picked, 'arrayBuffer', { value: async () => bytes.buffer })
  return picked
}
async function prepare(paths = ['a.pdf', 'b.pdf']) {
  vi.mocked(preflightSdsImport).mockResolvedValue({
    version: 1,
    files: paths.map(row),
    totalBytes: bytes.length * paths.length,
    duplicateByteGroups: [paths],
    currency: 'unverified',
  })
  const wrapper = mount(SdsBulkImport, { props: { folderId: 'materials' } })
  const index = file('index.json')
  Object.defineProperty(index, 'text', {
    value: async () => JSON.stringify({ version: 1, files: paths.map(row) }),
  })
  const inputs = wrapper.findAll('input')
  Object.defineProperty(inputs[0]!.element, 'files', { value: [index] })
  await inputs[0]!.trigger('change')
  Object.defineProperty(inputs[2]!.element, 'files', { value: paths.map(file) })
  await inputs[2]!.trigger('change')
  await wrapper.get('button').trigger('click')
  // WebCrypto operates outside Vue's microtask queue.
  await vi.waitFor(() => expect(wrapper.text()).toContain('0 /'))
  return wrapper
}
describe('bulk index import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('crypto', webcrypto)
    vi.mocked(loadSds).mockResolvedValue({
      version: 8,
      folders: [],
      sheets: [],
      binder: { version: 0, selections: [] },
    })
    vi.mocked(uploadDocument).mockResolvedValue({
      uploadId: 'staged',
      uploadExtension: 'pdf',
      originalName: 'original.pdf',
      cleanup: vi.fn(async () => undefined),
    })
  })
  it('previews before writes, preserves metadata and byte evidence, and resumes only failed rows', async () => {
    const wrapper = await prepare()
    expect(uploadDocument).not.toHaveBeenCalled()
    vi.mocked(sdsCommand)
      .mockResolvedValueOnce({ id: 'a' } as never)
      .mockRejectedValueOnce(new Error('Interrupted'))
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('1 / 2 saved')
    expect(wrapper.text()).toContain('Interrupted')
    expect(sdsCommand).toHaveBeenCalledWith(
      'saveSheet',
      expect.objectContaining({
        sourcePath: 'a.pdf',
        expectedSha256: hash,
        expectedSize: bytes.length,
        folderId: 'materials',
        version: 8,
      }),
    )
    vi.mocked(sdsCommand).mockResolvedValueOnce({ id: 'b' } as never)
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('2 / 2 saved')
    expect(uploadDocument).toHaveBeenCalledTimes(3)
    expect(wrapper.emitted('completed')).toHaveLength(2)
  })
  it('rejects index-to-file path mismatch before any upload', async () => {
    const wrapper = await prepare()
    vi.mocked(preflightSdsImport).mockResolvedValueOnce({
      version: 1,
      files: [row('missing.pdf')],
      totalBytes: bytes.length,
      duplicateByteGroups: [],
      currency: 'unverified',
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('match exactly')
    expect(uploadDocument).not.toHaveBeenCalled()
  })
})
