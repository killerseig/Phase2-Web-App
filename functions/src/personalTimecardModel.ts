import { createHash } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'

export interface PersonalTimecardLine {
  jobNumber: string
  subsectionArea: string
  account: string
  hours: number[]
}
export interface PersonalTimecardInput {
  lines: PersonalTimecardLine[]
  notes: string
}
export interface PersonalPayrollDay {
  hours: number
  production: number
  unitCost: number
  unitCostOverride?: number | null
  lineTotal: number
}
export interface PersonalPayrollLine {
  jobNumber: string
  subsectionArea: string
  account: string
  days: PersonalPayrollDay[]
}
export interface PersonalPayrollCard {
  lines: PersonalPayrollLine[]
  wageRate: number | null
  notes: string
  firstName?: string
  lastName?: string
  lastPersonalSave?: { uid: string; requestId: string; hash: string }
  totals: {
    hoursByDay: number[]
    productionByDay: number[]
    hoursTotal: number
    productionTotal: number
    lineTotal: number
  }
}
export const PERSONAL_TIMECARD_ROLES = [
  'admin',
  'foreman',
  'shop-foreman',
  'project-manager',
] as const
export function parsePersonalTimecard(value: unknown): PersonalTimecardInput {
  const input = value as Partial<PersonalTimecardInput> | null
  if (
    !input ||
    !Array.isArray(input.lines) ||
    input.lines.length !== 13 ||
    typeof input.notes !== 'string' ||
    input.notes.length > 4000
  ) {
    throw new HttpsError('invalid-argument', 'A complete timecard with 13 job lines is required.')
  }
  const lines = input.lines.map((line) => {
    if (
      !line ||
      !Array.isArray(line.hours) ||
      line.hours.length !== 7 ||
      line.hours.some((h) => typeof h !== 'number' || !Number.isFinite(h) || h < 0 || h > 24)
    ) {
      throw new HttpsError('invalid-argument', 'Enter between 0 and 24 hours for each day.')
    }
    const fields = ['jobNumber', 'subsectionArea', 'account'] as const
    for (const key of fields)
      if (typeof line[key] !== 'string' || line[key].length > 120)
        throw new HttpsError('invalid-argument', 'Invalid job or account details.')
    if (line.hours.some((h) => h > 0) && (!line.jobNumber.trim() || !line.account.trim()))
      throw new HttpsError(
        'invalid-argument',
        'Each line with hours needs a job number and account.',
      )
    return {
      jobNumber: line.jobNumber.trim(),
      subsectionArea: line.subsectionArea.trim(),
      account: line.account.trim(),
      hours: [...line.hours],
    }
  })
  for (let day = 0; day < 7; day++)
    if (lines.reduce((sum, line) => sum + line.hours[day]!, 0) > 24)
      throw new HttpsError(
        'invalid-argument',
        'Total hours across jobs cannot exceed 24 in one day.',
      )
  return { lines, notes: input.notes }
}
export function personalSaveHash(input: PersonalTimecardInput) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}
export function personalCardId(employeeId: string) {
  return 'personal-' + createHash('sha256').update(employeeId).digest('hex').slice(0, 32)
}

// Preserve payroll-owned identity, production, wage, overrides and footer fields.
// Recompute the existing workbook cost formula only where entered hours changed.
export function mergePersonalTimecard<T extends PersonalPayrollCard>(
  source: T,
  input: PersonalTimecardInput,
  burden = 0.33,
) {
  burden = Number.isFinite(burden) ? Math.max(0, burden) : 0.33
  const result = structuredClone(source)
  result.notes = input.notes
  const hoursByDay = Array<number>(7).fill(0),
    productionByDay = Array<number>(7).fill(0)
  let totalCost = 0
  result.lines = input.lines.map((line, index) => {
    const old = source.lines[index]
    if (!old) throw new HttpsError('failed-precondition', 'Payroll must review this incomplete legacy card.')
    const days = line.hours.map((hours, dayIndex) => {
      const previous = old.days[dayIndex]
      if (!previous) throw new HttpsError('failed-precondition', 'Payroll must review this incomplete legacy card.')
      const day: PersonalPayrollDay = { ...previous, hours }
      const production = Number(day.production) || 0
      const override = day.unitCostOverride
      if (hours !== Number(previous.hours)) {
        const legacy = [0, 0.294, 0.33].some((value) => Math.abs(value - burden) < 0.000001)
        const multiplier = legacy ? (index === 2 && dayIndex === 6 ? 1.5 : 1.294) : 1 + burden
        day.unitCost =
          override != null
            ? Number(override)
            : production > 0
              ? (hours * (Number(source.wageRate) || 0) * multiplier) / production
              : 0
        day.lineTotal = production * day.unitCost
      }
      hoursByDay[dayIndex]! += hours
      productionByDay[dayIndex]! += production
      totalCost += Number(day.lineTotal) || 0
      return day
    })
    return {
      ...old,
      jobNumber: line.jobNumber,
      subsectionArea: line.subsectionArea,
      account: line.account,
      days,
    }
  })
  result.totals = {
    hoursByDay,
    productionByDay,
    hoursTotal: hoursByDay.reduce((a, b) => a + b, 0),
    productionTotal: productionByDay.reduce((a, b) => a + b, 0),
    lineTotal: totalCost,
  }
  return result
}
