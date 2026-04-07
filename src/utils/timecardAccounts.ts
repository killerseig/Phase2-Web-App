import type { TimecardAccountSummaryItem } from '@/types/timecards'
import type { TimecardModel } from '@/utils/timecardUtils'
import {
  buildWorkbookTimecardLines,
  getWorkbookJobHoursTotal,
  getWorkbookJobProductionTotal,
} from '@/utils/timecardWorkbook'

type TimecardAccountJob = NonNullable<TimecardModel['jobs']>[number]

function toNumber(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0
  }
  return value
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

function buildLineKey(jobNumber: string, subsectionArea: string, account: string) {
  return [jobNumber, subsectionArea, account].join('|').toLowerCase()
}

function getJobHoursTotal(job: TimecardAccountJob | undefined): number {
  return toNumber(getWorkbookJobHoursTotal(job))
}

function getJobProductionTotal(job: TimecardAccountJob | undefined): number {
  return toNumber(getWorkbookJobProductionTotal(job))
}

export function buildTimecardAccountsSummary(
  timecards: TimecardModel[],
): TimecardAccountSummaryItem[] {
  const summaryByKey = new Map<string, TimecardAccountSummaryItem>()

  for (const timecard of Array.isArray(timecards) ? timecards : []) {
    for (const job of buildWorkbookTimecardLines(timecard)) {
      const jobNumber = normalizeText(job?.jobNumber)
      const subsectionArea = normalizeText(job?.subsectionArea ?? job?.area)
      const account = normalizeText(job?.account ?? job?.acct)
      const hoursTotal = getJobHoursTotal(job)
      const productionTotal = getJobProductionTotal(job)

      const hasMeaningfulData = Boolean(jobNumber || subsectionArea || account || hoursTotal || productionTotal)
      if (!hasMeaningfulData) continue

      const key = buildLineKey(jobNumber, subsectionArea, account)
      const existing = summaryByKey.get(key)
      if (existing) {
        existing.hoursTotal += hoursTotal
        existing.productionTotal += productionTotal
        continue
      }

      summaryByKey.set(key, {
        key,
        jobNumber,
        subsectionArea,
        account,
        hoursTotal,
        productionTotal,
      })
    }
  }

  return Array.from(summaryByKey.values()).sort((left, right) => (
    left.jobNumber.localeCompare(right.jobNumber)
    || left.subsectionArea.localeCompare(right.subsectionArea)
    || left.account.localeCompare(right.account)
  ))
}
