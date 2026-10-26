import type { WebsiteComparison } from '../../../functions/src/websiteChanges'
import type { WebsiteAsset, WebsiteSite, WebsiteState } from './types'

export interface WebsiteRequests {
  load: undefined
  save: { version: number; site: WebsiteSite }
  publish: { version: number }
  unpublish: { version: number }
  restore: { version: number }
  restoreRevision: { version: number; revisionId: string | undefined }
  comparePublished: { version: number; site: WebsiteSite }
  getRevision: { revisionId: string }
  listRevisions: undefined
  listImages: { cursor?: string } | undefined
  getImage: { id: string; thumbnail?: boolean }
  uploadImage: { base64: string; name: string }
}
export interface WebsiteMutationResult {
  version: number
  draft?: WebsiteSite
  publishedAt?: number | null
  hasPrevious?: boolean
}
export interface WebsiteResponses {
  load: WebsiteState
  save: WebsiteMutationResult
  publish: WebsiteMutationResult
  unpublish: WebsiteMutationResult
  restore: WebsiteMutationResult
  restoreRevision: WebsiteMutationResult
  comparePublished: WebsiteComparison & { publishedAt: number | null }
  getRevision: { draft: WebsiteSite }
  listRevisions: {
    revisions: { id: string; version: number; savedAt: number; name: string; savedBy?: string }[]
    activity: {
      id: string
      version: number
      savedAt: number
      savedBy: string
      action: string
      total?: number
      paths?: string[]
      source?: string
    }[]
  }
  listImages: { images: WebsiteAsset[]; nextCursor: string | null }
  getImage: { id: string; base64: string }
  uploadImage: { id: string; base64: string }
}
