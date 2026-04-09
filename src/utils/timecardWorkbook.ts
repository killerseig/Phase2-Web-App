import type { JobRosterEmployee, TimecardInput } from '@/types/models'
import {
  calculateUnitCost,
  type TimecardJobUi,
} from '@/utils/timecardUtils'
import { DEFAULT_PRODUCTION_BURDEN } from '@/constants/timecards'
import { calculateWeekStartDate } from '@/utils/modelValidation'
import { makeDaysArray, type TimecardModel } from '@/utils/timecardUtils'

export const TIMECARD_WORKBOOK_LINE_COUNT = 13
export const TIMECARD_WORKBOOK_DAY_INDEXES = [1, 2, 3, 4, 5, 6] as const
export const TIMECARD_WORKBOOK_DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export function createEmptyWorkbookTimecardLine(weekStartDate: string): TimecardJobUi {
  return {
    jobNumber: '',
    subsectionArea: '',
    area: '',
    account: '',
    acct: '',
    costCode: '',
    div: '',
    difH: '',
    difP: '',
    difC: '',
    offHours: 0,
    offProduction: 0,
    offCost: 0,
    days: makeDaysArray(weekStartDate),
  }
}

export function createWorkbookTimecardLines(
  weekStartDate: string,
  lineCount = TIMECARD_WORKBOOK_LINE_COUNT,
): TimecardJobUi[] {
  return Array.from({ length: lineCount }, () => createEmptyWorkbookTimecardLine(weekStartDate))
}

function normalizeWorkbookDays(
  weekStartDate: string,
  days: TimecardJobUi['days'],
) {
  const templateDays = makeDaysArray(weekStartDate)

  for (const day of Array.isArray(days) ? days : []) {
    const dayOfWeek = Number(day?.dayOfWeek)
    const fallbackIndex = Array.isArray(days) ? days.indexOf(day) : -1
    const targetIndex = Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek < templateDays.length
      ? dayOfWeek
      : fallbackIndex

    if (targetIndex < 0 || targetIndex >= templateDays.length) continue

    templateDays[targetIndex] = {
      ...templateDays[targetIndex],
      ...day,
      dayOfWeek: targetIndex,
    }
  }

  return templateDays
}

export function ensureWorkbookTimecardLines(
  timecard: Pick<TimecardModel, 'weekStartDate' | 'jobs'>,
  lineCount = TIMECARD_WORKBOOK_LINE_COUNT,
): TimecardJobUi[] {
  const nextLines = buildWorkbookTimecardLines(timecard, lineCount)

  if (Array.isArray(timecard.jobs)) {
    timecard.jobs = nextLines
  }

  return nextLines
}

export function buildWorkbookTimecardLines(
  timecard: Pick<TimecardModel, 'weekStartDate' | 'jobs'>,
  lineCount = TIMECARD_WORKBOOK_LINE_COUNT,
): TimecardJobUi[] {
  const weekStartDate = String(timecard.weekStartDate || '').trim()
  const existingLines = Array.isArray(timecard.jobs) ? timecard.jobs.slice(0, lineCount) : []
  const nextLines: TimecardJobUi[] = existingLines.map((line): TimecardJobUi => ({
    ...createEmptyWorkbookTimecardLine(weekStartDate),
    ...line,
    subsectionArea: line?.subsectionArea ?? line?.area ?? '',
    area: line?.area ?? line?.subsectionArea ?? '',
    account: line?.account ?? line?.acct ?? '',
    acct: line?.acct ?? line?.account ?? '',
    days: normalizeWorkbookDays(weekStartDate, line?.days),
  }))

  while (nextLines.length < lineCount) {
    nextLines.push(createEmptyWorkbookTimecardLine(weekStartDate))
  }

  return nextLines
}

export function getWorkbookJobHoursTotal(job: Pick<TimecardJobUi, 'days'> | null | undefined): number {
  return TIMECARD_WORKBOOK_DAY_INDEXES.reduce((sum, dayIndex) => (
    sum + Number(job?.days?.[dayIndex]?.hours ?? 0)
  ), 0)
}

