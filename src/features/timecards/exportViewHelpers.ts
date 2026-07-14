import {
  buildCardDisplayName,
  getWeekStartFromSaturday,
  recalculateCardTotals,
  type TimecardEmployeeSeed,
} from '@/features/timecards/workbook'
import type { EmployeeRecord, JobRecord, TimecardCardRecord, TimecardWeekRecord, UserProfile } from '@/types/domain'
import { toEffectiveRole } from '@/types/domain'

export type TimecardExportSortMode = 'name' | 'number'
export type TimecardExportDateFilterMode = 'single' | 'range'
export type TimecardExportWeekStatusFilter = 'submitted' | 'draft' | 'all'
export type TimecardExportConfirmAction =
  | {
      kind: 'remove-card'
      cardId: string
      cardLabel: string
      weekId: string
      weekEndDate: string
    }
  | {
      kind: 'delete-week'
      weekId: string
      weekLabel: string
      weekEndDate: string
    }

export type TimecardExportArchiveCardRecord = TimecardCardRecord & {
  archiveWeekId: string
  archiveWeekStartDate: string
  archiveWeekEndDate: string
  archiveWeekStatus: TimecardWeekRecord['status']
  archiveJobId: string
  archiveJobCode: string | null
  archiveJobName: string | null
  archiveForemanName: string | null
  archiveBurden: number
}

export interface TimecardExportFilterState {
  dateMode: TimecardExportDateFilterMode
  singleWeekEndDate: string
  rangeStartDate: string
  rangeEndDate: string
  selectedJobIds: readonly string[]
  foreman: string
  status: TimecardExportWeekStatusFilter
  weekSearch: string
  cardSearch: string
}

export interface TimecardExportCustomCardFormState {
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: string
  isContractor: boolean
}

export interface TimecardExportCustomCardValidationOptions {
  hasLinkedJob: boolean
  hasLinkedJobNumber: boolean
  needsForemanOwner: boolean
  isAdmin: boolean
}

export interface TimecardExportJobOption {
  id: string
  code: string
  name: string
  label: string
}

export interface TimecardExportForemanFilterOption {
  label: string
  value: string
}

export interface TimecardExportCreateForemanOption {
  id: string
  label: string
}

export interface TimecardExportSaveStateOptions {
  saveError: string
  hasPendingSave: boolean
  isLoading: boolean
  hasFilteredWeeks: boolean
  hasRecentSave: boolean
}

export interface TimecardExportStatusSignal {
  key: string
  text: string
  tone: 'default' | 'success' | 'error'
}

interface TimecardExportWeekFilterBounds {
  startDate: string
  endDate: string
}

const defaultCollator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' })

export function formatTimecardExportDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}

export function getTimecardExportWeekFilterBounds(
  filters: Pick<TimecardExportFilterState, 'dateMode' | 'singleWeekEndDate' | 'rangeStartDate' | 'rangeEndDate'>,
): TimecardExportWeekFilterBounds {
  const startDate = filters.dateMode === 'single' ? filters.singleWeekEndDate : filters.rangeStartDate
  const endDate = filters.dateMode === 'single' ? filters.singleWeekEndDate : filters.rangeEndDate

  if (startDate && endDate && startDate > endDate) {
    return {
      startDate: endDate,
      endDate: startDate,
    }
  }

  return { startDate, endDate }
}

