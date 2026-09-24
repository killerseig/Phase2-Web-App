export const documentMime = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const
export type DocumentExtension = keyof typeof documentMime
export const documentAccept = Object.keys(documentMime)
  .map((extension) => `.${extension}`)
  .join(',')
export const documentFormatsLabel = 'PDF, JPG, PNG, WebP, TXT, CSV, DOCX or XLSX'
export function uploadExtension(file: File): DocumentExtension {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!Object.prototype.hasOwnProperty.call(documentMime, extension))
    throw new Error(`Choose a ${documentFormatsLabel} file.`)
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error('Choose a non-empty file no larger than 20 MB.')
  if (['txt', 'csv'].includes(extension) && file.size > 2 * 1024 * 1024)
    throw new Error('Text and CSV files must be no larger than 2 MB.')
  return extension as DocumentExtension
}
export function printableFile(extension = 'pdf') {
  return ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)
}
export function previewFileUrl(url: string) {
  return `/sds-file?ticket=${encodeURIComponent(new URL(url).searchParams.get('ticket') ?? '')}`
}
export interface TablePreview {
  name: string
  rows: string[][]
  truncated: boolean
}
export type FilePreview = { text: string; truncated: boolean } | { tables: TablePreview[] }
