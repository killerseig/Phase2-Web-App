import type { InjectionKey } from 'vue'
import type { PdfWorkerSession } from './pdfWorkerSession'

export const loadPdfViewer = () => import('../../components/dashboard/PdfCanvasViewer.vue')
export const loadFileViewer = () => import('../../components/dashboard/FileContentViewer.vue')
export const loadDocxViewer = () => import('../../components/dashboard/DocxDocumentViewer.vue')

export function createViewerSession() {
  let generation = 0
  let disposed = false
  let enabled = true
  let runtime: Promise<PdfWorkerSession> | undefined
  let currentSession: PdfWorkerSession | undefined
  function pdf() {
    if (disposed || !enabled) return Promise.reject<PdfWorkerSession>(new Error('Document workspace closed'))
    if (!runtime) {
      const current = generation
      const pending = import('./pdfWorkerSession').then(async ({ createPdfWorkerSession }) => {
        if (disposed || current !== generation) throw new Error('Document workspace closed')
        const session = createPdfWorkerSession()
        currentSession = session
        try {
          await session.ready()
          if (disposed || current !== generation) throw new Error('Document workspace closed')
          return session
        } catch (error) {
          await session.dispose()
          if (currentSession === session) currentSession = undefined
          throw error
        }
      })
      runtime = pending
      void pending.catch(() => { if (runtime === pending) runtime = undefined })
    }
    return runtime
  }
  function reset(active = true) {
    enabled = active
    generation++
    const previous = runtime
    runtime = undefined
    void currentSession?.dispose()
    currentSession = undefined
    void previous?.then(session => session.dispose()).catch(() => undefined)
  }
  return {
    pdf,
    async prepare(extension: string) {
      if (disposed || !enabled) throw new Error('Document workspace closed')
      if (extension === 'pdf') {
        await Promise.all([loadPdfViewer(), pdf().then(session => session.ready())])
      } else {
        await Promise.all([loadFileViewer(), ...(extension === 'docx' ? [loadDocxViewer(), import('docx-preview')] : [])])
      }
    },
    reset,
    dispose() { disposed = true; reset(false) },
  }
}

export type ViewerSession = ReturnType<typeof createViewerSession>
export const viewerSessionKey: InjectionKey<ViewerSession> = Symbol('document viewer session')
