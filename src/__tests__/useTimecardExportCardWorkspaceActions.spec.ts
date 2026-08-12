import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type TimecardExportArchiveCardRecord,
  type TimecardExportSortMode,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportCardWorkspaceActions } from '@/features/timecards/useTimecardExportCardWorkspaceActions'
import { createWorkbookLines } from '@/features/timecards/workbook'

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  const lines = createWorkbookLines('2026-06-14')
  lines[0]!.days[1]!.hours = 8
  lines[0]!.days[1]!.production = 2

  return {
    id: 'card-1',
    archiveBurden: 0.33,
    archiveForemanName: 'CJ Blanchard',
    archiveJobCode: '736',
    archiveJobId: 'job-shop',
    archiveJobName: 'Shop',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekStatus: 'submitted',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'CJ',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Blanchard, CJ',
    isContractor: false,
    lastName: 'Blanchard',
    lines,
    notes: '',
    occupation: 'Shop Foreman',
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
  readOnlyIds?: string[]
  sortMode?: TimecardExportSortMode
} = {}) {
  const readOnlyIds = new Set(options.readOnlyIds ?? ['card-1'])
  const saveError = ref('Needs attention.')
  const sortMode = ref<TimecardExportSortMode>(options.sortMode ?? 'number')
  const clearCardMeasurements = vi.fn()
  const isCardReadOnly = vi.fn((cardId: string) => readOnlyIds.has(cardId))
  const pruneCardEditStates = vi.fn()
  const pruneCardMeasurements = vi.fn()
  const pruneSaveQueueToIds = vi.fn()
  const resetCardEditStates = vi.fn()
  const resetCardSelectionState = vi.fn()
  const resetMessages = vi.fn()
  const resetSaveQueueState = vi.fn()
  const scheduleCardSave = vi.fn()
  const selectCard = vi.fn()
  const syncCardSelectionState = vi.fn()
  const actions = useTimecardExportCardWorkspaceActions({
    clearCardMeasurements,
    collator: new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' }),
    isCardReadOnly,
    pruneCardEditStates,
    pruneCardMeasurements,
    pruneSaveQueueToIds,
    resetCardEditStates,
    resetCardSelectionState,
    resetMessages,
    resetSaveQueueState,
    saveError,
    scheduleCardSave,
    selectCard,
    sortMode,
    syncCardSelectionState,
  })

  return {
    actions,
    clearCardMeasurements,
    isCardReadOnly,
    pruneCardEditStates,
    pruneCardMeasurements,
    pruneSaveQueueToIds,
    resetCardEditStates,
    resetCardSelectionState,
    resetMessages,
    resetSaveQueueState,
    saveError,
    scheduleCardSave,
    selectCard,
    sortMode,
    syncCardSelectionState,
  }
}

function expectSetIds(value: unknown, expectedIds: string[]) {
  expect(value).toBeInstanceOf(Set)
  expect(Array.from(value as Set<string>).sort()).toEqual([...expectedIds].sort())
}

describe('useTimecardExportCardWorkspaceActions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('resets save queue, selection, edit states, and measurements together', () => {
    const {
      actions,
      clearCardMeasurements,
      resetCardEditStates,
      resetCardSelectionState,
      resetSaveQueueState,
    } = mountWorkspaceActions()

    actions.resetCardWorkspaceState()

    expect(resetSaveQueueState).toHaveBeenCalledTimes(1)
    expect(resetCardSelectionState).toHaveBeenCalledTimes(1)
    expect(resetCardEditStates).toHaveBeenCalledTimes(1)
    expect(clearCardMeasurements).toHaveBeenCalledTimes(1)
  })

  it('resets page messages and clears the save-error ref', () => {
    const {
      actions,
      resetMessages,
      saveError,
    } = mountWorkspaceActions()

    actions.resetPageAndSaveMessages()

    expect(resetMessages).toHaveBeenCalledTimes(1)
    expect(saveError.value).toBe('')
  })

  it('prunes card UI state to valid ids and syncs selection with sorted cards', () => {
    const first = makeCard({
      id: 'card-b',
      employeeNumber: '2',
      firstName: 'Vince',
      fullName: 'Hintz, Vince',
      lastName: 'Hintz',
    })
    const second = makeCard({
      id: 'card-a',
      employeeNumber: '10',
      firstName: 'CJ',
      fullName: 'Blanchard, CJ',
      lastName: 'Blanchard',
    })
    const {
      actions,
      pruneCardEditStates,
      pruneCardMeasurements,
      pruneSaveQueueToIds,
      syncCardSelectionState,
    } = mountWorkspaceActions({
      sortMode: 'name',
    })

    actions.syncCardUiState([first, second])

    expectSetIds(pruneSaveQueueToIds.mock.calls[0]![0], ['card-a', 'card-b'])
    expectSetIds(pruneCardEditStates.mock.calls[0]![0], ['card-a', 'card-b'])
    expectSetIds(pruneCardMeasurements.mock.calls[0]![0], ['card-a', 'card-b'])
    expect(syncCardSelectionState).toHaveBeenCalledWith(
      [first, second],
      [second, first],
    )
  })

  it('selects, recalculates, and schedules save for workbook changes', () => {
    const card = makeCard()
    const {
      actions,
      scheduleCardSave,
      selectCard,
    } = mountWorkspaceActions()

    actions.handleWorkbookChanged(card)

    expect(selectCard).toHaveBeenCalledWith('card-1')
    expect(card.totals.hoursTotal).toBe(8)
    expect(card.totals.productionTotal).toBe(2)
    expect(scheduleCardSave).toHaveBeenCalledWith(card)
  })

  it('scrolls export cards into view on the next animation frame', () => {
    const element = document.createElement('div')
    element.id = 'timecard-export-card-card-1'
    element.scrollIntoView = vi.fn()
    document.body.appendChild(element)
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const { actions } = mountWorkspaceActions()

    actions.scrollCardIntoView('card-1')

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('locks employee headers only for read-only employee-sourced cards', () => {
    const employeeCard = makeCard({
      id: 'card-1',
      sourceType: 'employee',
    })
    const editableEmployeeCard = makeCard({
      id: 'card-2',
      sourceType: 'employee',
    })
    const customCard = makeCard({
      id: 'card-1',
      sourceType: 'custom',
    })
    const {
      actions,
      isCardReadOnly,
    } = mountWorkspaceActions({
      readOnlyIds: ['card-1'],
    })

    expect(actions.isEmployeeHeaderLocked(employeeCard)).toBe(true)
    expect(actions.isEmployeeHeaderLocked(editableEmployeeCard)).toBe(false)
    expect(actions.isEmployeeHeaderLocked(customCard)).toBe(false)
    expect(isCardReadOnly).toHaveBeenCalledWith('card-1')
    expect(isCardReadOnly).toHaveBeenCalledWith('card-2')
  })
})
