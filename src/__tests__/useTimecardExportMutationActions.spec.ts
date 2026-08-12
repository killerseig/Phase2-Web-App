import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  TimecardExportArchiveCardRecord,
  TimecardExportConfirmAction,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportMutationActions } from '@/features/timecards/useTimecardExportMutationActions'
import {
  deleteTimecardCard,
  deleteTimecardWeek,
  reopenTimecardWeek,
  submitTimecardWeek,
} from '@/services/timecards'
import type { TimecardWeekRecord } from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  deleteTimecardCard: vi.fn(),
  deleteTimecardWeek: vi.fn(),
  reopenTimecardWeek: vi.fn(),
  submitTimecardWeek: vi.fn(),
}))

const deleteTimecardCardMock = vi.mocked(deleteTimecardCard)
const deleteTimecardWeekMock = vi.mocked(deleteTimecardWeek)
const reopenTimecardWeekMock = vi.mocked(reopenTimecardWeek)
const submitTimecardWeekMock = vi.mocked(submitTimecardWeek)

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'user-cj',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
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
    archiveWeekStatus: 'draft',
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
    fullName: 'CJ Blanchard',
    isContractor: false,
    lastName: 'Blanchard',
    lines: [],
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
    wageRate: null,
    ...overrides,
  }
}

function mountMutationActions(options: {
  canEditWeek?: boolean
  canUseTimecardExport?: boolean
} = {}) {
  const actionLoading = ref(false)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const canUseTimecardExport = ref(options.canUseTimecardExport ?? true)
  const timecardExportConfirmAction = ref<TimecardExportConfirmAction | null>(null)
  const calls: string[] = []
  const deleteWeekCache = vi.fn((weekId: string) => {
    calls.push(`delete-cache:${weekId}`)
  })
  const flushPendingSaves = vi.fn(async () => {
    calls.push('flush')
  })
  const resetPageAndSaveMessages = vi.fn(() => {
    calls.push('reset')
  })
  const selectCard = vi.fn((cardId: string) => {
    calls.push(`select:${cardId}`)
  })
  const setPageError = vi.fn()
  const setPageInfo = vi.fn((message: string) => {
    calls.push(`info:${message}`)
  })
  const actions = useTimecardExportMutationActions({
    actionLoading,
    canEditWeek: computed(() => canEditWeek.value),
    deleteWeekCache,
    flushPendingSaves,
    getCanUseTimecardExport: () => canUseTimecardExport.value,
    resetPageAndSaveMessages,
    selectCard,
    setPageError,
    setPageInfo,
    timecardExportConfirmAction,
  })

  return {
    actionLoading,
    actions,
    calls,
    canEditWeek,
    canUseTimecardExport,
    deleteWeekCache,
    flushPendingSaves,
    resetPageAndSaveMessages,
    selectCard,
    setPageError,
    setPageInfo,
    timecardExportConfirmAction,
  }
}

