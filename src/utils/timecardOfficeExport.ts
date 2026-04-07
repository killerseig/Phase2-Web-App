import type { Timecard, TimecardJobEntry } from '@/types/models'
import {
  calculateUnitCost,
  TIMECARD_SATURDAY_RATE,
  TIMECARD_WEEKDAY_RATE,
} from '@/utils/timecardUtils'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayKey = typeof DAY_KEYS[number]

type TimecardExportOptions = {
  defaultJobCode?: string
  fixedDataRowCount?: number
}

type OfficeExportLine = {
  jobNumber: string
  subsectionArea: string
  account: string
  costCode: string
  difH: string
  difP: string
  difC: string
  offHours: number
  offProduction: number
  offCost: number
  production: Record<DayKey, number>
  unitCost: Record<DayKey, number>
  totals: {
    hours: number
    production: number
    lineTotal: number
  }
} & Record<DayKey, number>

function toNumber(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return parsed
}

function getRateMultiplierForDay(dayKey: DayKey): number {
  return dayKey === 'sat' ? TIMECARD_SATURDAY_RATE : TIMECARD_WEEKDAY_RATE
}

function formatOfficeDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || '').trim())
  if (!match) return String(dateString || '')
  const [, year, month, day] = match
  return `${Number(month)}/${Number(day)}/${year}`
}

function formatOfficeNumber(value: unknown, blankWhenZero = false): string {
  const numeric = toNumber(value)
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? '')
  if (!text.length) return ''
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function deriveEmployeeNameParts(timecard: Pick<Timecard, 'firstName' | 'lastName' | 'employeeName'>): {
  firstName: string
  lastName: string
  employeeName: string
} {
  const firstName = String(timecard.firstName || '').trim()
  const lastName = String(timecard.lastName || '').trim()

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      employeeName: `${firstName} ${lastName}`.trim() || String(timecard.employeeName || '').trim() || 'Unnamed Employee',
    }
  }

  const employeeName = String(timecard.employeeName || '').trim()
  if (!employeeName) {
    return { firstName: '', lastName: '', employeeName: 'Unnamed Employee' }
  }

  if (employeeName.includes(',')) {
    const [rawLastName, rawFirstName] = employeeName.split(',', 2)
    return {
      firstName: String(rawFirstName || '').trim(),
      lastName: String(rawLastName || '').trim(),
      employeeName,
    }
  }

  const parts = employeeName.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      employeeName,
    }
  }

  return {
    firstName: employeeName,
    lastName: '',
    employeeName,
  }
}

function formatOfficeEmployeeName(timecard: Pick<Timecard, 'firstName' | 'lastName' | 'employeeName'>): string {
  const { firstName, lastName, employeeName } = deriveEmployeeNameParts(timecard)
  if (lastName && firstName) return `${lastName}, ${firstName}`
  if (lastName) return lastName
  if (firstName) return firstName
  return employeeName
}

function pickFirstNonEmptyValue(source: unknown, keys: string[]): string {
  const record = source as Record<string, unknown> | null | undefined
  for (const key of keys) {
    const value = record?.[key]
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

function getLineSubSection(line: unknown): string {
  return pickFirstNonEmptyValue(line, [
    'subsectionArea',
    'subSection',
    'subsection',
    'sub_section',
    'area',
    'section',
    'subSectionCode',
  ])
}

function getLineActivityCode(line: unknown): string {
  return pickFirstNonEmptyValue(line, [
    'account',
    'acct',
    'activityCode',
    'activity',
    'detailCode',
    'detail',
    'accountCode',
  ])
}

function getLineCostCode(line: unknown): string {
  return pickFirstNonEmptyValue(line, [
    'costCode',
    'cost_code',
    'cost',
    'costcode',
  ])
}

function sanitizeLeakedCodeValue(value: unknown, disallowedValues: unknown[]): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const disallowed = new Set(
    disallowedValues
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean),
  )
  if (disallowed.has(raw.toLowerCase())) return ''
  return raw
}

