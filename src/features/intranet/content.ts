export const INTRANET_CONTENT_FILENAME = 'Phase2 intranet content.txt'
export type LibraryCategory = 'SDS' | 'Safety' | 'AHA'
export interface ReadingPair { en: string; es?: string }
export interface IntranetResource {
  id: string; title: string; category: LibraryCategory; kind: string
  keywords: string; filename: string
}
export interface IntranetForm {
  id: string; title: string; paragraphs: string[]
  fields: { label: string; type: string; signature: boolean; required: boolean }[]
}
export interface IntranetContent {
  version: 1
  kind: 'phase2-intranet-content'
  source: { title: string; sha256: string; documentsIncluded: false }
  resources: IntranetResource[]
  forms: IntranetForm[]
  inspections: { id: string; title: string; paragraphs: ReadingPair[] }[]
  orientation: ReadingPair[]
}
const invalid = () => new Error('This file is not a supported Phase 2 intranet content package.')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max = 500, optional = false): string {
  if (optional && value === undefined) return ''
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) throw invalid()
  return value
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw invalid()
  return value
}
function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map(v => v.id)).size !== values.length) throw invalid()
  return values
}
function reading(value: unknown): ReadingPair {
  const row = record(value)
  const en = text(row.en, 10000), es = text(row.es, 10000, true)
  return { en, ...(es ? { es } : {}) }
}
/** Decode data only. Package HTML, scripts, URLs and local paths never become executable UI. */
export function parseIntranetContent(value: unknown): IntranetContent {
  const data = record(value), source = record(data.source)
  if (data.version !== 1 || data.kind !== 'phase2-intranet-content' || source.documentsIncluded !== false)
    throw invalid()
  const sha256 = text(source.sha256, 64)
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw invalid()
  const resources = unique(list(data.resources, 10000).map(value => {
    const row = record(value)
    if (!['SDS', 'Safety', 'AHA'].includes(String(row.category))) throw invalid()
    return {
      id: text(row.id, 200), title: text(row.title, 500),
      category: row.category as LibraryCategory, kind: text(row.kind, 100),
      keywords: text(row.keywords, 2000, true), filename: text(row.filename, 500, true),
    }
  }))
  const forms = unique(list(data.forms, 50).map(value => {
    const row = record(value)
    return {
      id: text(row.id, 200), title: text(row.title, 500),
      paragraphs: list(row.paragraphs, 500).map(p => text(p, 10000)),
      fields: list(row.fields, 200).map(value => {
        const field = record(value)
        return { label: text(field.label, 2000), type: text(field.type, 50),
          signature: field.signature === true, required: field.required === true }
      }),
    }
  }))
  const inspections = unique(list(data.inspections, 20).map(value => {
    const row = record(value)
    return { id: text(row.id, 200), title: text(row.title, 500),
      paragraphs: list(row.paragraphs, 200).map(reading) }
  }))
  return { version: 1, kind: 'phase2-intranet-content',
    source: { title: text(source.title, 200), sha256, documentsIncluded: false },
    resources, forms, inspections, orientation: list(data.orientation, 200).map(reading) }
}