describe('useTimecardExportMutationActions', () => {
  beforeEach(() => {
    deleteTimecardCardMock.mockReset()
    deleteTimecardCardMock.mockResolvedValue()
    deleteTimecardWeekMock.mockReset()
    deleteTimecardWeekMock.mockResolvedValue()
    reopenTimecardWeekMock.mockReset()
    reopenTimecardWeekMock.mockResolvedValue()
    submitTimecardWeekMock.mockReset()
    submitTimecardWeekMock.mockResolvedValue({
      success: true,
      emailSent: true,
      emailMessage: 'Week submitted.',
    })
  })

  it('opens remove-card confirmations only for editable export cards', () => {
    const editable = mountMutationActions()
    editable.actions.handleRemoveCard(makeCard({
      id: 'card-cj',
      archiveWeekEndDate: '2026-06-20',
      archiveWeekId: 'week-shop',
      fullName: 'CJ Blanchard',
    }))

    expect(editable.timecardExportConfirmAction.value).toEqual({
      kind: 'remove-card',
      cardId: 'card-cj',
      cardLabel: 'CJ Blanchard',
      weekEndDate: '6/20/2026',
      weekId: 'week-shop',
    })

    const readOnly = mountMutationActions({ canEditWeek: false })
    readOnly.actions.handleRemoveCard(makeCard())

    expect(readOnly.timecardExportConfirmAction.value).toBeNull()
  })

  it('confirms card removal after selecting the card and flushing pending saves', async () => {
    const {
      actionLoading,
      actions,
      calls,
      flushPendingSaves,
      resetPageAndSaveMessages,
      selectCard,
      setPageInfo,
      timecardExportConfirmAction,
    } = mountMutationActions()

    timecardExportConfirmAction.value = {
      kind: 'remove-card',
      cardId: 'card-cj',
      cardLabel: 'CJ Blanchard',
      weekEndDate: '6/20/2026',
      weekId: 'week-shop',
    }

    await actions.confirmRemoveCard(timecardExportConfirmAction.value)

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(selectCard).toHaveBeenCalledWith('card-cj')
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(deleteTimecardCardMock).toHaveBeenCalledWith('week-shop', 'card-cj')
    expect(setPageInfo).toHaveBeenCalledWith('Removed the timecard.')
    expect(calls).toEqual(['reset', 'select:card-cj', 'flush', 'info:Removed the timecard.'])
    expect(timecardExportConfirmAction.value).toBeNull()
    expect(actionLoading.value).toBe(false)
  })

  it('reports card removal failures and clears loading/confirmation state', async () => {
    deleteTimecardCardMock.mockRejectedValueOnce(new Error('Delete denied'))
    const {
      actionLoading,
      actions,
      setPageError,
      timecardExportConfirmAction,
    } = mountMutationActions()

    timecardExportConfirmAction.value = {
      kind: 'remove-card',
      cardId: 'card-cj',
      cardLabel: 'CJ Blanchard',
      weekEndDate: '6/20/2026',
      weekId: 'week-shop',
    }

    await actions.confirmRemoveCard(timecardExportConfirmAction.value)

    const [errorArg, fallback] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Delete denied')
    expect(fallback).toBe('Failed to remove the timecard.')
    expect(timecardExportConfirmAction.value).toBeNull()
    expect(actionLoading.value).toBe(false)
  })

  it('opens delete-week confirmations only for draft weeks and export-capable users', () => {
    const allowed = mountMutationActions()
    allowed.actions.handleDeleteWeek(makeWeek({
      id: 'week-draft',
      jobCode: '736',
      ownerForemanName: 'CJ Blanchard',
      status: 'draft',
      weekEndDate: '2026-06-20',
    }))

    expect(allowed.timecardExportConfirmAction.value).toEqual({
      kind: 'delete-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    })

    const submitted = mountMutationActions()
    submitted.actions.handleDeleteWeek(makeWeek({ status: 'submitted' }))

    const noPermission = mountMutationActions({ canUseTimecardExport: false })
    noPermission.actions.handleDeleteWeek(makeWeek({ status: 'draft' }))

    expect(submitted.timecardExportConfirmAction.value).toBeNull()
    expect(noPermission.timecardExportConfirmAction.value).toBeNull()
  })

  it('opens submit and reopen confirmations for valid export weeks', () => {
    const submitCase = mountMutationActions()
    submitCase.actions.handleSubmitWeek(makeWeek({
      id: 'week-draft',
      jobCode: '736',
      ownerForemanName: 'CJ Blanchard',
      status: 'draft',
      weekEndDate: '2026-06-20',
    }))

    expect(submitCase.timecardExportConfirmAction.value).toEqual({
      kind: 'submit-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    })

    const reopenCase = mountMutationActions()
    reopenCase.actions.handleReopenWeek(makeWeek({
      id: 'week-submitted',
      jobCode: '736',
      ownerForemanName: 'CJ Blanchard',
      status: 'submitted',
      weekEndDate: '2026-06-20',
    }))

    expect(reopenCase.timecardExportConfirmAction.value).toEqual({
      kind: 'reopen-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-submitted',
      weekLabel: '736 \u2022 CJ Blanchard',
    })

    const invalidSubmit = mountMutationActions()
    invalidSubmit.actions.handleSubmitWeek(makeWeek({ status: 'submitted' }))

    const invalidReopen = mountMutationActions()
    invalidReopen.actions.handleReopenWeek(makeWeek({ status: 'draft' }))

    const noPermission = mountMutationActions({ canUseTimecardExport: false })
    noPermission.actions.handleSubmitWeek(makeWeek({ status: 'draft' }))
    noPermission.actions.handleReopenWeek(makeWeek({ status: 'submitted' }))

    expect(invalidSubmit.timecardExportConfirmAction.value).toBeNull()
    expect(invalidReopen.timecardExportConfirmAction.value).toBeNull()
    expect(noPermission.timecardExportConfirmAction.value).toBeNull()
  })

  it('confirms draft week deletion after flushing pending saves and clearing caches', async () => {
    const {
      actionLoading,
      actions,
      calls,
      deleteWeekCache,
      flushPendingSaves,
      resetPageAndSaveMessages,
      setPageInfo,
      timecardExportConfirmAction,
    } = mountMutationActions()

    timecardExportConfirmAction.value = {
      kind: 'delete-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await actions.confirmDeleteWeek(timecardExportConfirmAction.value)

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(deleteTimecardWeekMock).toHaveBeenCalledWith('week-draft')
    expect(deleteWeekCache).toHaveBeenCalledWith('week-draft')
    expect(setPageInfo).toHaveBeenCalledWith('Draft week deleted.')
    expect(calls).toEqual(['reset', 'flush', 'delete-cache:week-draft', 'info:Draft week deleted.'])
    expect(timecardExportConfirmAction.value).toBeNull()
    expect(actionLoading.value).toBe(false)
  })

  it('reports draft week deletion failures and clears loading/confirmation state', async () => {
    deleteTimecardWeekMock.mockRejectedValueOnce(new Error('Week delete denied'))
    const {
      actionLoading,
      actions,
      setPageError,
      timecardExportConfirmAction,
    } = mountMutationActions()

    timecardExportConfirmAction.value = {
      kind: 'delete-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await actions.confirmDeleteWeek(timecardExportConfirmAction.value)

    const [errorArg, fallback] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Week delete denied')
    expect(fallback).toBe('Failed to delete the draft week.')
    expect(timecardExportConfirmAction.value).toBeNull()
    expect(actionLoading.value).toBe(false)
  })

  it('confirms draft week submission after flushing pending saves', async () => {
    const {
      actionLoading,
      actions,
      calls,
      flushPendingSaves,
      resetPageAndSaveMessages,
      setPageInfo,
      timecardExportConfirmAction,
    } = mountMutationActions()

    timecardExportConfirmAction.value = {
      kind: 'submit-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await actions.confirmSubmitWeek(timecardExportConfirmAction.value)

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(submitTimecardWeekMock).toHaveBeenCalledWith('week-draft')
    expect(setPageInfo).toHaveBeenCalledWith('Week submitted.')
    expect(calls).toEqual(['reset', 'flush', 'info:Week submitted.'])
    expect(timecardExportConfirmAction.value).toBeNull()
    expect(actionLoading.value).toBe(false)
  })

  it('confirms submitted week undo after flushing pending saves', async () => {
    const {
      actionLoading,
      actions,
      calls,
      flushPendingSaves,
      resetPageAndSaveMessages,
      setPageInfo,
      timecardExportConfirmAction,
    } = mountMutationActions()

    timecardExportConfirmAction.value = {
      kind: 'reopen-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-submitted',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await actions.confirmReopenWeek(timecardExportConfirmAction.value)

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(reopenTimecardWeekMock).toHaveBeenCalledWith('week-submitted')
    expect(setPageInfo).toHaveBeenCalledWith('Submitted week moved back to draft.')
    expect(calls).toEqual(['reset', 'flush', 'info:Submitted week moved back to draft.'])
    expect(timecardExportConfirmAction.value).toBeNull()
    expect(actionLoading.value).toBe(false)
  })

  it('reports submit and undo failures and clears loading/confirmation state', async () => {
    submitTimecardWeekMock.mockRejectedValueOnce(new Error('Submit denied'))
    const submitCase = mountMutationActions()
    submitCase.timecardExportConfirmAction.value = {
      kind: 'submit-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await submitCase.actions.confirmSubmitWeek(submitCase.timecardExportConfirmAction.value)

    let [errorArg, fallback] = submitCase.setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Submit denied')
    expect(fallback).toBe('Failed to submit the draft week.')
    expect(submitCase.timecardExportConfirmAction.value).toBeNull()
    expect(submitCase.actionLoading.value).toBe(false)

    reopenTimecardWeekMock.mockRejectedValueOnce(new Error('Undo denied'))
    const reopenCase = mountMutationActions()
    reopenCase.timecardExportConfirmAction.value = {
      kind: 'reopen-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-submitted',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await reopenCase.actions.confirmReopenWeek(reopenCase.timecardExportConfirmAction.value)

    ;[errorArg, fallback] = reopenCase.setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Undo denied')
    expect(fallback).toBe('Failed to undo the submitted week.')
    expect(reopenCase.timecardExportConfirmAction.value).toBeNull()
    expect(reopenCase.actionLoading.value).toBe(false)
  })

  it('dispatches the active confirmation action and ignores empty confirmation state', async () => {
    const removeCase = mountMutationActions()
    removeCase.timecardExportConfirmAction.value = {
      kind: 'remove-card',
      cardId: 'card-cj',
      cardLabel: 'CJ Blanchard',
      weekEndDate: '6/20/2026',
      weekId: 'week-shop',
    }

    await removeCase.actions.confirmTimecardExportAction()

    expect(deleteTimecardCardMock).toHaveBeenCalledWith('week-shop', 'card-cj')

    const deleteWeekCase = mountMutationActions()
    deleteWeekCase.timecardExportConfirmAction.value = {
      kind: 'delete-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await deleteWeekCase.actions.confirmTimecardExportAction()

    expect(deleteTimecardWeekMock).toHaveBeenCalledWith('week-draft')

    const submitWeekCase = mountMutationActions()
    submitWeekCase.timecardExportConfirmAction.value = {
      kind: 'submit-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-draft',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await submitWeekCase.actions.confirmTimecardExportAction()

    expect(submitTimecardWeekMock).toHaveBeenCalledWith('week-draft')

    const reopenWeekCase = mountMutationActions()
    reopenWeekCase.timecardExportConfirmAction.value = {
      kind: 'reopen-week',
      weekEndDate: '6/20/2026',
      weekId: 'week-submitted',
      weekLabel: '736 \u2022 CJ Blanchard',
    }

    await reopenWeekCase.actions.confirmTimecardExportAction()

    expect(reopenTimecardWeekMock).toHaveBeenCalledWith('week-submitted')

    const emptyCase = mountMutationActions()
    await emptyCase.actions.confirmTimecardExportAction()

    expect(emptyCase.flushPendingSaves).not.toHaveBeenCalled()
  })
})
