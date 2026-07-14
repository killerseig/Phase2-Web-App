import type { TimecardCardRecord, TimecardWorkbookLineRecord } from '@/types/domain'
import {
  buildCardDisplayName,
  calculateLineSummaryUnitCost,
} from './workbook'

export const TIMECARD_LINE_ROW_KINDS = [
  { key: 'hours', label: 'H', diffField: 'difH' },
  { key: 'production', label: 'P', diffField: 'difP' },
  { key: 'cost', label: 'C', diffField: 'difC' },
] as const

export type TimecardLineRowKind = (typeof TIMECARD_LINE_ROW_KINDS)[number]['key']
export type TimecardLineOffField = 'offHours' | 'offProduction' | 'offCost'
export type TimecardLineDayField = 'hours' | 'production' | 'unitCostOverride'
export type TimecardNumericDraftResult =
  | { kind: 'empty' }
  | { kind: 'incomplete' }
  | { kind: 'invalid' }
  | { kind: 'value'; value: number }

export function formatTimecardWeekEnding(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}

export function formatTimecardEmployeeHeaderName(
  card: Pick<TimecardCardRecord, 'fullName' | 'firstName' | 'lastName' | 'employeeNumber'>,
) {
  const firstName = card.firstName.trim()
  const lastName = card.lastName.trim()
  if (lastName && firstName) return `${lastName}, ${firstName}`
  if (lastName || firstName) return lastName || firstName
  return card.fullName.trim() || buildCardDisplayName(card)
}

export function formatTimecardCurrency(value: number | null | undefined) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return ''
  return `$${safe.toFixed(2)}`
}

export function formatMaskedTimecardWage() {
  return '----'
}

export function formatTimecardHours(value: number | null | undefined, blankWhenZero = false) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return blankWhenZero ? '' : '0.0'
  if (blankWhenZero && safe === 0) return ''
  return safe.toFixed(1)
}

export function formatTimecardFixedNumber(value: number | null | undefined, decimals = 2, blankWhenZero = false) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return blankWhenZero ? '' : (0).toFixed(decimals)
  if (blankWhenZero && safe === 0) return ''
  return safe.toFixed(decimals)
}

export function formatTimecardTrimmedNumber(value: number | null | undefined, decimals = 2, blankWhenZero = false) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return blankWhenZero ? '' : (0).toFixed(decimals)
  if (blankWhenZero && safe === 0) return ''
  return safe.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

export function parseTimecardNumber(value: string) {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

export function parseNullableTimecardNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
  return Math.max(0, parsed)
}

export function sanitizeTimecardWageInputValue(value: string) {
  return value.replace(/[^0-9.,]/g, '')
}

export function parseTimecardNumericDraft(value: string): TimecardNumericDraftResult {
  const trimmed = value.trim().replace(/[$,]/g, '')
  if (!trimmed) return { kind: 'empty' }
  if (trimmed === '.' || /^\d+\.$/.test(trimmed)) return { kind: 'incomplete' }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return { kind: 'invalid' }

  return {
    kind: 'value',
    value: Math.max(0, parsed),
  }
}

export function getTimecardLineHoursTotal(line: Pick<TimecardWorkbookLineRecord, 'days'> | null | undefined) {
  return line?.days.reduce((sum, day) => sum + Number(day.hours ?? 0), 0) ?? 0
}

export function getTimecardLineProductionTotal(line: Pick<TimecardWorkbookLineRecord, 'days'> | null | undefined) {
  return line?.days.reduce((sum, day) => sum + Number(day.production ?? 0), 0) ?? 0
}

export function getTimecardLineSummaryCost(
  line: TimecardWorkbookLineRecord | null | undefined,
  wageRate: number | null | undefined,
  burden: number | null | undefined,
) {
  if (!line) return 0
  return calculateLineSummaryUnitCost(line, wageRate ?? null, burden ?? undefined)
}

export function getTimecardLineDiffValue(
  line: TimecardWorkbookLineRecord | null | undefined,
  rowKind: TimecardLineRowKind,
) {
  if (!line) return ''
  if (rowKind === 'hours') return line.difH
  if (rowKind === 'production') return line.difP
  return line.difC
}

export function getTimecardLineDayDisplayValue(
  line: TimecardWorkbookLineRecord | null | undefined,
  rowKind: TimecardLineRowKind,
  dayIndex: number,
) {
  const day = line?.days[dayIndex]
  if (!line || !day) return ''
  if (rowKind === 'hours') return formatTimecardFixedNumber(day.hours, 2, true)
  if (rowKind === 'production') return formatTimecardFixedNumber(day.production, 2, true)
  return formatTimecardFixedNumber(day.unitCostOverride ?? day.unitCost, 2, true)
}

export function getTimecardLineProductionDisplayValue(
  line: TimecardWorkbookLineRecord | null | undefined,
  rowKind: TimecardLineRowKind,
  wageRate: number | null | undefined,
  burden: number | null | undefined,
  blankProductionWhenZero = true,
) {
  if (rowKind === 'hours') return ''
  if (rowKind === 'production') {
    return formatTimecardTrimmedNumber(getTimecardLineProductionTotal(line), 3, blankProductionWhenZero)
  }
  return formatTimecardFixedNumber(getTimecardLineSummaryCost(line, wageRate, burden), 3, true)
}

export function getTimecardLineOffDisplayValue(
  line: TimecardWorkbookLineRecord | null | undefined,
  rowKind: TimecardLineRowKind,
) {
  if (!line) return ''
  if (rowKind === 'hours') return formatTimecardTrimmedNumber(line.offHours, 2, true)
  if (rowKind === 'production') return formatTimecardTrimmedNumber(line.offProduction, 2, true)
  return formatTimecardTrimmedNumber(line.offCost, 2, true)
}

export function displayTimecardText(value: string | null | undefined, fallback = '') {
  const next = typeof value === 'string' ? value.trim() : ''
  return next || fallback
}
