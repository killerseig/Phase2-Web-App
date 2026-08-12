import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useJobTimecardCardWorkspaceActions } from '@/features/timecards/useJobTimecardCardWorkspaceActions'
import { createWorkbookLines } from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
    id: 'card-1',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'Vince',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Vince Hintz',
    isContractor: false,
    lastName: 'Hintz',
    lines: createWorkbookLines('2026-06-14'),
    notes: '',
    occupation: 'Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: 42.5,
    ...overrides,
  }
}

function mountWorkspaceActions(options: {
  burdenValue?: number
  canEditWeek?: boolean
  saveError?: string
  selectedWeekStartDate?: string
} = {}) {
  const burdenValue = ref(options.burdenValue ?? 0.33)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const saveError = ref(options.saveError ?? '')
  const selectedWeekStartDate = ref(options.selectedWeekStartDate ?? '2026-06-14')
  const calls: string[] = []
  const clearCardMeasurements = vi.fn(() => {
    calls.push('clear-measurements')
  })
  const pruneCardMeasurements = vi.fn((validIds: Set<string>) => {
    calls.push(`prune-measurements:${Array.from(validIds).join(',')}`)
  })
  const pruneSaveQueueToIds = vi.fn((validIds: Set<string>) => {
    calls.push(`prune-save:${Array.from(validIds).join(',')}`)
  })
  const resetCardSelectionState = vi.fn(() => {
    calls.push('reset-selection')
  })
  const resetMessages = vi.fn(() => {
    calls.push('reset-messages')
  })
  const resetSaveQueueState = vi.fn(() => {
    calls.push('reset-save')
  })
  const scheduleCardSave = vi.fn((card: TimecardCardRecord) => {
    calls.push(`schedule:${card.id}:${card.totals.hoursTotal}`)
  })
  const selectCard = vi.fn((cardId: string) => {
    calls.push(`select:${cardId}`)
  })
  const syncCardSelectionState = vi.fn((cards: TimecardCardRecord[]) => {
    calls.push(`sync-selection:${cards.map((card) => card.id).join(',')}`)
  })

  const actions = useJobTimecardCardWorkspaceActions({
    burdenValue: computed(() => burdenValue.value),
    canEditWeek: computed(() => canEditWeek.value),
    clearCardMeasurements,
    pruneCardMeasurements,
    pruneSaveQueueToIds,
    resetCardSelectionState,
    resetMessages,
    resetSaveQueueState,
    saveError,
    scheduleCardSave,
    selectCard,
    selectedWeekStartDate: computed(() => selectedWeekStartDate.value),
    syncCardSelectionState,
  })

  return {
    actions,
    burdenValue,
    calls,
    canEditWeek,
    clearCardMeasurements,
    pruneCardMeasurements,
    pruneSaveQueueToIds,
    resetCardSelectionState,
    resetMessages,
    resetSaveQueueState,
    saveError,
    scheduleCardSave,
    selectCard,
    selectedWeekStartDate,
    syncCardSelectionState,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('useJobTimecardCardWorkspaceActions', () => {
  it('resets queued saves, selection, and measurements when the card workspace changes', () => {
    const {
      actions,
      calls,
      clearCardMeasurements,
      resetCardSelectionState,
      resetSaveQueueState,
    } = mountWorkspaceActions()

    actions.resetCardWorkspaceState()

    expect(resetSaveQueueState).toHaveBeenCalledWith({ clearQueued: true })
    expect(resetCardSelectionState).toHaveBeenCalledTimes(1)
    expect(clearCardMeasurements).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['reset-save', 'reset-selection', 'clear-measurements'])
  })

  it('clears page messages and save errors together', () => {
    const {
      actions,
      resetMessages,
      saveError,
    } = mountWorkspaceActions({ saveError: 'Failed to save.' })

    actions.resetPageAndSaveMessages()

    expect(resetMessages).toHaveBeenCalledTimes(1)
    expect(saveError.value).toBe('')
  })

  it('keeps save queues, card selection, and measurements scoped to the visible card ids', () => {
    const {
      actions,
      pruneCardMeasurements,
      pruneSaveQueueToIds,
      syncCardSelectionState,
    } = mountWorkspaceActions()
    const nextCards = [
      makeCard({ id: 'card-a' }),
      makeCard({ id: 'card-b' }),
    ]

    actions.syncCardUiState(nextCards)

    expect(Array.from(pruneSaveQueueToIds.mock.calls[0]![0])).toEqual(['card-a', 'card-b'])
    expect(syncCardSelectionState).toHaveBeenCalledWith(nextCards)
    expect(Array.from(pruneCardMeasurements.mock.calls[0]![0])).toEqual(['card-a', 'card-b'])
  })

  it('reports cards as read only whenever the selected week cannot be edited', () => {
    const editable = mountWorkspaceActions({ canEditWeek: true })
    expect(editable.actions.isCardReadOnly('card-1')).toBe(false)

    const readOnly = mountWorkspaceActions({ canEditWeek: false })
    expect(readOnly.actions.isCardReadOnly('card-1')).toBe(true)

    readOnly.canEditWeek.value = true
    expect(readOnly.actions.isCardReadOnly('card-1')).toBe(false)
  })

  it('scrolls the requested card into view on the next animation frame', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const scrollIntoView = vi.fn()
    const cardElement = document.createElement('section')
    cardElement.id = 'timecard-card-card-1'
    Object.defineProperty(cardElement, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    document.body.appendChild(cardElement)
    const { actions } = mountWorkspaceActions()

    actions.scrollCardIntoView('card-1')

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('ignores scroll requests when the card element is not mounted yet', () => {
    vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const { actions } = mountWorkspaceActions()

    expect(() => actions.scrollCardIntoView('missing-card')).not.toThrow()
  })

  it('selects the changed card, recalculates totals, and schedules the save', () => {
    const {
      actions,
      calls,
      scheduleCardSave,
      selectCard,
    } = mountWorkspaceActions({ burdenValue: 0.33 })
    const card = makeCard({ id: 'card-vince' })
    card.lines[0]!.days[0]!.hours = 8
    card.lines[0]!.days[0]!.production = 4

    actions.handleWorkbookChanged(card)

    expect(selectCard).toHaveBeenCalledWith('card-vince')
    expect(card.totals.hoursTotal).toBe(8)
    expect(card.totals.productionTotal).toBe(4)
    expect(card.totals.lineTotal).toBeGreaterThan(0)
    expect(scheduleCardSave).toHaveBeenCalledWith(card)
    expect(calls).toEqual(['select:card-vince', 'schedule:card-vince:8'])
  })
})
