import type { DailyLogRecord } from '@/types/domain'

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function formatDailyLogTimestamp(value: unknown) {
  const millis = toMillis(value)
  if (!millis) return 'Unknown time'

  return new Date(millis).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function getDailyLogLabel(log: DailyLogRecord | null) {
  if (!log) return 'No log selected'
  return `${log.status === 'submitted' ? 'Submitted' : 'Draft'} #${log.sequenceNumber}`
}

export function getDailyLogTimestampLabel(log: DailyLogRecord) {
  return formatDailyLogTimestamp(log.submittedAt || log.updatedAt || log.createdAt)
}
