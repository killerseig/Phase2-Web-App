import { HttpsError } from 'firebase-functions/v2/https'

export const SDS_MASTER_CAPACITY = 10000
export interface SdsImportRow {
  path: string
  size: number
  sha256: string
  name: string
  manufacturer: string
  productCode: string
  revisionDate: string
  language: string
  provenance: string
}
export function importPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000 || !value.trim())
    throw new HttpsError('invalid-argument', 'Provide a relative source path.')
  const path = value.replace(/\\/g, '/')
  if (
    path.startsWith('/') ||
    /[\x00-\x1f:]/.test(path) ||
    path.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw new HttpsError('invalid-argument', 'Source paths must be relative without traversal.')
  return path
}
export function validateImportIndex(value: unknown): SdsImportRow[] {
  const index = value as { version?: unknown; files?: unknown }
  if (
    !index ||
    index.version !== 1 ||
    !Array.isArray(index.files) ||
    !index.files.length ||
    index.files.length > SDS_MASTER_CAPACITY
  )
    throw new HttpsError('invalid-argument', 'Use index version 1 with 1–10,000 files.')
  const seen = new Set<string>()
  return index.files.map((raw) => {
    const row = raw as Record<string, unknown>
    const path = importPath(row?.path)
    if (seen.has(path.toLowerCase()))
      throw new HttpsError('invalid-argument', 'Source paths must be unique.')
    seen.add(path.toLowerCase())
    if (
      !path.toLowerCase().endsWith('.pdf') ||
      !Number.isSafeInteger(row.size) ||
      Number(row.size) < 1 ||
      Number(row.size) > 20 * 1024 * 1024 ||
      typeof row.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(row.sha256)
    )
      throw new HttpsError('invalid-argument', 'Each PDF needs its exact size and SHA-256 hash.')
    const text = (key: string, maximum: number, required = false) => {
      const value = row[key] ?? ''
      if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim()))
        throw new HttpsError('invalid-argument', `Invalid ${key} in ${path}.`)
      return value.trim()
    }
    const revisionDate = text('revisionDate', 10)
    if (
      revisionDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate) ||
        !Number.isFinite(Date.parse(revisionDate)) ||
        new Date(revisionDate).toISOString().slice(0, 10) !== revisionDate)
    )
      throw new HttpsError('invalid-argument', 'Invalid revision date.')
    return {
      path,
      size: Number(row.size),
      sha256: row.sha256.toLowerCase(),
      name: text('name', 160, true),
      manufacturer: text('manufacturer', 160),
      productCode: text('productCode', 100),
      language: text('language', 40, true),
      revisionDate,
      provenance: text('provenance', 1000),
    }
  })
}
export function checkImportBytes(
  bytes: Buffer,
  checksum: string,
  expectedSize: unknown,
  expectedHash: unknown,
) {
  if (
    expectedSize !== undefined &&
    (!Number.isSafeInteger(expectedSize) || Number(expectedSize) !== bytes.length)
  )
    throw new HttpsError('invalid-argument', 'Uploaded bytes do not match the index size.')
  if (
    expectedHash !== undefined &&
    (typeof expectedHash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(expectedHash) ||
      expectedHash.toLowerCase() !== checksum)
  )
    throw new HttpsError('invalid-argument', 'Uploaded bytes do not match the index SHA-256 hash.')
}
