import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { JobTimecardConfirmAction, JobTimecardSortMode } from '@/features/timecards/jobViewHelpers'
import { useJobTimecardCardActions } from '@/features/timecards/useJobTimecardCardActions'
import { deleteTimecardCard, submitTimecardWeek, updateTimecardCard } from '@/services/timecards'
import { createEmptyWorkbookLine } from '@/features/timecards/workbook'
import type { TimecardCardRecord, TimecardWeekRecord, TimecardWorkbookLineRecord } from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  deleteTimecardCard: vi.fn(),
  submitTimecardWeek: vi.fn(),
  updateTimecardCard: vi.fn(),
}))

const deleteTimecardCardMock = vi.mocked(deleteTimecardCard)
const submitTimecardWeekMock = vi.mocked(submitTimecardWeek)
const updateTimecardCardMock = vi.mocked(updateTimecardCard)

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 2,
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    ownerForemanName: 'Vince Hintz',
    ownerForemanUserId: 'foreman-1',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

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
    lines: [],
    notes: '',
    occupation: 'Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 4,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: null,
    ...overrides,
  }
}

function makeLine(
  overrides: Partial<TimecardWorkbookLineRecord> = {},
): TimecardWorkbookLineRecord {
  return {
    ...createEmptyWorkbookLine('2026-06-14'),
    ...overrides,
  }
}

function mountCardActions(options: {
  burdenValue?: number
  canEditWeek?: boolean
  cards?: TimecardCardRecord[]
  selectedWeek?: TimecardWeekRecord | null
  selectedWeekEndDate?: string
  selectedWeekStartDate?: string
  sortMode?: JobTimecardSortMode
} = {}) {
  const actionLoading = ref(false)
  const burdenValue = ref(options.burdenValue ?? 0.33)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [])
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const selectedWeekEndDate = ref(options.selectedWeekEndDate ?? '2026-06-20')
  const selectedWeekStartDate = ref(options.selectedWeekStartDate ?? '2026-06-14')
  const sortMode = ref<JobTimecardSortMode>(options.sortMode ?? 'name')
  const timecardConfirmAction = ref<JobTimecardConfirmAction | null>(null)
  const calls: string[] = []
  const closeTimecardConfirm = vi.fn(() => {
    calls.push('close-confirm')
  })
  const flushPendingSaves = vi.fn(async () => {
    calls.push('flush')
  })
  const resetPageAndSaveMessages = vi.fn(() => {
    calls.push('reset')
  })
  const revealCard = vi.fn((cardId: string) => {
    calls.push(`reveal:${cardId}`)
  })
  const selectCard = vi.fn((cardId: string) => {
    calls.push(`select:${cardId}`)
  })
  const setPageError = vi.fn()
  const setPageErrorMessage = vi.fn((message: string) => {
    calls.push(`error:${message}`)
  })
  const setPageInfo = vi.fn()

  const actions = useJobTimecardCardActions({
    actionLoading,
    burdenValue: computed(() => burdenValue.value),
    canEditWeek: computed(() => canEditWeek.value),
    cards: computed(() => cards.value),
    closeTimecardConfirm,
    flushPendingSaves,
    getSubmitActor: () => ({ userId: 'foreman-1', displayName: 'Vince Hintz' }),
    resetPageAndSaveMessages,
    revealCard,
    selectCard,
    selectedWeek: computed(() => selectedWeek.value),
    selectedWeekEndDate: computed(() => selectedWeekEndDate.value),
    selectedWeekStartDate: computed(() => selectedWeekStartDate.value),
    setPageError,
    setPageErrorMessage,
    setPageInfo,
    sortMode: computed(() => sortMode.value),
    timecardConfirmAction,
  })

  return {
    actionLoading,
    actions,
    burdenValue,
    calls,
    canEditWeek,
    cards,
    closeTimecardConfirm,
    flushPendingSaves,
    resetPageAndSaveMessages,
    revealCard,
    selectedWeek,
    selectedWeekEndDate,
    selectedWeekStartDate,
    selectCard,
    setPageError,
    setPageErrorMessage,
    setPageInfo,
    sortMode,
    timecardConfirmAction,
  }
}

