import { beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({ create: vi.fn(), pdf: vi.fn(), file: vi.fn(), docx: vi.fn() }))
vi.mock('./pdfWorkerSession', () => ({ createPdfWorkerSession: fake.create }))
vi.mock('../../components/dashboard/PdfCanvasViewer.vue', () => { fake.pdf(); return { default: {} } })
vi.mock('../../components/dashboard/FileContentViewer.vue', () => { fake.file(); return { default: {} } })
vi.mock('../../components/dashboard/DocxDocumentViewer.vue', () => { fake.docx(); return { default: {} } })
vi.mock('docx-preview', () => ({}))
import { createViewerSession } from './viewerSession'

describe('document viewer workspace lifetime', () => {
  beforeEach(() => { fake.create.mockReset() })
  it('starts the PDF runtime before prepare completes and shares it until account reset', async () => {
    let finish!: () => void
    const runtime = { ready: vi.fn(() => new Promise<void>(resolve => { finish = resolve })), dispose: vi.fn().mockResolvedValue(undefined) }
    fake.create.mockReturnValue(runtime)
    const session = createViewerSession()
    const preparing = session.prepare('pdf')
    await vi.waitFor(() => expect(runtime.ready).toHaveBeenCalled())
    // This is independent of the still-pending authorization in SdsFileViewer.
    expect(fake.pdf).toHaveBeenCalledOnce()
    finish()
    // Subsequent ready calls use the real worker's already-settled promise.
    runtime.ready.mockResolvedValue(undefined)
    await preparing
    expect(await session.pdf()).toBe(runtime)
    expect(fake.create).toHaveBeenCalledOnce()
    session.reset(false)
    expect(runtime.dispose).toHaveBeenCalled()
    await expect(session.prepare('pdf')).rejects.toThrow('closed')
    await expect(session.pdf()).rejects.toThrow('closed')
    expect(fake.create).toHaveBeenCalledOnce()
    session.reset(true)
    const next = { ready: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) }
    fake.create.mockReturnValue(next)
    expect(await session.pdf()).toBe(next)
    session.dispose()
    expect(next.dispose).toHaveBeenCalled()
    await expect(session.pdf()).rejects.toThrow('closed')
  })
  it('disposes a warming worker and rejects its late completion after logout/exit', async () => {
    let finish!: () => void
    const runtime = { ready: vi.fn(() => new Promise<void>(resolve => { finish = resolve })), dispose: vi.fn().mockResolvedValue(undefined) }
    fake.create.mockReturnValue(runtime)
    const session = createViewerSession(), opening = session.pdf()
    await vi.waitFor(() => expect(runtime.ready).toHaveBeenCalled())
    session.dispose(); finish()
    await expect(opening).rejects.toThrow('closed')
    expect(runtime.dispose).toHaveBeenCalled()
  })
  it('does not retain a failed worker, allowing an explicit retry', async () => {
    const failed = { ready: vi.fn().mockRejectedValue(new Error('Worker failed')), dispose: vi.fn().mockResolvedValue(undefined) }
    fake.create.mockReturnValueOnce(failed).mockReturnValue({ ready: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) })
    const session = createViewerSession()
    await expect(session.pdf()).rejects.toThrow('Worker failed')
    expect(failed.dispose).toHaveBeenCalled()
    await expect(session.pdf()).resolves.toBeDefined()
    session.dispose()
  })
})
