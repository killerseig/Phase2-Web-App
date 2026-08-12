import {
  DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS,
  getSubmittableDailyLogIndoorClimateReadings,
  getSubmittableDailyLogManpowerLines,
} from '@/features/dailyLogs/schema'
import type { DailyLogPayload } from '@/types/domain'

export function validateDailyLogForSubmit(payload: DailyLogPayload) {
  for (const field of DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS) {
    if (!(payload[field.key] ?? '').trim().length) {
      return `Complete "${field.label}" before submitting.`
    }
  }

  const manpowerLines = getSubmittableDailyLogManpowerLines(payload.manpowerLines)
  const invalidManpowerIndex = manpowerLines.findIndex(
    (line) => !line.trade.trim().length || Math.round(Number(line.count) || 0) < 1,
  )
  if (invalidManpowerIndex !== -1) {
    return `Complete manpower row ${invalidManpowerIndex + 1} before submitting.`
  }

  const indoorClimateReadings = getSubmittableDailyLogIndoorClimateReadings(payload.indoorClimateReadings)
  const invalidClimateIndex = indoorClimateReadings.findIndex(
    (reading) => !reading.area.trim() || !reading.high.trim() || !reading.low.trim() || !reading.humidity.trim(),
  )
  if (invalidClimateIndex !== -1) {
    return `Complete indoor climate row ${invalidClimateIndex + 1} before submitting.`
  }

  return ''
}
