export interface DailyLogRouteSelection {
  date: string | null
  logId: string | null
}

function getQueryText(value: unknown): string {
  const scalarValue = Array.isArray(value) ? value[0] : value
  return typeof scalarValue === 'string' ? scalarValue.trim() : ''
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function getDailyLogRouteSelection(
  query: Record<string, unknown>,
): DailyLogRouteSelection {
  const date = getQueryText(query.date)
  const logId = getQueryText(query.logId)

  return {
    date: isValidIsoDate(date) ? date : null,
    logId: logId || null,
  }
}