export function getWorkbookJobProductionTotal(job: Pick<TimecardJobUi, 'days'> | null | undefined): number {
  return TIMECARD_WORKBOOK_DAY_INDEXES.reduce((sum, dayIndex) => (
    sum + Number(job?.days?.[dayIndex]?.production ?? 0)
  ), 0)
}

export function getWorkbookJobCostTotal(job: Pick<TimecardJobUi, 'days'> | null | undefined): number {
  return TIMECARD_WORKBOOK_DAY_INDEXES.reduce((sum, dayIndex) => (
    sum + Number(job?.days?.[dayIndex]?.unitCost ?? 0)
  ), 0)
}

export function getWorkbookWeekHoursByDay(timecard: Pick<TimecardModel, 'jobs'>): number[] {
  return TIMECARD_WORKBOOK_DAY_INDEXES.map((dayIndex) => (
    (Array.isArray(timecard.jobs) ? timecard.jobs : []).reduce((sum, job) => (
      sum + Number(job?.days?.[dayIndex]?.hours ?? 0)
    ), 0)
  ))
}

export function getWorkbookWeekHoursTotal(timecard: Pick<TimecardModel, 'jobs'>): number {
  return getWorkbookWeekHoursByDay(timecard).reduce((sum, value) => sum + value, 0)
}

export function calculateWorkbookSummaryCost(
  employeeWage: number | null | undefined,
  totalHours: number,
  totalProduction: number,
  productionBurden: number | null | undefined = DEFAULT_PRODUCTION_BURDEN,
): number {
  return calculateUnitCost(employeeWage, totalHours, totalProduction, productionBurden)
}

export function getWorkbookJobSummaryCost(
  employeeWage: number | null | undefined,
  productionBurden: number | null | undefined,
  job: Pick<TimecardJobUi, 'days'> | null | undefined,
): number {
  return calculateWorkbookSummaryCost(
    employeeWage,
    getWorkbookJobHoursTotal(job),
    getWorkbookJobProductionTotal(job),
    productionBurden ?? DEFAULT_PRODUCTION_BURDEN,
  )
}

export function buildTimecardInputFromRosterEmployee(
  employee: JobRosterEmployee,
  weekEndingDate: string,
  productionBurden = DEFAULT_PRODUCTION_BURDEN,
): TimecardInput {
  const weekStartDate = calculateWeekStartDate(weekEndingDate)
  const employeeName = `${employee.firstName} ${employee.lastName}`.trim()

  return {
    weekEndingDate,
    employeeRosterId: employee.id,
    employeeNumber: employee.employeeNumber,
    employeeName,
    firstName: employee.firstName,
    lastName: employee.lastName,
    occupation: employee.occupation,
    employeeWage: employee.wageRate ?? null,
    productionBurden,
    subcontractedEmployee: !!employee.contractor,
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    footerJobOrGl: '',
    footerAccount: '',
    footerOffice: '',
    footerAmount: '',
    jobs: createWorkbookTimecardLines(weekStartDate),
    days: makeDaysArray(weekStartDate),
    notes: '',
  }
}

export function matchesRosterEmployeeTimecard(
  employee: Pick<JobRosterEmployee, 'id' | 'employeeNumber'>,
  timecard: Pick<TimecardInput, 'employeeRosterId' | 'employeeNumber'>,
): boolean {
  const rosterId = String(employee.id || '').trim()
  const employeeNumber = String(employee.employeeNumber || '').trim()
  const timecardRosterId = String(timecard.employeeRosterId || '').trim()
  const timecardEmployeeNumber = String(timecard.employeeNumber || '').trim()

  if (rosterId && timecardRosterId && rosterId === timecardRosterId) return true
  if (!timecardRosterId && employeeNumber && employeeNumber === timecardEmployeeNumber) return true
  return false
}
