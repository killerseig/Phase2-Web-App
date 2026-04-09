import type { Timecard, TimecardDay, TimecardJobEntry, TimecardTotals } from '@/types/models'
import { DEFAULT_PRODUCTION_BURDEN, getProductionMultiplier, TIMECARD_OCCUPATIONS } from '@/constants/timecards'

export type TimecardJobUi = TimecardJobEntry & { difH?: string; difP?: string; difC?: string }

export interface TimecardModel extends Timecard {
  jobs?: TimecardJobUi[]
  totals: TimecardTotals
}

export type TimecardEmployeeEditorForm = {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  employeeWage: string
  subcontractedEmployee: boolean
}

export const DEFAULT_REGULAR_HOURS_CAP = 40
export const TIMECARD_OCCUPATION_OPTIONS = TIMECARD_OCCUPATIONS

function toNonNegativeNumber(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0
  }
  return Math.max(0, value)
}

export function buildWeekDates(start: string): string[] {
  const dates: string[] = []
  const base = new Date(start + 'T00:00:00Z')
  for (let i = 0; i < 7; i++) {
    const date = new Date(base)
    date.setUTCDate(base.getUTCDate() + i)
    const yyyy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
  }
  return dates
}

export function makeDaysArray(start: string): TimecardDay[] {
  return buildWeekDates(start).map((date, idx) => ({
    date,
    dayOfWeek: idx,
    hours: 0,
    production: 0,
    unitCost: 0,
    unitCostOverride: null,
    lineTotal: 0,
    notes: '',
  }))
}

export function parseWage(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function parseSubcontractedEmployee(value: boolean | string): boolean {
  return value === true || value === 'yes'
}

export function parseHoursOverride(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return null
  return parsed
}

export function createEmptyTimecardEmployeeEditorForm(): TimecardEmployeeEditorForm {
  return {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    occupation: '',
    employeeWage: '',
    subcontractedEmployee: false,
  }
}

export function calculateUnitCost(
  employeeWage: number | null | undefined,
  hours: number | null | undefined,
  production: number | null | undefined,
  productionBurden: number | null | undefined = DEFAULT_PRODUCTION_BURDEN,
): number {
  const wageValue = toNonNegativeNumber(employeeWage)
  const hourValue = toNonNegativeNumber(hours)
  const productionValue = toNonNegativeNumber(production)
  const multiplierValue = toNonNegativeNumber(getProductionMultiplier(productionBurden))

  if (wageValue <= 0 || hourValue <= 0 || productionValue <= 0 || multiplierValue <= 0) {
    return 0
  }

  return (hourValue * wageValue * multiplierValue) / productionValue
}

export function calculateRegularAndOvertimeHours(
  totalHours: number | null | undefined,
  regularHoursOverride: number | null | undefined,
  overtimeHoursOverride: number | null | undefined,
  regularHoursCap = DEFAULT_REGULAR_HOURS_CAP
): { regularHours: number; overtimeHours: number } {
  const total = toNonNegativeNumber(totalHours)
  const safeCap = toNonNegativeNumber(regularHoursCap)

  const computedRegular = Math.min(total, safeCap)
  const computedOvertime = Math.max(total - safeCap, 0)

  return {
    regularHours: regularHoursOverride == null ? computedRegular : toNonNegativeNumber(regularHoursOverride),
    overtimeHours: overtimeHoursOverride == null ? computedOvertime : toNonNegativeNumber(overtimeHoursOverride),
  }
}

export function getTimecardFirstName(timecard: TimecardModel): string {
  if (timecard.firstName?.trim()) return timecard.firstName.trim()
  const [first] = (timecard.employeeName || '').trim().split(/\s+/)
  return first || ''
}

export function getTimecardLastName(timecard: TimecardModel): string {
  if (timecard.lastName?.trim()) return timecard.lastName.trim()
  const [, ...rest] = (timecard.employeeName || '').trim().split(/\s+/)
  return rest.join(' ')
}

export function getTimecardDisplayName(timecard: TimecardModel): string {
  const first = getTimecardFirstName(timecard)
  const last = getTimecardLastName(timecard)
  return `${first} ${last}`.trim() || timecard.employeeName || 'Unnamed Employee'
}

export function buildTimecardEmployeeEditorForm(timecard: TimecardModel): TimecardEmployeeEditorForm {
  return {
    employeeNumber: timecard.employeeNumber,
    firstName: getTimecardFirstName(timecard),
    lastName: getTimecardLastName(timecard),
    occupation: timecard.occupation,
    employeeWage: timecard.employeeWage != null ? String(timecard.employeeWage) : '',
    subcontractedEmployee: !!timecard.subcontractedEmployee,
  }
}

export function recalcTotalsForTimecard(timecard: TimecardModel, weekStartDate: string): void {
  const hours: number[] = Array(7).fill(0)
  const production: number[] = Array(7).fill(0)
  const lineTotals: number[] = Array(7).fill(0)
  const employeeWage = toNonNegativeNumber(timecard.employeeWage)
  const productionBurden = timecard.productionBurden ?? DEFAULT_PRODUCTION_BURDEN

  timecard.jobs?.forEach((job) => {
    job.days?.forEach((day, idx) => {
      if (idx < 0 || idx >= hours.length) return
      const dayHours = toNonNegativeNumber(day.hours)
      const dayProduction = toNonNegativeNumber(day.production)
      const overrideUnitCost = day.unitCostOverride == null
        ? null
        : toNonNegativeNumber(day.unitCostOverride)
      const dayUnitCost = overrideUnitCost == null || Number.isNaN(overrideUnitCost)
        ? calculateUnitCost(employeeWage, dayHours, dayProduction, productionBurden)
        : overrideUnitCost
      const dayLineTotal = dayProduction * dayUnitCost

      day.hours = dayHours
      day.production = dayProduction
      day.unitCost = dayUnitCost
      day.lineTotal = dayLineTotal

      hours[idx] = (hours[idx] ?? 0) + dayHours
      production[idx] = (production[idx] ?? 0) + dayProduction
      lineTotals[idx] = (lineTotals[idx] ?? 0) + dayLineTotal
    })
  })

  const dates = buildWeekDates(weekStartDate)
  timecard.days = dates.map((date, idx) => ({
    date,
    dayOfWeek: idx,
    hours: hours[idx] ?? 0,
    production: production[idx] ?? 0,
    unitCost: 0,
    unitCostOverride: null,
    lineTotal: lineTotals[idx] ?? 0,
    notes: timecard.days?.[idx]?.notes ?? '',
  }))

  timecard.totals = {
    hours,
    production,
    hoursTotal: hours.reduce((sum, h) => sum + h, 0),
    productionTotal: production.reduce((sum, p) => sum + p, 0),
    lineTotal: lineTotals.reduce((sum, v) => sum + v, 0),
  }
}