describe('useJobTimecardCardActions', () => {
  beforeEach(() => {
    deleteTimecardCardMock.mockReset()
    deleteTimecardCardMock.mockResolvedValue()
    submitTimecardWeekMock.mockReset()
    submitTimecardWeekMock.mockResolvedValue({
      success: true,
      emailSent: true,
      emailMessage: 'Email queued.',
    })
    updateTimecardCardMock.mockReset()
    updateTimecardCardMock.mockResolvedValue()
  })

  it('opens a delete confirmation for editable selected weeks', () => {
    const {
      actions,
      timecardConfirmAction,
    } = mountCardActions()

    actions.handleRemoveCard(makeCard({ id: 'card-vince', fullName: 'Vince Hintz' }))

    expect(timecardConfirmAction.value).toEqual({
      kind: 'remove-card',
      cardId: 'card-vince',
      cardLabel: 'Vince Hintz',
      weekId: 'week-1',
    })
  })

  it('does not open delete confirmation without an editable selected week', () => {
    const noWeek = mountCardActions({ selectedWeek: null })
    noWeek.actions.handleRemoveCard(makeCard())

    const readOnly = mountCardActions({ canEditWeek: false })
    readOnly.actions.handleRemoveCard(makeCard())

    expect(noWeek.timecardConfirmAction.value).toBeNull()
    expect(readOnly.timecardConfirmAction.value).toBeNull()
  })

  it('confirms card deletion after selecting the card and flushing pending saves', async () => {
    const {
      actionLoading,
      actions,
      calls,
      closeTimecardConfirm,
      flushPendingSaves,
      resetPageAndSaveMessages,
      selectCard,
      setPageInfo,
    } = mountCardActions()

    await actions.confirmRemoveCard({
      kind: 'remove-card',
      cardId: 'card-vince',
      cardLabel: 'Vince Hintz',
      weekId: 'week-1',
    })

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(selectCard).toHaveBeenCalledWith('card-vince')
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(deleteTimecardCardMock).toHaveBeenCalledWith('week-1', 'card-vince')
    expect(setPageInfo).toHaveBeenCalledWith('Removed the timecard.')
    expect(closeTimecardConfirm).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['reset', 'select:card-vince', 'flush', 'close-confirm'])
    expect(actionLoading.value).toBe(false)
  })

  it('reports card deletion failures and still closes the dialog/loading state', async () => {
    deleteTimecardCardMock.mockRejectedValueOnce(new Error('Delete denied'))
    const {
      actionLoading,
      actions,
      closeTimecardConfirm,
      setPageError,
    } = mountCardActions()

    await actions.confirmRemoveCard({
      kind: 'remove-card',
      cardId: 'card-vince',
      cardLabel: 'Vince Hintz',
      weekId: 'week-1',
    })

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Delete denied')
    expect(fallbackMessage).toBe('Failed to remove the timecard.')
    expect(closeTimecardConfirm).toHaveBeenCalledTimes(1)
    expect(actionLoading.value).toBe(false)
  })

  it('sorts cards by last name and persists the new sort indexes', async () => {
    const vince = makeCard({
      id: 'card-vince',
      employeeNumber: '5133',
      firstName: 'Vince',
      fullName: 'Vince Hintz',
      lastName: 'Hintz',
      sortIndex: 5,
    })
    const cj = makeCard({
      id: 'card-cj',
      employeeNumber: '1001',
      firstName: 'CJ',
      fullName: 'CJ Blanchard',
      lastName: 'Blanchard',
      sortIndex: 8,
    })
    const {
      actionLoading,
      actions,
      flushPendingSaves,
      resetPageAndSaveMessages,
      setPageInfo,
    } = mountCardActions({
      cards: [vince, cj],
      sortMode: 'name',
    })

    await actions.handleSortCards()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(cj.sortIndex).toBe(0)
    expect(vince.sortIndex).toBe(1)
    expect(updateTimecardCardMock).toHaveBeenNthCalledWith(
      1,
      'week-1',
      'card-cj',
      '2026-06-14',
      cj,
      0.33,
    )
    expect(updateTimecardCardMock).toHaveBeenNthCalledWith(
      2,
      'week-1',
      'card-vince',
      '2026-06-14',
      vince,
      0.33,
    )
    expect(setPageInfo).toHaveBeenCalledWith('Sorted cards by name.')
    expect(actionLoading.value).toBe(false)
  })

  it('does not sort without an editable selected week or at least two cards', async () => {
    const noWeek = mountCardActions({
      cards: [makeCard(), makeCard({ id: 'card-2' })],
      selectedWeek: null,
    })
    await noWeek.actions.handleSortCards()

    const readOnly = mountCardActions({
      cards: [makeCard(), makeCard({ id: 'card-2' })],
      canEditWeek: false,
    })
    await readOnly.actions.handleSortCards()

    const oneCard = mountCardActions({ cards: [makeCard()] })
    await oneCard.actions.handleSortCards()

    expect(updateTimecardCardMock).not.toHaveBeenCalled()
    expect(noWeek.flushPendingSaves).not.toHaveBeenCalled()
    expect(readOnly.flushPendingSaves).not.toHaveBeenCalled()
    expect(oneCard.flushPendingSaves).not.toHaveBeenCalled()
  })

  it('reports sort failures and resets loading state', async () => {
    updateTimecardCardMock.mockRejectedValueOnce(new Error('Sort denied'))
    const {
      actionLoading,
      actions,
      setPageError,
    } = mountCardActions({
      cards: [
        makeCard({ id: 'card-vince', lastName: 'Hintz' }),
        makeCard({ id: 'card-cj', lastName: 'Blanchard' }),
      ],
    })

    await actions.handleSortCards()

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Sort denied')
    expect(fallbackMessage).toBe('Failed to sort the cards.')
    expect(actionLoading.value).toBe(false)
  })

  it('opens a submit confirmation only when the selected week has cards and is editable', () => {
    const {
      actions,
      timecardConfirmAction,
    } = mountCardActions({
      cards: [makeCard()],
      selectedWeekEndDate: '2026-06-20',
    })

    actions.handleSubmitWeek()

    expect(timecardConfirmAction.value).toEqual({
      kind: 'submit-week',
      weekId: 'week-1',
      weekEndDate: '2026-06-20',
    })

    const noCards = mountCardActions({ cards: [] })
    noCards.actions.handleSubmitWeek()

    const noWeek = mountCardActions({ cards: [makeCard()], selectedWeek: null })
    noWeek.actions.handleSubmitWeek()

    const readOnly = mountCardActions({ cards: [makeCard()], canEditWeek: false })
    readOnly.actions.handleSubmitWeek()

    expect(noCards.timecardConfirmAction.value).toBeNull()
    expect(noWeek.timecardConfirmAction.value).toBeNull()
    expect(readOnly.timecardConfirmAction.value).toBeNull()
  })

  it('blocks submit confirmation and reveals the first incomplete line with hours', () => {
    const incompleteLine = makeLine({ jobNumber: '7539', subsectionArea: '2' })
    incompleteLine.days[1]!.hours = 8
    const {
      actions,
      revealCard,
      setPageErrorMessage,
      timecardConfirmAction,
    } = mountCardActions({
      cards: [makeCard({ id: 'card-vince', lines: [incompleteLine] })],
    })

    actions.handleSubmitWeek()

    expect(timecardConfirmAction.value).toBeNull()
    expect(revealCard).toHaveBeenCalledWith('card-vince')
    expect(setPageErrorMessage).toHaveBeenCalledWith(
      'Vince Hintz, line 1 has hours but is missing Acct. Complete Job #, Area, and Acct on every line with hours before submitting.',
    )
    expect(submitTimecardWeekMock).not.toHaveBeenCalled()
  })

  it('submits the selected week after pending saves flush and reports the email result', async () => {
    const {
      actionLoading,
      actions,
      closeTimecardConfirm,
      flushPendingSaves,
      resetPageAndSaveMessages,
      setPageInfo,
    } = mountCardActions()

    await actions.confirmSubmitWeek({
      kind: 'submit-week',
      weekId: 'week-1',
      weekEndDate: '2026-06-20',
    })

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(submitTimecardWeekMock).toHaveBeenCalledWith(
      'week-1',
      { userId: 'foreman-1', displayName: 'Vince Hintz' },
    )
    expect(setPageInfo).toHaveBeenCalledWith('Email queued.')
    expect(closeTimecardConfirm).toHaveBeenCalledTimes(1)
    expect(actionLoading.value).toBe(false)
  })

  it('revalidates after pending saves flush and does not submit invalid OFF hours', async () => {
    const incompleteLine = makeLine({
      account: '716',
      jobNumber: '',
      offHours: 3,
      subsectionArea: '99',
    })
    const {
      actions,
      closeTimecardConfirm,
      flushPendingSaves,
      revealCard,
      setPageErrorMessage,
    } = mountCardActions({
      cards: [makeCard({ id: 'card-vince', lines: [incompleteLine] })],
    })

    await actions.confirmSubmitWeek({
      kind: 'submit-week',
      weekId: 'week-1',
      weekEndDate: '2026-06-20',
    })

    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(revealCard).toHaveBeenCalledWith('card-vince')
    expect(setPageErrorMessage).toHaveBeenCalledWith(
      'Vince Hintz, line 1 has hours but is missing Job #. Complete Job #, Area, and Acct on every line with hours before submitting.',
    )
    expect(submitTimecardWeekMock).not.toHaveBeenCalled()
    expect(closeTimecardConfirm).toHaveBeenCalledTimes(1)
  })

  it('uses the default submit success message when no email message is returned', async () => {
    submitTimecardWeekMock.mockResolvedValueOnce({
      success: true,
      emailSent: true,
      emailMessage: '',
    })
    const {
      actions,
      setPageInfo,
    } = mountCardActions()

    await actions.confirmSubmitWeek({
      kind: 'submit-week',
      weekId: 'week-1',
      weekEndDate: '2026-06-20',
    })

    expect(setPageInfo).toHaveBeenCalledWith('Week submitted.')
  })

  it('reports submit failures and still closes the dialog/loading state', async () => {
    submitTimecardWeekMock.mockRejectedValueOnce(new Error('Submit denied'))
    const {
      actionLoading,
      actions,
      closeTimecardConfirm,
      setPageError,
    } = mountCardActions()

    await actions.confirmSubmitWeek({
      kind: 'submit-week',
      weekId: 'week-1',
      weekEndDate: '2026-06-20',
    })

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Submit denied')
    expect(fallbackMessage).toBe('Failed to submit the timecard week.')
    expect(closeTimecardConfirm).toHaveBeenCalledTimes(1)
    expect(actionLoading.value).toBe(false)
  })

  it('dispatches the active confirmation action and ignores empty confirmation state', async () => {
    const deleteCase = mountCardActions()
    deleteCase.timecardConfirmAction.value = {
      kind: 'remove-card',
      cardId: 'card-vince',
      cardLabel: 'Vince Hintz',
      weekId: 'week-1',
    }

    await deleteCase.actions.confirmTimecardAction()

    expect(deleteTimecardCardMock).toHaveBeenCalledWith('week-1', 'card-vince')

    const submitCase = mountCardActions()
    submitCase.timecardConfirmAction.value = {
      kind: 'submit-week',
      weekId: 'week-2',
      weekEndDate: '2026-06-27',
    }

    await submitCase.actions.confirmTimecardAction()

    expect(submitTimecardWeekMock).toHaveBeenCalledWith(
      'week-2',
      { userId: 'foreman-1', displayName: 'Vince Hintz' },
    )

    const emptyCase = mountCardActions()
    await emptyCase.actions.confirmTimecardAction()

    expect(emptyCase.flushPendingSaves).not.toHaveBeenCalled()
  })
})
