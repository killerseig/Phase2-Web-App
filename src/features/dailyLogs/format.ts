import type { DailyLogRecord } from '@/types/domain'
import { formatAppTimestamp } from '@/utils/dateTime'

export function formatDailyLogTimestamp(value: unknown) {
  return formatAppTimestamp(value, 'Unknown time')
}

export function getDailyLogStatusLabel(log: DailyLogRecord | null | undefined) {
  return log?.status === 'submitted' ? 'Submitted' : 'Draft'
}

export function getDailyLogLabel(log: DailyLogRecord | null) {
  if (!log) return 'No log selected'
  return `${getDailyLogStatusLabel(log)} #${log.sequenceNumber}`
}

export function getDailyLogTimestampLabel(log: DailyLogRecord) {
  return formatDailyLogTimestamp(log.submittedAt || log.updatedAt || log.createdAt)
}
