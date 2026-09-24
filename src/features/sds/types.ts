export interface ExplorerFolder {
  id: string
  name: string
  parentId: string
  order: number
}
export interface ExplorerDocument {
  id: string
  name: string
  folderId: string
  order: number
}
export interface SdsSheet extends ExplorerDocument {
  manufacturer: string
  productCode: string
  language: string
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
export interface SdsLibrary {
  version: number
  folders: ExplorerFolder[]
  sheets: SdsSheet[]
  binder: { version: number; selections: SdsSelection[] }
  exportId?: string
}
export interface RoleResource {
  id: string
  title: string
  description: string
  url: string
}

export function folderAncestors(id: string, folders: readonly ExplorerFolder[]): ExplorerFolder[] {
  const result: ExplorerFolder[] = []
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const folder = folders.find((f) => f.id === id)
    if (!folder) break
    result.unshift(folder)
    id = folder.parentId
  }
  return result
}
export function inFolder(
  document: ExplorerDocument,
  folderId: string,
  folders: readonly ExplorerFolder[],
) {
  return (
    !folderId ||
    document.folderId === folderId ||
    folderAncestors(document.folderId, folders).some((f) => f.id === folderId)
  )
}
export function explorerCompare(
  a: ExplorerDocument | ExplorerFolder,
  b: ExplorerDocument | ExplorerFolder,
) {
  return a.order - b.order || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id)
}
export function visibleFolders(
  documents: readonly ExplorerDocument[],
  folders: readonly ExplorerFolder[],
) {
  const ids = new Set(
    documents.flatMap((d) => folderAncestors(d.folderId, folders).map((f) => f.id)),
  )
  return folders.filter((f) => ids.has(f.id))
}
