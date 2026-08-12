import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobTimecardWeekActions } from '@/features/timecards/useJobTimecardWeekActions'
import { ensureTimecardWeek } from '@/services/timecards'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  ensureTimecardWeek: vi.fn(),
}))

const ensureTimecardWeekMock = vi.mocked(ensureTimecardWeek)

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '5229',
    gc: 'Lucky 3',
    name: 'Lucky 3 Ranch',
    type: 'general',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 0,
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

function mountWeekActions(options: {
  canCreateWeeks?: boolean
  cards?: TimecardCardRecord[]
  ensuringWeek?: boolean
  job?: JobRecord | null
  jobId?: string | null
  selectedWeek?: TimecardWeekRecord | null
  selectedWeekEndDate?: string
  selectedWeekId?: string | null
  weeksLoading?: boolean
} = {}) {
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [])
  const canCreateWeeks = ref(options.canCreateWeeks ?? true)
  const ensuringWeek = ref(options.ensuringWeek ?? false)
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? null : options.selectedWeek,
  )
  const selectedWeekEndDate = ref(options.selectedWeekEndDate ?? '2026-06-20')
  const selectedWeekId = ref<string | null>(options.selectedWeekId ?? null)
  const weeksLoading = ref(options.weeksLoading ?? false)
  const calls: string[] = []
  const closeCreateTray = vi.fn(() => {
    calls.push('close')
  })
  const flushPendingSaves = vi.fn(async () => {
    calls.push('flush')
  })
  const resetPageAndSaveMessages = vi.fn(() => {
    calls.push('reset')
  })
  const setPageError = vi.fn()
  const setPageInfo = vi.fn()

  const actions = useJobTimecardWeekActions({
    cards: computed(() => cards.value),
    closeCreateTray,
    ensuringWeek,
    flushPendingSaves,
    getCanCreateWeeks: () => canCreateWeeks.value,
    getCurrentUserId: () => 'foreman-1',
    getDisplayName: () => 'Vince Hintz',
    job: computed(() => job.value),
    jobId: computed(() => jobId.value),
    resetPageAndSaveMessages,
    selectedWeek: computed(() => selectedWeek.value),
    selectedWeekEndDate,
    selectedWeekId,
    setPageError,
    setPageInfo,
    weeksLoading: computed(() => weeksLoading.value),
  })

  return {
    actions,
    calls,
    canCreateWeeks,
    cards,
    closeCreateTray,
    ensuringWeek,
    flushPendingSaves,
    job,
    jobId,
    resetPageAndSaveMessages,
    selectedWeek,
    selectedWeekEndDate,
    selectedWeekId,
    setPageError,
    setPageInfo,
    weeksLoading,
  }
}

