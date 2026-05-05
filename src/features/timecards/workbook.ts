import type {
  TimecardCardDayRecord,
  TimecardCardRecord,
  TimecardCardTotalsRecord,
  TimecardWorkbookLineRecord,
} from '@/types/domain'

export const DEFAULT_TIMECARD_BURDEN = 0.33
export const LEGACY_TIMECARD_BURDEN = 0.294
export const LEGACY_TIMECARD_COST_MULTIPLIER = 1.294
export const TIMECARD_LINE_COUNT = 13
export const TIMECARD_VISIBLE_DAY_INDEXES = [1, 2, 3, 4, 5, 6] as const
export const TIMECARD_VISIBLE_DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export interface TimecardEmployeeSeed {
  employeeId?: string | null
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: number | null
  isContractor: boolean
}

export interface TimecardAccountSummaryItem {
  key: string
  jobNumber: string
  subsectionArea: string
  account: string
  hoursTotal: number
  productionTotal: number
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function asDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function clampNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
  return Math.max(0, parsed)
}

function valuesMatch(left: number, right: number) {
  return Math.abs(left - right) < 0.000001
}

function usesLegacyCostMultiplier(burden: number | null | undefined) {
  const safeBurden = clampNumber(burden)
  return (
    valuesMatch(safeBurden, 0)
    || valuesMatch(safeBurden, DEFAULT_TIMECARD_BURDEN)
    || valuesMatch(safeBurden, LEGACY_TIMECARD_BURDEN)
  )
}

function resolveLineDayCostMultiplier(
  lineIndex: number,
  dayIndex: number,
  burden: number | null | undefined,
) {
  if (!usesLegacyCostMultiplier(burden)) {
    return 1 + clampNumber(burden)
  }

  // The legacy workbook template contains one Saturday cost cell on the third line
  // with a 1.5 multiplier instead of the usual 1.294 burdened wage formula.
  if (lineIndex === 2 && dayIndex === 6) {
    return 1.5
  }

  return LEGACY_TIMECARD_COST_MULTIPLIER
}

function resolveLineSummaryCostMultiplier(burden: number | null | undefined) {
  if (!usesLegacyCostMultiplier(burden)) {
    return 1 + clampNumber(burden)
  }

  return LEGACY_TIMECARD_COST_MULTIPLIER
}

export function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getTodayIsoDate() {
  return formatIsoDate(new Date())
}

export function snapToSaturday(dateValue: string) {
  const current = asDate(dateValue || getTodayIsoDate())
  const offset = (6 - current.getDay() + 7) % 7
  current.setDate(current.getDate() + offset)
  return formatIsoDate(current)
}

export function getPreviousSaturday(weekEndDate: string) {
  const current = asDate(weekEndDate)
  current.setDate(current.getDate() - 7)
  return formatIsoDate(current)
}

export function getWeekStartFromSaturday(weekEndDate: string) {
  const current = asDate(weekEndDate)
  current.setDate(current.getDate() - 6)
  return formatIsoDate(current)
}