function sanitizeActivityCode(value: unknown, line: unknown, disallowedValues: unknown[]): string {
  const raw = sanitizeLeakedCodeValue(value, disallowedValues)
  if (!raw) return ''

  const record = line as Record<string, unknown> | null | undefined
  const difValues = [record?.difH, record?.difP, record?.difC]
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean)

  if (difValues.includes(raw.toLowerCase())) return ''
  if (/^\d{1,3}$/.test(raw)) return ''
  return raw
}

function getLineMonSatHours(line: OfficeExportLine): number {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line[key as DayKey]), 0)
}

function getLineMonSatProduction(line: OfficeExportLine): number {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line.production[key as DayKey]), 0)
}

function getLineTotalHoursForForm(line: OfficeExportLine): number {
  return getLineMonSatHours(line)
}

function getLineTotalProductionForForm(line: OfficeExportLine): number {
  return getLineMonSatProduction(line)
}

function buildEmptyDayRecord(): Record<DayKey, number> {
  return {
    sun: 0,
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
  }
}

function normalizeOfficeExportLine(
  timecard: Timecard,
  lineSource: TimecardJobEntry | Record<string, unknown>,
  defaultJobCode?: string,
): OfficeExportLine {
  const employeeWage = toNumber(timecard.employeeWage)
  const sourceRecord = lineSource as Record<string, unknown>
  const hoursByDay = buildEmptyDayRecord()
  const productionByDay = buildEmptyDayRecord()
  const unitCostByDay = buildEmptyDayRecord()

  const days = Array.isArray(sourceRecord.days) ? sourceRecord.days as Array<Record<string, unknown>> : []
  for (const day of days) {
    const idx = typeof day.dayOfWeek === 'number' && day.dayOfWeek >= 0 && day.dayOfWeek < DAY_KEYS.length
      ? day.dayOfWeek
      : days.indexOf(day)
    const key = DAY_KEYS[idx]
    if (key === undefined) continue
    hoursByDay[key] = toNumber(day.hours)
    productionByDay[key] = toNumber(day.production)
    unitCostByDay[key] = toNumber(day.unitCost)
  }

  DAY_KEYS.forEach((key) => {
    const lineHours = toNumber(sourceRecord[key])
    const productionRecord = sourceRecord.production as Record<string, unknown> | undefined
    const unitCostRecord = sourceRecord.unitCost as Record<string, unknown> | undefined
    const lineProduction = toNumber(productionRecord?.[key])
    const lineUnitCost = toNumber(unitCostRecord?.[key])

    if (lineHours > 0 || hoursByDay[key] === 0) {
      hoursByDay[key] = lineHours || hoursByDay[key]
    }
    if (lineProduction > 0 || productionByDay[key] === 0) {
      productionByDay[key] = lineProduction || productionByDay[key]
    }

    const computedUnitCost = calculateUnitCost(
      employeeWage,
      hoursByDay[key],
      productionByDay[key],
      getRateMultiplierForDay(key),
    )
    unitCostByDay[key] = lineUnitCost || unitCostByDay[key] || computedUnitCost
  })

  const lineSubSection = getLineSubSection(sourceRecord)
  const lineCostCode = getLineCostCode(sourceRecord)
  const lineJobCode = String(sourceRecord.jobNumber || defaultJobCode || '').trim()
  const employeeCode = String(timecard.employeeNumber || '').trim()
  const rawActivityCode = getLineActivityCode(sourceRecord)
  const sanitizedActivityCode = sanitizeActivityCode(rawActivityCode, sourceRecord, [
    lineJobCode,
    employeeCode,
  ])

  const line: OfficeExportLine = {
    jobNumber: lineJobCode,
    subsectionArea: lineSubSection,
    account: sanitizedActivityCode,
    costCode: lineCostCode,
    difH: String(sourceRecord.difH || ''),
    difP: String(sourceRecord.difP || ''),
    difC: String(sourceRecord.difC || ''),
    offHours: toNumber(sourceRecord.offHours),
    offProduction: toNumber(sourceRecord.offProduction),
    offCost: toNumber(sourceRecord.offCost),
    production: { ...productionByDay },
    unitCost: { ...unitCostByDay },
    sun: hoursByDay.sun,
    mon: hoursByDay.mon,
    tue: hoursByDay.tue,
    wed: hoursByDay.wed,
    thu: hoursByDay.thu,
    fri: hoursByDay.fri,
    sat: hoursByDay.sat,
    totals: {
      hours: 0,
      production: 0,
      lineTotal: 0,
    },
  }

  const totalHours = DAY_KEYS.reduce((sum, key) => sum + toNumber(line[key]), 0)
  const totalProduction = DAY_KEYS.reduce((sum, key) => sum + toNumber(line.production[key]), 0)
  const hasRealActivity = !!sanitizedActivityCode
  const hasRealCostCode = !!String(line.costCode || '').trim()

  if (totalHours === 0 && totalProduction > 0 && !hasRealActivity && !hasRealCostCode) {
    DAY_KEYS.forEach((key) => {
      line[key] = toNumber(line.production[key])
      line.production[key] = 0
      line.unitCost[key] = 0
    })
  }

  const finalTotalHours = DAY_KEYS.reduce((sum, key) => sum + toNumber(line[key]), 0)
  const finalTotalProduction = DAY_KEYS.reduce((sum, key) => sum + toNumber(line.production[key]), 0)
  const totalLine = DAY_KEYS.reduce((sum, key) => sum + (toNumber(line.production[key]) * toNumber(line.unitCost[key])), 0)

  line.totals = {
    hours: finalTotalHours,
    production: finalTotalProduction,
    lineTotal: totalLine,
  }

  return line
}