export function filterTimecardExportWeeks(
  weeks: readonly TimecardWeekRecord[],
  filters: TimecardExportFilterState,
  bounds = getTimecardExportWeekFilterBounds(filters),
) {
  const query = filters.weekSearch.trim().toLowerCase()
  const { startDate, endDate } = bounds

  return weeks.filter((week) => {
    if (startDate && week.weekEndDate < startDate) return false
    if (endDate && week.weekEndDate > endDate) return false
    if (filters.selectedJobIds.length && !filters.selectedJobIds.includes(week.jobId)) return false

    const foremanName = week.ownerForemanName?.trim() ?? ''
    if (filters.foreman !== 'all' && foremanName !== filters.foreman) return false
    if (filters.status !== 'all' && week.status !== filters.status) return false
    if (!query) return true

    const haystack = [
      week.weekEndDate,
      week.jobCode ?? '',
      week.jobName ?? '',
      foremanName,
      week.status,
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  })
}

export function filterTimecardExportCards<T extends TimecardCardRecord>(cards: readonly T[], cardSearch: string) {
  const query = cardSearch.trim().toLowerCase()
  if (!query) return cards.slice()

  return cards.filter((card) => {
    const displayName = buildCardDisplayName(card).toLowerCase()
    return (
      displayName.includes(query)
      || card.employeeNumber.toLowerCase().includes(query)
      || card.occupation.toLowerCase().includes(query)
    )
  })
}

export function filterTimecardExportEmployees(
  employees: readonly EmployeeRecord[],
  search: string,
  limit = 16,
) {
  const query = search.trim().toLowerCase()

  return employees
    .filter((employee) => employee.active)
    .filter((employee) => {
      if (!query) return true
      const displayName = `${employee.firstName} ${employee.lastName}`.trim().toLowerCase()
      return (
        displayName.includes(query)
        || employee.employeeNumber.toLowerCase().includes(query)
        || employee.occupation.toLowerCase().includes(query)
      )
    })
    .slice(0, limit)
}

export function formatTimecardExportPackageCountLabel(weeks: readonly TimecardWeekRecord[]) {
  const count = weeks.length
  if (!count) return 'No saved week packages'
  if (count === 1) return '1 saved week package'
  return `${count} saved week packages`
}

export function formatTimecardExportJobsLabel(weeks: readonly TimecardWeekRecord[]) {
  if (!weeks.length) return 'No jobs'

  const uniqueJobIds = Array.from(new Set(weeks.map((week) => week.jobId)))
  if (uniqueJobIds.length === 1) {
    const matchingWeek = weeks.find((week) => week.jobId === uniqueJobIds[0]) || weeks[0]
    if (!matchingWeek) return '1 job'
    if (matchingWeek.jobCode && matchingWeek.jobName) return `${matchingWeek.jobCode} - ${matchingWeek.jobName}`
    return matchingWeek.jobName || matchingWeek.jobCode || '1 job'
  }

  return `${uniqueJobIds.length} jobs`
}

export function formatTimecardExportForemenLabel(weeks: readonly TimecardWeekRecord[]) {
  const foremen = Array.from(
    new Set(
      weeks.map((week) => week.ownerForemanName?.trim() || 'No Foreman'),
    ),
  )

  if (!foremen.length) return 'No foremen'
  if (foremen.length === 1) return foremen[0] ?? 'No foremen'
  return `${foremen.length} foremen`
}

export function formatTimecardExportWeekStatusLabel(
  weeks: readonly TimecardWeekRecord[],
  emptyLabel = 'No Results',
) {
  if (!weeks.length) return emptyLabel

  const statuses = Array.from(
    new Set(
      weeks.map((week) => (week.status === 'submitted' ? 'Submitted' : 'Draft')),
    ),
  )

  return statuses.length === 1 ? statuses[0] ?? emptyLabel : 'Mixed'
}

export function formatTimecardExportVisibleWeekHeading(
  bounds: TimecardExportWeekFilterBounds,
  currentWeekEndDate: string,
) {
  const { startDate, endDate } = bounds
  if (!startDate && !endDate) return 'Matching Weeks'
  if (!startDate || !endDate || startDate === endDate) {
    return formatTimecardExportDate(endDate || startDate || currentWeekEndDate)
  }

  return `${formatTimecardExportDate(startDate)} - ${formatTimecardExportDate(endDate)}`
}

export function formatTimecardExportWeekRowSubtitle(week: TimecardWeekRecord) {
  const jobLabel = week.jobCode || week.jobName || 'Unknown Job'
  const foremanLabel = week.ownerForemanName || 'No Foreman'
  return `${jobLabel} \u2022 ${foremanLabel}`
}

export function getTimecardExportCreateTrayMessage(
  dateMode: TimecardExportDateFilterMode,
  hasJobOptions: boolean,
) {
  if (dateMode !== 'single') return 'Switch Date Mode to Single before creating cards.'
  if (!hasJobOptions) return 'No jobs are available to create cards for.'
  return ''
}

export function getTimecardExportSaveStateLabel(options: TimecardExportSaveStateOptions) {
  if (options.saveError) return options.saveError
  if (options.hasPendingSave) return 'Saving...'
  if (options.isLoading) return 'Loading...'
  if (!options.hasFilteredWeeks) return 'No Matching Weeks'
  if (options.hasRecentSave) return 'Saved'
  return 'Idle'
}

export function getTimecardExportCompactSaveStateLabel(options: TimecardExportSaveStateOptions) {
  if (options.saveError) return 'Error'
  if (options.hasPendingSave) return 'Saving'
  if (options.isLoading) return 'Loading'
  if (!options.hasFilteredWeeks) return 'No Weeks'
  if (options.hasRecentSave) return 'Saved'
  return 'Idle'
}

export function buildTimecardExportStatusSignals(options: {
  compactWeekStatusLabel: string
  weekStatusLabel: string
  compactSaveStateLabel: string
  hasSaveError: boolean
  weekCount: number
  cardCount: number
}): TimecardExportStatusSignal[] {
  return [
    {
      key: 'results',
      text: `Status: ${options.compactWeekStatusLabel}`,
      tone: options.weekStatusLabel === 'Submitted' ? 'success' : 'default',
    },
    {
      key: 'autosave',
      text: `Save: ${options.compactSaveStateLabel}`,
      tone: options.hasSaveError ? 'error' : 'default',
    },
    {
      key: 'weeks',
      text: `Weeks: ${options.weekCount}`,
      tone: 'default',
    },
    {
      key: 'cards',
      text: `Cards: ${options.cardCount}`,
      tone: 'default',
    },
  ]
}

export function getTimecardExportEmptyCanvasMessage(options: {
  filteredWeekCount: number
  cardCount: number
  filteredCardCount: number
}) {
  if (!options.filteredWeekCount) return 'No saved weeks match the current filters.'
  if (options.cardCount && !options.filteredCardCount) return 'No cards match this employee search.'
  if (!options.cardCount) return 'No timecards were saved for the current week results.'
  return 'No timecards available.'
}

export function buildTimecardExportPdfSubtitle(parts: readonly string[]) {
  return parts.filter(Boolean).join(' \u00b7 ')
}

export function buildTimecardExportCsvFilename(
  bounds: TimecardExportWeekFilterBounds,
  currentWeekEndDate: string,
) {
  const { startDate, endDate } = bounds
  if (!startDate && !endDate) return 'timecard-export.csv'
  if (!startDate || !endDate || startDate === endDate) {
    return `timecard-export-${endDate || startDate || currentWeekEndDate}.csv`
  }

  return `timecard-export-${startDate}_to_${endDate}.csv`
}

export function buildTimecardExportJobOptions(
  jobs: readonly JobRecord[],
  collator = defaultCollator,
): TimecardExportJobOption[] {
  return jobs
    .slice()
    .sort((left, right) => collator.compare(
      left.code ? `${left.code} ${left.name}` : left.name,
      right.code ? `${right.code} ${right.name}` : right.name,
    ))
    .map((job) => ({
      id: job.id,
      code: job.code ?? '',
      name: job.name ?? '',
      label: job.code ? `${job.code} - ${job.name}` : job.name,
    }))
}

export function buildTimecardExportAvailableForemen(
  weeks: readonly TimecardWeekRecord[],
  collator = defaultCollator,
) {
  return Array.from(
    new Set(
      weeks
        .map((week) => week.ownerForemanName?.trim())
        .filter((value): value is string => !!value),
    ),
  ).sort((left, right) => collator.compare(left, right))
}

export function buildTimecardExportForemanFilterOptions(
  foremen: readonly string[],
): TimecardExportForemanFilterOption[] {
  return [
    { label: 'All Foremen', value: 'all' },
    ...foremen.map((foreman) => ({
      label: foreman,
      value: foreman,
    })),
  ]
}

export function filterTimecardExportUserForemen(users: readonly UserProfile[]) {
  return users.filter((user) => user.active && toEffectiveRole(user.role) === 'foreman')
}

export function buildTimecardExportCreateForemanOptions(
  targetJob: JobRecord | null,
  users: readonly UserProfile[],
): TimecardExportCreateForemanOption[] {
  if (!targetJob) return []

  const assignedIds = new Set(targetJob.assignedForemanIds)
  const matchedUsers = users.filter((user) => (
    assignedIds.has(user.id) || user.assignedJobIds.includes(targetJob.id)
  ))

  const uniqueUsers = Array.from(new Map(matchedUsers.map((user) => [user.id, user])).values())
  return uniqueUsers.map((user) => ({
    id: user.id,
    label: formatTimecardExportUserDisplayName(user),
  }))
}

export function resolveTimecardExportCreateWeekTarget(options: {
  dateMode: TimecardExportDateFilterMode
  jobId: string
  weekEndDate: string
  weeks: readonly TimecardWeekRecord[]
  jobOptions: readonly TimecardExportJobOption[]
  ownerUserId: string | null
  ownerName: string | null
}): TimecardWeekRecord | null {
  if (options.dateMode !== 'single' || !options.jobId) return null

  const matchingSavedWeek = options.weeks.find((week) => (
    week.jobId === options.jobId
    && week.weekEndDate === options.weekEndDate
  ))

  if (matchingSavedWeek) return matchingSavedWeek

  const selectedJob = options.jobOptions.find((job) => job.id === options.jobId)
  if (!selectedJob) return null

  return {
    id: '',
    jobId: selectedJob.id,
    jobCode: selectedJob.code || null,
    jobName: selectedJob.name || null,
    ownerForemanUserId: options.ownerUserId,
    ownerForemanName: options.ownerName,
    weekStartDate: getWeekStartFromSaturday(options.weekEndDate),
    weekEndDate: options.weekEndDate,
    status: 'draft',
    employeeCardCount: 0,
  }
}

export function resolveTimecardExportCreateJobNumber(
  jobOptions: readonly TimecardExportJobOption[],
  jobId: string,
) {
  const selectedJob = jobOptions.find((job) => job.id === jobId)
  if (!selectedJob) return ''
  return selectedJob.code.trim() || selectedJob.name.trim()
}

export function resolveTimecardExportCreateForeman(
  foremanOptions: readonly TimecardExportCreateForemanOption[],
  foremanId: string,
) {
  return foremanOptions.find((foreman) => foreman.id === foremanId) ?? null
}

export function getTimecardExportWeekBurden(
  week: TimecardWeekRecord,
  jobs: readonly JobRecord[],
  defaultBurden: number,
) {
  const matchingJob = jobs.find((job) => job.id === week.jobId)
  return matchingJob?.productionBurden ?? defaultBurden
}

export function decorateTimecardExportArchiveCards(
  week: TimecardWeekRecord,
  nextCards: readonly TimecardCardRecord[],
  burden: number,
): TimecardExportArchiveCardRecord[] {
  return nextCards.map((card) => {
    const archiveCard: TimecardExportArchiveCardRecord = {
      ...card,
      archiveWeekId: week.id,
      archiveWeekStartDate: week.weekStartDate,
      archiveWeekEndDate: week.weekEndDate,
      archiveWeekStatus: week.status,
      archiveJobId: week.jobId,
      archiveJobCode: week.jobCode,
      archiveJobName: week.jobName,
      archiveForemanName: week.ownerForemanName,
      archiveBurden: burden,
    }

    recalculateCardTotals(archiveCard, week.weekStartDate, burden)
    return archiveCard
  })
}

export function mergeTimecardExportRemoteArchiveCardsWithLocalState<T extends TimecardExportArchiveCardRecord>(
  nextCards: readonly T[],
  localCards: readonly T[],
  pendingStateMaps: ReadonlyArray<Readonly<Record<string, boolean>>>,
) {
  const localCardsById = new Map(localCards.map((card) => [card.id, card]))

  return nextCards.map((nextCard) => {
    const hasPendingLocalState = pendingStateMaps.some((stateMap) => stateMap[nextCard.id])
    return hasPendingLocalState ? localCardsById.get(nextCard.id) ?? nextCard : nextCard
  })
}

export function getNextTimecardExportSortIndex(cards: readonly TimecardCardRecord[]) {
  return cards.reduce((maxValue, card) => Math.max(maxValue, Number(card.sortIndex ?? 0)), -1) + 1
}

export function getTimecardExportConfirmTitle(action: TimecardExportConfirmAction | null) {
  if (!action) return 'Confirm timecard export action'
  return action.kind === 'remove-card' ? 'Delete saved timecard?' : 'Delete draft week?'
}

export function getTimecardExportConfirmMessage(action: TimecardExportConfirmAction | null) {
  if (!action) return ''
  if (action.kind === 'remove-card') {
    return `Remove ${action.cardLabel} from the saved week ending ${action.weekEndDate}? This cannot be undone.`
  }

  return `Delete the draft week ending ${action.weekEndDate} for ${action.weekLabel}? This cannot be undone.`
}

export function getTimecardExportConfirmLabel(action: TimecardExportConfirmAction | null) {
  if (!action) return 'Confirm'
  return action.kind === 'remove-card' ? 'Delete Card' : 'Delete Draft'
}

export function sortTimecardExportCardsForMode<T extends TimecardCardRecord>(
  nextCards: T[],
  mode: TimecardExportSortMode,
  collator = defaultCollator,
): T[] {
  return nextCards.slice().sort((left, right) => {
    if (mode === 'number') {
      return (
        collator.compare(left.employeeNumber, right.employeeNumber)
        || collator.compare(buildCardDisplayName(left), buildCardDisplayName(right))
        || left.id.localeCompare(right.id)
      )
    }

    return (
      collator.compare(buildCardDisplayName(left), buildCardDisplayName(right))
      || collator.compare(left.employeeNumber, right.employeeNumber)
      || left.id.localeCompare(right.id)
    )
  })
}

export function createEmptyTimecardExportCustomCardForm(): TimecardExportCustomCardFormState {
  return {
    firstName: '',
    lastName: '',
    employeeNumber: '',
    occupation: '',
    wageRate: '',
    isContractor: false,
  }
}

export function resetTimecardExportCustomCardForm(form: TimecardExportCustomCardFormState) {
  const emptyForm = createEmptyTimecardExportCustomCardForm()
  form.firstName = emptyForm.firstName
  form.lastName = emptyForm.lastName
  form.employeeNumber = emptyForm.employeeNumber
  form.occupation = emptyForm.occupation
  form.wageRate = emptyForm.wageRate
  form.isContractor = emptyForm.isContractor
}

export function validateTimecardExportCustomCardForm(
  form: TimecardExportCustomCardFormState,
  options: TimecardExportCustomCardValidationOptions,
) {
  if (!options.hasLinkedJob) return 'Select the linked job.'
  if (!options.hasLinkedJobNumber) return 'Select a linked job with a job number.'
  if (options.needsForemanOwner) return 'Select the foreman owner.'
  if (!form.firstName.trim()) return 'Enter the first name.'
  if (!form.lastName.trim()) return 'Enter the last name.'
  if (!form.employeeNumber.trim()) return 'Enter the employee number.'
  if (!form.occupation.trim()) return 'Enter the occupation.'
  if (!options.isAdmin) return ''

  const wage = Number(form.wageRate.trim())
  if (!Number.isFinite(wage) || Number.isNaN(wage) || wage < 0) return 'Enter a wage amount.'
  return ''
}

export function makeTimecardExportEmployeeSeed(employee: EmployeeRecord): TimecardEmployeeSeed {
  return {
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeNumber: employee.employeeNumber,
    occupation: employee.occupation,
    wageRate: null,
    isContractor: employee.isContractor,
  }
}

export function formatTimecardExportUserDisplayName(user: UserProfile) {
  const first = user.firstName?.trim() ?? ''
  const last = user.lastName?.trim() ?? ''
  const fullName = `${first} ${last}`.trim()
  return fullName || user.email || 'Unnamed Foreman'
}