export function formatWeekRange(weekStartDate: string, weekEndDate: string) {
  const start = asDate(weekStartDate)
  const end = asDate(weekEndDate)
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${formatter.format(start)} - ${formatter.format(end)}`
}

export function buildWeekDates(weekStartDate: string) {
  const start = asDate(weekStartDate)
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start)
    next.setDate(start.getDate() + index)
    return formatIsoDate(next)
  })
}

export function createEmptyTimecardDay(date: string, dayOfWeek: number): TimecardCardDayRecord {
  return {
    date,
    dayOfWeek,
    hours: 0,
    production: 0,
    unitCost: 0,
    unitCostOverride: null,
    lineTotal: 0,
  }
}

export function createWeekDays(weekStartDate: string) {
  return buildWeekDates(weekStartDate).map((date, index) => createEmptyTimecardDay(date, index))
}

export function createEmptyWorkbookLine(weekStartDate: string): TimecardWorkbookLineRecord {
  return {
    jobNumber: '',
    subsectionArea: '',
    account: '',
    difH: '',
    difP: '',
    difC: '',
    offHours: 0,
    offProduction: 0,
    offCost: 0,
    days: createWeekDays(weekStartDate),
  }
}

export function createWorkbookLines(weekStartDate: string, lineCount = TIMECARD_LINE_COUNT) {
  return Array.from({ length: lineCount }, () => createEmptyWorkbookLine(weekStartDate))
}

function normalizeDay(
  weekDates: string[],
  index: number,
  day: Partial<TimecardCardDayRecord> | null | undefined,
): TimecardCardDayRecord {
  return {
    date: day?.date && typeof day.date === 'string' ? day.date : weekDates[index] ?? weekDates[0] ?? '',
    dayOfWeek: index,
    hours: clampNumber(day?.hours),
    production: clampNumber(day?.production),
    unitCost: clampNumber(day?.unitCost),
    unitCostOverride: toNullableNumber(day?.unitCostOverride),
    lineTotal: clampNumber(day?.lineTotal),
  }
}

export function normalizeWorkbookLine(
  weekStartDate: string,
  line: Partial<TimecardWorkbookLineRecord> | null | undefined,
): TimecardWorkbookLineRecord {
  const weekDates = buildWeekDates(weekStartDate)
  const rawDays = Array.isArray(line?.days) ? line.days : []
  const days = weekDates.map((_, index) => normalizeDay(weekDates, index, rawDays[index]))

  return {
    jobNumber: typeof line?.jobNumber === 'string' ? line.jobNumber : '',
    subsectionArea: typeof line?.subsectionArea === 'string' ? line.subsectionArea : '',
    account: typeof line?.account === 'string' ? line.account : '',
    difH: typeof line?.difH === 'string' ? line.difH : '',
    difP: typeof line?.difP === 'string' ? line.difP : '',
    difC: typeof line?.difC === 'string' ? line.difC : '',
    offHours: clampNumber(line?.offHours),
    offProduction: clampNumber(line?.offProduction),
    offCost: clampNumber(line?.offCost),
    days,
  }
}

export function ensureWorkbookLines(
  card: Pick<TimecardCardRecord, 'lines'>,
  weekStartDate: string,
  lineCount = TIMECARD_LINE_COUNT,
) {
  const existing = Array.isArray(card.lines) ? card.lines : []
  const nextLines = existing.slice(0, lineCount).map((line) => normalizeWorkbookLine(weekStartDate, line))

  while (nextLines.length < lineCount) {
    nextLines.push(createEmptyWorkbookLine(weekStartDate))
  }

  card.lines = nextLines
  return nextLines
}

function calculateDerivedUnitCost(
  wageRate: number | null | undefined,
  hours: number,
  production: number,
  lineIndex: number,
  dayIndex: number,
  burden = DEFAULT_TIMECARD_BURDEN,
) {
  const wage = clampNumber(wageRate)
  if (!wage || !hours || !production) return 0
  return (hours * wage * resolveLineDayCostMultiplier(lineIndex, dayIndex, burden)) / production
}

export function calculateLineSummaryUnitCost(
  line: Pick<TimecardWorkbookLineRecord, 'days'>,
  wageRate: number | null | undefined,
  burden = DEFAULT_TIMECARD_BURDEN,
) {
  const totalHours = line.days.reduce((sum, day) => sum + clampNumber(day.hours), 0)
  const totalProduction = line.days.reduce((sum, day) => sum + clampNumber(day.production), 0)

  if (!totalProduction) return 0

  const hasManualCostOverride = line.days.some((day) => toNullableNumber(day.unitCostOverride) != null)
  if (hasManualCostOverride) {
    const totalCost = line.days.reduce((sum, day) => {
      const production = clampNumber(day.production)
      const override = toNullableNumber(day.unitCostOverride)
      const unitCost = override ?? clampNumber(day.unitCost)
      return sum + (production * unitCost)
    }, 0)

    return totalCost / totalProduction
  }

  const wage = clampNumber(wageRate)
  if (!wage || !totalHours) return 0
  return (totalHours * wage * resolveLineSummaryCostMultiplier(burden)) / totalProduction
}

export function recalculateCardTotals(
  card: TimecardCardRecord,
  weekStartDate: string,
  burden = DEFAULT_TIMECARD_BURDEN,
  options?: { preferStoredUnitCost?: boolean },
): TimecardCardTotalsRecord {
  const hoursByDay = Array<number>(7).fill(0)
  const productionByDay = Array<number>(7).fill(0)
  let lineTotal = 0

  const lines = ensureWorkbookLines(card, weekStartDate)
  for (const [lineIndex, line] of lines.entries()) {
    line.offHours = clampNumber(line.offHours)
    line.offProduction = clampNumber(line.offProduction)
    line.offCost = clampNumber(line.offCost)

    line.days = line.days.map((day, dayIndex) => {
      const hours = clampNumber(day.hours)
      const production = clampNumber(day.production)
      const override = toNullableNumber(day.unitCostOverride)
      const storedUnitCost = clampNumber(day.unitCost)
      const unitCost = override
        ?? (options?.preferStoredUnitCost && storedUnitCost > 0
          ? storedUnitCost
          : calculateDerivedUnitCost(card.wageRate, hours, production, lineIndex, dayIndex, burden))
      const total = production * unitCost

      hoursByDay[dayIndex] = (hoursByDay[dayIndex] ?? 0) + hours
      productionByDay[dayIndex] = (productionByDay[dayIndex] ?? 0) + production
      lineTotal += total

      return {
        ...normalizeDay(buildWeekDates(weekStartDate), dayIndex, day),
        hours,
        production,
        unitCost,
        unitCostOverride: override,
        lineTotal: total,
      }
    })
  }

  const totals = {
    hoursByDay,
    productionByDay,
    hoursTotal: hoursByDay.reduce((sum, value) => sum + value, 0),
    productionTotal: productionByDay.reduce((sum, value) => sum + value, 0),
    lineTotal,
  }

  card.totals = totals
  return totals
}

export function calculateRegularAndOvertimeHours(
  totalHours: number,
  regularHoursOverride: number | null,
  overtimeHoursOverride: number | null,
) {
  const safeTotal = clampNumber(totalHours)
  return {
    regularHours: regularHoursOverride == null ? Math.min(safeTotal, 40) : clampNumber(regularHoursOverride),
    overtimeHours: overtimeHoursOverride == null ? Math.max(safeTotal - 40, 0) : clampNumber(overtimeHoursOverride),
  }
}

export function buildCardDisplayName(card: Pick<TimecardCardRecord, 'fullName' | 'firstName' | 'lastName' | 'employeeNumber'>) {
  const fullName = card.fullName.trim()
  if (fullName) return fullName
  const joined = `${card.firstName} ${card.lastName}`.trim()
  if (joined) return joined
  return card.employeeNumber.trim() || 'Unnamed Employee'
}

export function buildEmployeeCard(
  input: TimecardEmployeeSeed,
  weekEndDate: string,
  sortIndex: number,
  linkedJobNumber = '',
): Omit<TimecardCardRecord, 'id'> {
  const weekStartDate = getWeekStartFromSaturday(weekEndDate)
  const fullName = `${input.firstName} ${input.lastName}`.trim()
  const defaultJobNumber = linkedJobNumber.trim()
  const lines = createWorkbookLines(weekStartDate)
  if (defaultJobNumber) {
    lines.forEach((line) => {
      line.jobNumber = defaultJobNumber
    })
  }
  const card: Omit<TimecardCardRecord, 'id'> = {
    sourceType: input.employeeId ? 'employee' : 'custom',
    employeeId: input.employeeId ?? null,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    fullName,
    employeeNumber: input.employeeNumber.trim(),
    occupation: input.occupation.trim(),
    wageRate: toNullableNumber(input.wageRate),
    isContractor: !!input.isContractor,
    sortIndex,
    lines,
    footerJobOrGl: '',
    footerAccount: '',
    footerOffice: '',
    footerAmount: '',
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
    notes: '',
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    totals: {
      hoursByDay: Array<number>(7).fill(0),
      productionByDay: Array<number>(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
  }

  recalculateCardTotals(card as TimecardCardRecord, weekStartDate)
  return card
}

function cloneLineForWeek(weekStartDate: string, source: TimecardWorkbookLineRecord) {
  return {
    ...createEmptyWorkbookLine(weekStartDate),
    jobNumber: source.jobNumber,
    subsectionArea: source.subsectionArea,
    account: source.account,
    difH: source.difH,
    difP: source.difP,
    difC: source.difC,
  }
}

export function cloneCardForNewWeek(card: TimecardCardRecord, weekEndDate: string): Omit<TimecardCardRecord, 'id'> {
  const weekStartDate = getWeekStartFromSaturday(weekEndDate)
  const sourceLines = Array.isArray(card.lines) ? card.lines : []
  const nextCard: Omit<TimecardCardRecord, 'id'> = {
    sourceType: card.sourceType === 'custom' ? 'custom' : 'employee',
    employeeId: card.employeeId,
    firstName: card.firstName,
    lastName: card.lastName,
    fullName: buildCardDisplayName(card),
    employeeNumber: card.employeeNumber,
    occupation: card.occupation,
    wageRate: toNullableNumber(card.wageRate),
    isContractor: !!card.isContractor,
    sortIndex: clampNumber(card.sortIndex),
    lines: sourceLines.map((line) => cloneLineForWeek(weekStartDate, normalizeWorkbookLine(weekStartDate, line))),
    footerJobOrGl: '',
    footerAccount: '',
    footerOffice: '',
    footerAmount: '',
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
    notes: '',
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    totals: {
      hoursByDay: Array<number>(7).fill(0),
      productionByDay: Array<number>(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
  }

  recalculateCardTotals(nextCard as TimecardCardRecord, weekStartDate)
  return nextCard
}

export function buildAccountsSummary(cards: TimecardCardRecord[]) {
  const summary = new Map<string, TimecardAccountSummaryItem>()

  for (const card of cards) {
    for (const line of card.lines ?? []) {
      const jobNumber = line.jobNumber.trim()
      const subsectionArea = line.subsectionArea.trim()
      const account = line.account.trim()
      if (!jobNumber && !subsectionArea && !account) continue

      const hoursTotal = line.days.reduce((sum, day) => sum + clampNumber(day.hours), 0)
      const productionTotal = line.days.reduce((sum, day) => sum + clampNumber(day.production), 0)
      if (!hoursTotal && !productionTotal) continue

      const key = `${jobNumber}|${subsectionArea}|${account}`
      const existing = summary.get(key)
      if (existing) {
        existing.hoursTotal += hoursTotal
        existing.productionTotal += productionTotal
        continue
      }

      summary.set(key, {
        key,
        jobNumber,
        subsectionArea,
        account,
        hoursTotal,
        productionTotal,
      })
    }
  }

  return Array.from(summary.values()).sort((left, right) => (
    left.jobNumber.localeCompare(right.jobNumber, undefined, { numeric: true })
    || left.subsectionArea.localeCompare(right.subsectionArea)
    || left.account.localeCompare(right.account)
  ))
}
