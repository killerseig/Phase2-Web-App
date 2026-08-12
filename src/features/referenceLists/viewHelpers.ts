export type ReferenceListKey = 'job-types' | 'gcs' | 'occupations'

export function normalizeReferenceListKey(value: unknown): ReferenceListKey {
  if (value === 'job-types' || value === 'gcs' || value === 'occupations') return value
  return 'occupations'
}

export function getReferenceListTitle(value: unknown) {
  const key = normalizeReferenceListKey(value)
  if (key === 'job-types') return 'Job Types'
  if (key === 'gcs') return 'GCs'
  return 'Occupations'
}
