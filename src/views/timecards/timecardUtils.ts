import type { Timecard, TimecardDay, TimecardJobEntry, TimecardTotals } from '@/types/models'

export type TimecardJobUi = TimecardJobEntry & { difH?: string; difP?: string; difC?: string }

export interface TimecardModel extends Timecard {
  jobs?: TimecardJobUi[]
  totals: TimecardTotals
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

export function recalcTotalsForTimecard(timecard: TimecardModel, weekStartDate: string): void {
  const hours: number[] = Array(7).fill(0)
  const production: number[] = Array(7).fill(0)
  const lineTotals: number[] = Array(7).fill(0)

  timecard.jobs?.forEach((job) => {
    job.days?.forEach((day, idx) => {
      hours[idx] += day.hours || 0
      production[idx] += day.production || 0
      lineTotals[idx] += (day.production || 0) * (day.unitCost || 0)
    })
  })

  const dates = buildWeekDates(weekStartDate)
  timecard.days = dates.map((date, idx) => ({
    date,
    dayOfWeek: idx,
    hours: hours[idx],
    production: production[idx],
    unitCost: 0,
    lineTotal: lineTotals[idx],
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
