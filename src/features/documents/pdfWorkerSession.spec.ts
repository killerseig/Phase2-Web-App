import { beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({ workers: [] as { promise: Promise<void>; destroy: ReturnType<typeof vi.fn> }[], tasks: [] as { destroy: ReturnType<typeof vi.fn> }[], getDocument: vi.fn() }))
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  PDFWorker: class {
    promise = Promise.resolve()
    destroy = vi.fn()
    constructor() { fake.workers.push(this) }
  },
  getDocument: fake.getDocument,
}))
import { createPdfWorkerSession } from './pdfWorkerSession'

describe('explorer-owned PDF worker', () => {
  beforeEach(() => {
    fake.workers.length = 0; fake.tasks.length = 0; fake.getDocument.mockReset()
    fake.getDocument.mockImplementation(() => {
      const task = { destroy: vi.fn().mockResolvedValue(undefined) }
      fake.tasks.push(task)
      return task
    })
  })
  it('shares the worker across fresh authorized documents without caching their bytes', async () => {
    const session = createPdfWorkerSession()
    const first = await session.open('https://example.invalid/file?ticket=first')
    await session.release(first)
    const second = await session.open('https://example.invalid/file?ticket=second')
    expect(fake.workers).toHaveLength(1)
    expect(fake.tasks[0]!.destroy).toHaveBeenCalledOnce()
    expect(fake.workers[0]!.destroy).not.toHaveBeenCalled()
    expect(fake.getDocument.mock.calls.map(([options]) => options.url)).toEqual(['/sds-file?ticket=first', '/sds-file?ticket=second'])
    expect(fake.getDocument.mock.calls.every(([options]) => options.worker === fake.workers[0])).toBe(true)
    await session.release(second)
    await session.dispose()
    expect(fake.workers[0]!.destroy).toHaveBeenCalledOnce()
    await expect(session.open('https://example.invalid/file?ticket=late')).rejects.toThrow('closed')
    expect(fake.getDocument).toHaveBeenCalledTimes(2)
  })
  it('waits for document teardown before terminating the worker on workspace exit', async () => {
    let finish!: () => void
    const session = createPdfWorkerSession()
    await session.open('https://example.invalid/file?ticket=first')
    fake.tasks[0]!.destroy.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    const disposal = session.dispose()
    expect(fake.tasks[0]!.destroy).toHaveBeenCalledOnce()
    expect(fake.workers[0]!.destroy).not.toHaveBeenCalled()
    expect(session.dispose()).toBe(disposal)
    finish(); await disposal
    expect(fake.workers[0]!.destroy).toHaveBeenCalledOnce()
  })
  it('can close while worker startup is pending, preventing a late file request', async () => {
    const session = createPdfWorkerSession()
    let finish!: () => void
    fake.workers[0]!.promise = new Promise<void>(resolve => { finish = resolve })
    const opening = session.open('https://example.invalid/file?ticket=late')
    await session.dispose(); finish()
    await expect(opening).rejects.toThrow('closed')
    expect(fake.getDocument).not.toHaveBeenCalled()
  })
})
