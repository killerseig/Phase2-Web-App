type TimestampLike = {
  toMillis?: () => number
  toDate?: () => unknown
}

export function asDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === 'object') {
    const tsLike = value as TimestampLike
    if (typeof tsLike.toDate === 'function') {
      return asDate(tsLike.toDate())
    }
  }

  return null
}

export function toMillis(value: unknown): number {
  if (!value) return 0
  if (typeof value === 'number') return value

  if (typeof value === 'object') {
    const tsLike = value as TimestampLike
    if (typeof tsLike.toMillis === 'function') {
      return tsLike.toMillis()
    }
  }

  const date = asDate(value)
  return date ? date.getTime() : 0
}

export function formatDateTime(value: unknown): string {
  const date = asDate(value)
  return date ? date.toLocaleString() : ''
}
