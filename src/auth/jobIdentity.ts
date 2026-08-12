export interface JobIdentitySource {
  code?: unknown
  name?: unknown
  number?: unknown
}

function normalizeJobIdentityValue(value: unknown): string {
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).toLowerCase()
  return ''
}

export function isShopJobRecord(job: JobIdentitySource | null | undefined): boolean {
  if (!job) return false

  return normalizeJobIdentityValue(job.code) === '736'
    || normalizeJobIdentityValue(job.number) === '736'
    || normalizeJobIdentityValue(job.name) === 'shop'
}
