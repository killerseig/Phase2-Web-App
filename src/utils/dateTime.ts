export function toAppDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    const dateValue = new Date((value as { toMillis: () => number }).toMillis())
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    const dateValue = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const dateValue = new Date(value)
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  return null
}

export function toAppMillis(value: unknown): number {
  return toAppDate(value)?.getTime() ?? 0
}

export function formatAppTimestamp(value: unknown, fallback: string): string {
  const dateValue = toAppDate(value)
  if (!dateValue) return fallback

  return dateValue.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
