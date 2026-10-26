import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibraryBookExport } from './useLibraryBookExport'
import { createDocumentOpener } from '@/features/documents/documentWindow'
const fake = vi.hoisted(() => ({ command: vi.fn<(action: string, data: unknown) => Promise<unknown>>() }))
vi.mock('./commands', () => ({ libraryCommand: fake.command }))
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
function fixture() {
  const error = ref(''), opener = createDocumentOpener()
  return { error, opener, book: useLibraryBookExport({ error, opener }) }
}
beforeEach(() => { fake.command.mockReset(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe('Library book-export lifetime', () => {
  it('requests the exact binder revision and polls only until completion', async () => {
    const { book } = fixture()
    fake.command.mockResolvedValueOnce({ id: 'ignored-server-id' }).mockResolvedValueOnce({ status: 'running' }).mockResolvedValueOnce({ status: 'complete', pageCount: 12 })
    await book.request({ jobId: 'job-1', version: 7, printableOnly: true }); await flush()
    expect(fake.command).toHaveBeenNthCalledWith(1, 'requestExport', { requestId: book.id.value, jobId: 'job-1', version: 7, printableOnly: true })
    expect(book.state.value).toBe('running')
    await vi.advanceTimersByTimeAsync(2500)
    expect(book.state.value).toBe('complete'); expect(book.pages.value).toBe(12)
    await vi.advanceTimersByTimeAsync(10000)
    expect(fake.command).toHaveBeenCalledTimes(3)
    book.dispose()
  })
  it('ignores late status failures after switching exports and stops polling on disposal', async () => {
    const { book } = fixture()
    let fail!: (error: Error) => void
    fake.command.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject })).mockResolvedValue({ status: 'running' })
    book.resume('old'); book.resume('new'); await flush()
    fail(new Error('Old failure')); await flush()
    expect(book.id.value).toBe('new'); expect(book.error.value).toBe('')
    book.dispose(); await vi.advanceTimersByTimeAsync(10000)
    expect(fake.command).toHaveBeenCalledTimes(2)
  })
  it('cannot restart polling from a late request response after clear', async () => {
    const { book } = fixture()
    let finish!: (value: unknown) => void
    fake.command.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = book.request({ jobId: '', version: 2, printableOnly: false })
    book.clear(); finish({ id: 'old' }); await pending
    expect(book.id.value).toBe(''); expect(book.state.value).toBe('')
    expect(fake.command).toHaveBeenCalledOnce(); book.dispose()
  })
  it('reports current request/status failures and permits a fresh retry', async () => {
    const { book, error } = fixture()
    fake.command.mockRejectedValueOnce(new Error('Request failed'))
    await book.request({ jobId: '', version: 2, printableOnly: false })
    expect(error.value).toBe('Request failed')
    fake.command.mockRejectedValueOnce(new Error('Status failed'))
    book.resume('retry'); await flush()
    expect(book.state.value).toBe('failed'); expect(book.error.value).toBe('Status failed')
    fake.command.mockResolvedValueOnce({ status: 'complete', pageCount: 1 })
    book.resume('retry'); await flush()
    expect(book.state.value).toBe('complete'); expect(book.error.value).toBe(''); book.dispose()
  })
  it('opens export links synchronously but rejects a late link after clear', async () => {
    const tab = { opener: null, document: { title: '', body: { textContent: '' } }, location: { replace: vi.fn<(url: string) => void>() }, close: vi.fn<() => void>() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const { book, error, opener } = fixture()
    fake.command.mockResolvedValueOnce({ status: 'complete' }); book.resume('book'); await flush()
    let finish!: (value: unknown) => void
    fake.command.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = book.retrieve(true)
    expect(window.open).toHaveBeenCalledOnce()
    expect(fake.command).toHaveBeenLastCalledWith('exportStatus', { id: 'book', download: true, link: true })
    book.clear(); finish({ status: 'complete', url: '/old-ticket' }); await pending
    expect(tab.location.replace).not.toHaveBeenCalled(); expect(tab.close).toHaveBeenCalledOnce()
    expect(error.value).toBe(''); book.dispose(); opener.dispose()
  })
})
