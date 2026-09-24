import { HttpsError } from 'firebase-functions/v2/https'
import type { CurrentFunctionUser } from './roleAccess'
import { isFunctionShopJob } from './jobIdentity'
import { targetFunctionRoleCanSeeJobListEntry } from './targetJobAccess'

export interface SdsFolder {
  id: string
  name: string
  parentId: string
  order: number
}
export interface SdsSheet {
  id: string
  name: string
  manufacturer: string
  productCode: string
  language: string
  folderId: string
  order: number
  revisionId: string
  revisionDate: string
  archived: boolean
  extension?: string
  mimeType?: string
  originalName?: string
  size?: number
}
export interface SdsSelection {
  documentId: string
  revisionId: string
}
export interface SdsBookEntry {
  documentId: string
  revisionId: string
  title: string
  manufacturer: string
  revisionDate: string
  folders: string[]
  filePath: string
  extension?: string
}

export function sdsCanAccessJob(
  user: CurrentFunctionUser,
  jobId: string,
  job: Record<string, unknown>,
) {
  const assignedJobIds = [...user.assignedJobIds]
  if (Array.isArray(job.assignedForemanIds) && job.assignedForemanIds.includes(user.uid))
    assignedJobIds.push(jobId)
  return (
    user.active &&
    targetFunctionRoleCanSeeJobListEntry({
      role: user.role,
      jobId,
      assignedJobIds,
      isShopJob: isFunctionShopJob({ name: job.name, number: job.code ?? job.number }),
    })
  )
}

export function sdsId(value: unknown, optional = false): string {
  if (optional && (value === '' || value === undefined || value === null)) return ''
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Invalid record identifier.')
  }
  return value
}

export function sdsText(value: unknown, label: string, max = 200, required = false): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new HttpsError(
      'invalid-argument',
      `${label} must be ${required ? 'provided and ' : ''}at most ${max} characters.`,
    )
  }
  return value.trim()
}

export function folderPath(id: string, folders: readonly SdsFolder[]): SdsFolder[] {
  const result: SdsFolder[] = []
  const seen = new Set<string>()
  let next = id
  while (next) {
    const folder = folders.find((entry) => entry.id === next)
    if (!folder || seen.has(next) || result.length >= 8) {
      throw new HttpsError(
        'failed-precondition',
        'Folder structure is invalid or deeper than eight levels.',
      )
    }
    result.unshift(folder)
    seen.add(next)
    next = folder.parentId
  }
  return result
}

export function orderedSheets(
  sheets: readonly SdsSheet[],
  folders: readonly SdsFolder[],
): SdsSheet[] {
  const compare = (
    a: { order: number; name: string; id: string },
    b: { order: number; name: string; id: string },
  ) => a.order - b.order || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id)
  // Folders precede sheets at each level, matching the explorer.
  const result: SdsSheet[] = []
  const visit = (parentId: string) => {
    folders
      .filter((f) => f.parentId === parentId)
      .sort(compare)
      .forEach((f) => visit(f.id))
    result.push(...sheets.filter((s) => s.folderId === parentId).sort(compare))
  }
  folders.forEach((f) => folderPath(f.id, folders))
  sheets.forEach((s) => folderPath(s.folderId, folders))
  visit('')
  return result
}

export function validateSelections(value: unknown): SdsSelection[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new HttpsError('invalid-argument', 'Select at most 1,000 sheets.')
  const seen = new Set<string>()
  return value.map((entry) => {
    const documentId = sdsId(entry?.documentId)
    const revisionId = sdsId(entry?.revisionId)
    if (seen.has(documentId))
      throw new HttpsError('invalid-argument', 'A sheet was selected more than once.')
    seen.add(documentId)
    return { documentId, revisionId }
  })
}