export function normalizeTimecardForOfficeExport(
  timecard: Timecard,
  defaultJobCode?: string,
): Timecard & { lines: OfficeExportLine[]; jobCode: string } {
  const sourceLines = Array.isArray(timecard.jobs) ? timecard.jobs : []
  const lines = sourceLines.map((line) => normalizeOfficeExportLine(timecard, line, defaultJobCode))

  return {
    ...timecard,
    lines,
    jobCode: String(defaultJobCode || '').trim(),
  }
}

export function buildTimecardOfficeCsv(
  timecards: Timecard[],
  options: TimecardExportOptions = {},
): string {
  const headers = ['Employee Name', 'Employee Code', 'Job Code', 'DETAIL_DATE', 'Sub-Section', 'Activity Code', 'Cost Code', 'H_Hours', 'P_HOURS', '', '']
  const fixedDataRowCount = options.fixedDataRowCount ?? 108
  const blankRow = Array(headers.length).fill('')
  const rows: Array<Array<string | number>> = [headers, [...blankRow]]

  for (const timecard of Array.isArray(timecards) ? timecards : []) {
    const normalized = normalizeTimecardForOfficeExport(timecard, options.defaultJobCode)
    const detailDate = formatOfficeDate(String(normalized.weekEndingDate || ''))
    const employeeName = formatOfficeEmployeeName(normalized)
    const employeeCode = String(normalized.employeeNumber || '').trim()

    for (const line of normalized.lines) {
      const lineHours = getLineTotalHoursForForm(line)
      const lineProduction = getLineTotalProductionForForm(line)
      const subSection = getLineSubSection(line)
      const activityCode = sanitizeActivityCode(getLineActivityCode(line), line, [
        String(line.jobNumber || options.defaultJobCode || '').trim(),
        employeeCode,
      ])
      const costCode = getLineCostCode(line)
      const rowJobCode = String(line.jobNumber || options.defaultJobCode || '').trim()
      const hasData = lineHours > 0 || lineProduction > 0 || !!subSection || !!activityCode || !!costCode

      if (!hasData) continue

      rows.push([
        employeeName,
        employeeCode,
        rowJobCode,
        detailDate,
        subSection,
        activityCode,
        costCode,
        formatOfficeNumber(lineHours, true),
        formatOfficeNumber(lineProduction, true),
        '',
        '',
      ])
    }
  }

  while (rows.length < fixedDataRowCount + 1) {
    rows.push([...blankRow])
  }

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\r\n')
}