describe('useJobTimecardWeekActions', () => {
  beforeEach(() => {
    ensureTimecardWeekMock.mockReset()
    ensureTimecardWeekMock.mockResolvedValue('created-week')
  })

  it('opens a new week only after pending saves flush and the create tray closes', async () => {
    const {
      actions,
      calls,
      closeCreateTray,
      ensuringWeek,
      flushPendingSaves,
      resetPageAndSaveMessages,
      selectedWeekId,
      setPageInfo,
    } = mountWeekActions()

    await actions.handleCreateWeek()

    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(closeCreateTray).toHaveBeenCalledTimes(1)
    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['flush', 'close', 'reset'])
    expect(ensureTimecardWeekMock).toHaveBeenCalledWith({
      jobId: 'job-1',
      jobCode: '5229',
      jobName: 'Lucky 3 Ranch',
      ownerForemanUserId: 'foreman-1',
      ownerForemanName: 'Vince Hintz',
      weekEndDate: '2026-06-20',
    })
    expect(selectedWeekId.value).toBe('created-week')
    expect(setPageInfo).toHaveBeenCalledWith('Timecard week opened.')
    expect(ensuringWeek.value).toBe(false)
  })

  it('selects an existing week without creating or flushing', async () => {
    const {
      actions,
      closeCreateTray,
      flushPendingSaves,
      selectedWeekId,
    } = mountWeekActions({
      selectedWeek: makeWeek({ id: 'existing-week' }),
    })

    await actions.handleCreateWeek()

    expect(selectedWeekId.value).toBe('existing-week')
    expect(ensureTimecardWeekMock).not.toHaveBeenCalled()
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(closeCreateTray).not.toHaveBeenCalled()
  })

  it('requires a job and week ending date before creating a week', async () => {
    const noJob = mountWeekActions({ jobId: null })
    await noJob.actions.handleCreateWeek()

    const noDate = mountWeekActions({ selectedWeekEndDate: '' })
    await noDate.actions.handleCreateWeek()

    expect(ensureTimecardWeekMock).not.toHaveBeenCalled()
    expect(noJob.setPageError).toHaveBeenCalledWith(
      'Choose a week ending date before creating a week.',
      'Choose a week ending date before creating a week.',
    )
    expect(noDate.setPageError).toHaveBeenCalledWith(
      'Choose a week ending date before creating a week.',
      'Choose a week ending date before creating a week.',
    )
  })

  it('does not create weeks for reporting-only users', async () => {
    const {
      actions,
      closeCreateTray,
      flushPendingSaves,
      setPageError,
    } = mountWeekActions({ canCreateWeeks: false })

    await actions.handleCreateWeek()

    expect(ensureTimecardWeekMock).not.toHaveBeenCalled()
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(closeCreateTray).not.toHaveBeenCalled()
    expect(setPageError).toHaveBeenCalledWith(
      'You can view submitted timecards for this job, but cannot create or edit weeks.',
      'You can view submitted timecards for this job, but cannot create or edit weeks.',
    )
  })

  it('ignores duplicate create requests while a week ensure is already running', async () => {
    const {
      actions,
      closeCreateTray,
      flushPendingSaves,
    } = mountWeekActions({ ensuringWeek: true })

    await actions.handleCreateWeek()

    expect(ensureTimecardWeekMock).not.toHaveBeenCalled()
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(closeCreateTray).not.toHaveBeenCalled()
  })

  it('reports create failures and clears loading so the user can retry', async () => {
    ensureTimecardWeekMock
      .mockRejectedValueOnce(new Error('Week denied'))
      .mockResolvedValueOnce('retry-week')
    const {
      actions,
      ensuringWeek,
      selectedWeekId,
      setPageError,
    } = mountWeekActions()

    await actions.handleCreateWeek()

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Week denied')
    expect(fallbackMessage).toBe('Failed to open the timecard week.')
    expect(ensuringWeek.value).toBe(false)

    await actions.handleCreateWeek()

    expect(ensureTimecardWeekMock).toHaveBeenCalledTimes(2)
    expect(selectedWeekId.value).toBe('retry-week')
  })

  it('backfills an empty selected draft week without disturbing the create tray or page info', async () => {
    const {
      actions,
      closeCreateTray,
      ensuringWeek,
      flushPendingSaves,
      resetPageAndSaveMessages,
      setPageInfo,
    } = mountWeekActions({
      selectedWeek: makeWeek({ employeeCardCount: 0, status: 'draft' }),
    })

    await actions.maybeBackfillSelectedDraftWeek()

    expect(ensureTimecardWeekMock).toHaveBeenCalledWith({
      jobId: 'job-1',
      jobCode: '5229',
      jobName: 'Lucky 3 Ranch',
      ownerForemanUserId: 'foreman-1',
      ownerForemanName: 'Vince Hintz',
      weekEndDate: '2026-06-20',
    })
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(closeCreateTray).not.toHaveBeenCalled()
    expect(resetPageAndSaveMessages).not.toHaveBeenCalled()
    expect(setPageInfo).not.toHaveBeenCalled()
    expect(ensuringWeek.value).toBe(false)
  })

  it('does not backfill submitted, populated, loading, or unselected weeks', async () => {
    const reportingOnly = mountWeekActions({
      canCreateWeeks: false,
      selectedWeek: makeWeek({ employeeCardCount: 0, status: 'draft' }),
    })
    await reportingOnly.actions.maybeBackfillSelectedDraftWeek()

    const submitted = mountWeekActions({
      selectedWeek: makeWeek({ status: 'submitted' }),
    })
    await submitted.actions.maybeBackfillSelectedDraftWeek()

    const counted = mountWeekActions({
      selectedWeek: makeWeek({ employeeCardCount: 2 }),
    })
    await counted.actions.maybeBackfillSelectedDraftWeek()

    const withCards = mountWeekActions({
      cards: [makeCard()],
      selectedWeek: makeWeek({ employeeCardCount: 0 }),
    })
    await withCards.actions.maybeBackfillSelectedDraftWeek()

    const loading = mountWeekActions({
      selectedWeek: makeWeek({ employeeCardCount: 0 }),
      weeksLoading: true,
    })
    await loading.actions.maybeBackfillSelectedDraftWeek()

    const noSelection = mountWeekActions({ selectedWeek: null })
    await noSelection.actions.maybeBackfillSelectedDraftWeek()

    expect(ensureTimecardWeekMock).not.toHaveBeenCalled()
  })

  it('reports backfill failures and clears loading state', async () => {
    ensureTimecardWeekMock.mockRejectedValueOnce(new Error('Rollover denied'))
    const {
      actions,
      ensuringWeek,
      setPageError,
    } = mountWeekActions({
      selectedWeek: makeWeek({ employeeCardCount: 0, status: 'draft' }),
    })

    await actions.maybeBackfillSelectedDraftWeek()

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Rollover denied')
    expect(fallbackMessage).toBe('Failed to roll over the timecard week.')
    expect(ensuringWeek.value).toBe(false)
  })
})
