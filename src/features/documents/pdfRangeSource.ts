import { PDFDataRangeTransport } from 'pdfjs-dist'
import type { createAuthorizedFetch } from './authorizedFetch'

type Fetcher = ReturnType<typeof createAuthorizedFetch>
const chunkSize = 64 * 1024
function contentRange(value: string | null) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value || '')
  if (!match) throw new Error('The document server returned an invalid byte range.')
  const [begin, last, length] = match.slice(1).map(Number) as [number, number, number]
  if (![begin, last, length].every(Number.isSafeInteger) || begin < 0 || last < begin || last >= length) throw new Error('The document server returned an invalid byte range.')
  return { begin, last, length }
}

// The transport retries bytes in place; the PDF document, page anchors, zoom and
// canvases survive ticket renewal. It never caches a whole partial book itself.
export async function openPdfRangeSource(fetcher: Fetcher, signal: AbortSignal, abort: () => void, onError: (error: unknown) => void) {
  const response = await fetcher.request({ headers: { Range: `bytes=0-${chunkSize - 1}` } })
  const initial = new Uint8Array(await response.arrayBuffer())
  if (signal.aborted) throw new DOMException('Document closed', 'AbortError')
  if (response.status === 200) return { data: initial }
  const first = contentRange(response.headers.get('Content-Range'))
  if (response.status !== 206 || first.begin !== 0 || first.last !== Math.min(chunkSize, first.length) - 1 || initial.length !== first.last + 1) throw new Error('The document server returned incomplete PDF bytes.')
  let failed = false
  class DocumentRange extends PDFDataRangeTransport {
    requestDataRange(begin: number, end: number) {
      void (async () => {
        if (failed || signal.aborted) return
        if (!Number.isSafeInteger(begin) || !Number.isSafeInteger(end) || begin < 0 || end <= begin || end > first.length) throw new Error('Invalid PDF byte request.')
        const part = await fetcher.request({ headers: { Range: `bytes=${begin}-${end - 1}` } })
        let bytes = new Uint8Array(await part.arrayBuffer())
        if (part.status === 206) {
          const range = contentRange(part.headers.get('Content-Range'))
          if (range.begin !== begin || range.last !== end - 1 || range.length !== first.length || bytes.length !== end - begin) throw new Error('The document version changed. Reopen it to continue.')
        } else if (part.status === 200 && bytes.length === first.length) bytes = bytes.slice(begin, end)
        else throw new Error('The document server returned incomplete PDF bytes.')
        if (!failed && !signal.aborted) this.onDataRange(begin, bytes)
      })().catch(error => {
        if (failed || signal.aborted) return
        failed = true; onError(error); abort()
      })
    }
    abort() { abort() }
  }
  return { range: new DocumentRange(first.length, initial, true) }
}
