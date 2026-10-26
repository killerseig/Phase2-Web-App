import { getDocument, GlobalWorkerOptions, PDFWorker, type PDFDocumentLoadingTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { previewFileUrl } from './formats'

GlobalWorkerOptions.workerSrc = workerUrl

// One worker per open explorer, never a global document/byte cache. Loading tasks
// receive an external worker so destroying a document does not terminate it.
export function createPdfWorkerSession() {
  const worker = new PDFWorker()
  const tasks = new Set<PDFDocumentLoadingTask>()
  const closing = new Set<Promise<void>>()
  let disposed = false
  let disposal: Promise<void> | undefined
  async function ready() {
    await worker.promise
    if (disposed) throw new Error('Document workspace closed')
  }
  function release(task: PDFDocumentLoadingTask) {
    if (!tasks.delete(task)) return Promise.resolve()
    const pending = task.destroy().catch(() => undefined).finally(() => closing.delete(pending))
    closing.add(pending)
    return pending
  }
  return {
    ready,
    async open(url: string, data?: Uint8Array<ArrayBuffer>) {
      await ready()
      const task = getDocument({ worker, ...(data ? { data } : { url: previewFileUrl(url), disableAutoFetch: true, disableStream: true }), cMapUrl: '/sds-pdf-assets/cmaps/', cMapPacked: true, standardFontDataUrl: '/sds-pdf-assets/standard_fonts/', wasmUrl: '/sds-pdf-assets/wasm/' })
      tasks.add(task)
      return task
    },
    release,
    dispose() {
      if (disposal) return disposal
      disposed = true
      for (const task of tasks) void release(task)
      disposal = Promise.all([...closing]).then(() => { worker.destroy() })
      return disposal
    },
  }
}

export type PdfWorkerSession = ReturnType<typeof createPdfWorkerSession>
