export interface FunctionJobIdentity {
  code?: unknown
  name?: unknown
  number?: unknown
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

export function isFunctionShopJob(job: FunctionJobIdentity | null | undefined): boolean {
  const jobCode = text(job?.code).toLowerCase()
  const jobNumber = text(job?.number).toLowerCase()
  const jobName = text(job?.name).toLowerCase()

  return jobCode === '736' || jobNumber === '736' || jobName === 'shop'
}
