import { sdsCommand } from '@/services/sds'
import type { SdsSelection } from './types'
import type { DocumentExtension } from '@/features/documents/formats'

interface LibraryRecord {
  version: number
  id?: string
  name?: string
  folderId?: string
  parentId?: string
  manufacturer?: string
  productCode?: string
  language?: string
  revisionDate?: string
  order?: number
  archived?: boolean
  uploadId?: string
  uploadExtension?: DocumentExtension
  originalName?: string
}
interface LibraryRequests {
  saveFolder: LibraryRecord
  saveSheet: LibraryRecord
  deleteFolder: { id: string; version: number }
  saveSelection: { jobId: string; version: number; selections: SdsSelection[] }
  openSheet: { id: string; jobId?: string; download?: boolean }
  requestExport: { requestId: string; jobId: string; version: number; printableOnly: boolean }
  exportStatus: { id: string; download?: boolean; link?: boolean }
}
interface LibraryResponses {
  saveFolder: { id: string }
  saveSheet: { id: string }
  deleteFolder: { ok: boolean }
  saveSelection: { ok: boolean }
  openSheet: { url: string; extension?: string; revisionId?: string }
  requestExport: { id: string }
  exportStatus: { status: string; error?: string; pageCount?: number; url?: string }
}
export function libraryCommand<A extends keyof LibraryRequests>(
  action: A,
  data: LibraryRequests[A],
): Promise<LibraryResponses[A]> {
  return sdsCommand<LibraryResponses[A]>(action, { ...data })
}
