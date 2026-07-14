import {
  buildCardDisplayName,
  type TimecardEmployeeSeed,
} from '@/features/timecards/workbook'
import type { EmployeeRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

export type JobTimecardSortMode = 'name' | 'number'

export interface JobTimecardCustomCardFormState {
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: string
  isContractor: boolean
}

export type JobTimecardConfirmAction =
  | {
      kind: 'remove-card'
      cardId: string
      cardLabel: string
      weekId: string
    }
  | {
      kind: 'submit-week'
      weekId: string
      weekEndDate: string
    }

const defaultCollator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' })

export function preferJobTimecardDisplayWeek(weekList: TimecardWeekRecord[]) {
  return weekList.slice().sort((left, right) => (
    Number(right.status === 'submitted') - Number(left.status === 'submitted')
    || Number(right.employeeCardCount ?? 0) - Number(left.employeeCardCount ?? 0)
    || right.id.localeCompare(left.id)
  ))[0] ?? null
}

export function filterJobTimecardCards(cards: TimecardCardRecord[], searchTerm: string) {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return cards

  return cards.filter((card) => {
    const displayName = buildCardDisplayName(card).toLowerCase()
    return (
      displayName.includes(query)
      || card.employeeNumber.toLowerCase().includes(query)
      || card.occupation.toLowerCase().includes(query)
    )
  })
}

export function filterAvailableTimecardEmployees(
  employees: EmployeeRecord[],
  searchTerm: string,
  limit = 16,
) {
  const query = searchTerm.trim().toLowerCase()

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

export function makeJobTimecardEmployeeSeed(employee: EmployeeRecord): TimecardEmployeeSeed {
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

export function createEmptyJobTimecardCustomCardForm(): JobTimecardCustomCardFormState {
  return {
    firstName: '',
    lastName: '',
    employeeNumber: '',
    occupation: '',
    wageRate: '',
    isContractor: false,
  }
}

export function resetJobTimecardCustomCardForm(form: JobTimecardCustomCardFormState) {
  const emptyForm = createEmptyJobTimecardCustomCardForm()
  form.firstName = emptyForm.firstName
  form.lastName = emptyForm.lastName
  form.employeeNumber = emptyForm.employeeNumber
  form.occupation = emptyForm.occupation
  form.wageRate = emptyForm.wageRate
  form.isContractor = emptyForm.isContractor
}

export function validateJobTimecardCustomCardForm(
  form: JobTimecardCustomCardFormState,
  options: { canEditWage: boolean },
) {
  if (!form.firstName.trim()) return 'Enter the first name.'
  if (!form.lastName.trim()) return 'Enter the last name.'
  if (!form.employeeNumber.trim()) return 'Enter the employee number.'
  if (!form.occupation.trim()) return 'Enter the occupation.'
  if (!options.canEditWage) return ''

  const wageText = form.wageRate.trim()
  if (!wageText) return ''

  const wage = Number(wageText)
  if (!Number.isFinite(wage) || Number.isNaN(wage) || wage < 0) return 'Enter a valid wage amount.'
  return ''
}

export function getJobTimecardConfirmTitle(action: JobTimecardConfirmAction | null) {
  if (!action) return 'Confirm timecard action'
  return action.kind === 'remove-card' ? 'Delete timecard?' : 'Submit week?'
}

export function getJobTimecardConfirmMessage(action: JobTimecardConfirmAction | null) {
  if (!action) return ''
  if (action.kind === 'remove-card') {
    return `Remove ${action.cardLabel} from this week? This cannot be undone.`
  }

  return `Submit the week ending ${action.weekEndDate}? Timecards will become read-only after submission.`
}

export function getJobTimecardConfirmLabel(action: JobTimecardConfirmAction | null) {
  if (!action) return 'Confirm'
  return action.kind === 'remove-card' ? 'Delete Card' : 'Submit Week'
}

export function isJobTimecardConfirmDestructive(action: JobTimecardConfirmAction | null) {
  return action?.kind === 'remove-card'
}

export function getJobTimecardWeekStatusLabel(options: {
  ensuringWeek: boolean
  hasSelectedWeekEndDate: boolean
  hasSelectedWeek: boolean
  selectedWeekStatus?: TimecardWeekRecord['status'] | string
}) {
  if (options.ensuringWeek && !options.hasSelectedWeek) return 'Opening Week'
  if (options.hasSelectedWeekEndDate && !options.hasSelectedWeek) return 'Not Created'
  if (!options.hasSelectedWeek) return 'No Week'
  return options.selectedWeekStatus === 'submitted' ? 'Submitted' : 'Draft'
}

export function getJobTimecardSaveStateLabel(options: {
  saveError: string
  hasPendingSave: boolean
  canEditWeek: boolean
  hasRecentSave: boolean
}) {
  if (options.saveError) return options.saveError
  if (options.hasPendingSave) return 'Saving...'
  if (!options.canEditWeek) return 'Read Only'
  if (options.hasRecentSave) return 'Saved'
  return 'Ready'
}

export function getJobTimecardEmptyCanvasMessage(options: {
  hasSelectedWeekEndDate: boolean
  hasSelectedWeek: boolean
  cardCount: number
  canEditWeek: boolean
}) {
  if (!options.hasSelectedWeekEndDate) return 'Choose a week ending date to start.'
  if (!options.hasSelectedWeek) return 'No timecard week exists for this date yet. Create a week to start.'
  if (options.cardCount) return 'No cards match this search.'
  if (!options.canEditWeek) return 'No timecards were saved for this week.'
  return 'Create a card to start this week.'
}

export function mergeJobTimecardRemoteCardsWithLocalState<T extends TimecardCardRecord>(
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

export function getNextJobTimecardSortIndex(cards: readonly TimecardCardRecord[]) {
  return cards.reduce((maxValue, card) => Math.max(maxValue, Number(card.sortIndex ?? 0)), -1) + 1
}

function getCardLastNameSortKey(card: TimecardCardRecord) {
  const lastName = card.lastName.trim()
  if (lastName) return lastName

  return buildCardDisplayName(card).trim()
}

export function compareJobTimecardCardsByEmployeeName(
  left: TimecardCardRecord,
  right: TimecardCardRecord,
  collator = defaultCollator,
) {
  return (
    collator.compare(getCardLastNameSortKey(left), getCardLastNameSortKey(right))
    || collator.compare(left.firstName.trim(), right.firstName.trim())
    || collator.compare(buildCardDisplayName(left), buildCardDisplayName(right))
    || collator.compare(left.employeeNumber, right.employeeNumber)
    || left.id.localeCompare(right.id)
  )
}

export function sortJobTimecardCardsForMode(
  nextCards: TimecardCardRecord[],
  mode: JobTimecardSortMode,
  collator = defaultCollator,
) {
  return nextCards.slice().sort((left, right) => {
    if (mode === 'number') {
      return (
        collator.compare(left.employeeNumber, right.employeeNumber)
        || compareJobTimecardCardsByEmployeeName(left, right, collator)
        || left.id.localeCompare(right.id)
      )
    }

    return compareJobTimecardCardsByEmployeeName(left, right, collator)
  })
}
