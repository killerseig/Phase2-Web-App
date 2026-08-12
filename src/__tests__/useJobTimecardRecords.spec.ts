import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobTimecardRecords } from '@/features/timecards/useJobTimecardRecords'
import { subscribeEmployees } from '@/services/employees'
import {
  subscribeTimecardCards,
  subscribeTimecardWeeks,
} from '@/services/timecards'
import type { EmployeeRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

vi.mock('@/services/employees', () => ({
  subscribeEmployees: vi.fn(),
}))

vi.mock('@/services/timecards', () => ({
  subscribeTimecardCards: vi.fn(),
  subscribeTimecardWeeks: vi.fn(),
}))

const subscribeEmployeesMock = vi.mocked(subscribeEmployees)
const subscribeTimecardCardsMock = vi.mocked(subscribeTimecardCards)
const subscribeTimecardWeeksMock = vi.mocked(subscribeTimecardWeeks)

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    active: true,
    employeeNumber: '5133',
    firstName: 'Vince',
    isContractor: false,
    jobId: null,
    lastName: 'Hintz',
    occupation: 'Foreman',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
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

function mountRecords(options: {
  burdenValue?: number
  canManageJobTimecards?: boolean
  currentUserId?: string | null
  jobId?: string
  pendingStateMaps?: ReadonlyArray<Readonly<Record<string, boolean>>>
  selectedWeek?: TimecardWeekRecord | null
  weekSubscriptionMode?: 'all' | 'current-user' | 'submitted-report'
} = {}) {
  const burdenValue = ref(options.burdenValue ?? 0.33)
  const canManageJobTimecards = ref(options.canManageJobTimecards ?? false)
  const currentUserId = ref<string | null>(
    options.currentUserId === undefined ? 'foreman-1' : options.currentUserId,
  )
  const jobId = ref(options.jobId ?? 'job-1')
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const onCardsUpdate = vi.fn()
  const onRecordsError = vi.fn()
  const onWeeksUpdate = vi.fn()
  const getPendingStateMaps = vi.fn(() => options.pendingStateMaps ?? [])

  const records = useJobTimecardRecords({
    getBurdenValue: () => burdenValue.value,
    getCanManageJobTimecards: () => canManageJobTimecards.value,
    getCurrentUserId: () => currentUserId.value,
    getWeekSubscriptionMode: () => options.weekSubscriptionMode ?? 'all',
    getPendingStateMaps,
    getSelectedWeek: () => selectedWeek.value,
    jobId,
    onCardsUpdate,
    onRecordsError,
    onWeeksUpdate,
  })

  return {
    burdenValue,
    canManageJobTimecards,
    currentUserId,
    getPendingStateMaps,
    jobId,
    onCardsUpdate,
    onRecordsError,
    onWeeksUpdate,
    records,
    selectedWeek,
  }
}

describe('useJobTimecardRecords', () => {
  beforeEach(() => {
    subscribeEmployeesMock.mockReset()
    subscribeEmployeesMock.mockReturnValue(vi.fn())
    subscribeTimecardCardsMock.mockReset()
    subscribeTimecardCardsMock.mockReturnValue(vi.fn())
    subscribeTimecardWeeksMock.mockReset()
    subscribeTimecardWeeksMock.mockReturnValue(vi.fn())
  })

  it('loads employees through the shared subscribed-record state', () => {
    const stopEmployees = vi.fn()
    let employeeUpdate!: (employees: EmployeeRecord[]) => void
    subscribeEmployeesMock.mockImplementation((onUpdate) => {
      employeeUpdate = onUpdate
      return stopEmployees
    })
    const {
      records,
    } = mountRecords()
    const employees = [makeEmployee({ id: 'employee-vince' })]

    records.startEmployeesSubscription()

    expect(records.employeesLoading.value).toBe(true)
    expect(subscribeEmployeesMock).toHaveBeenCalledTimes(1)

    employeeUpdate(employees)

    expect(records.employees.value).toEqual(employees)
    expect(records.employeesLoading.value).toBe(false)

    records.stopEmployeesSubscription()

    expect(stopEmployees).toHaveBeenCalledTimes(1)
  })

  it('subscribes to all job weeks for shared assigned-foreman workflows', () => {
    let foremanWeeksUpdate!: (weeks: TimecardWeekRecord[]) => void
    const foremanStop = vi.fn()
    subscribeTimecardWeeksMock.mockImplementationOnce((_, onUpdate) => {
      foremanWeeksUpdate = onUpdate
      return foremanStop
    })
    const foremanRecords = mountRecords({
      canManageJobTimecards: false,
      currentUserId: 'foreman-1',
      jobId: 'job-5229',
      weekSubscriptionMode: 'all',
    })
    const weeks = [makeWeek({ id: 'week-foreman' })]

    foremanRecords.records.startWeeksRecordsSubscription()

    expect(subscribeTimecardWeeksMock).toHaveBeenCalledWith(
      'job-5229',
      expect.any(Function),
      expect.any(Function),
      null,
    )

    foremanWeeksUpdate(weeks)

    expect(foremanRecords.records.weeks.value).toEqual(weeks)
    expect(foremanRecords.records.weeksLoading.value).toBe(false)
    expect(foremanRecords.onWeeksUpdate).toHaveBeenCalledTimes(1)

    let managerWeeksUpdate!: (weeks: TimecardWeekRecord[]) => void
    const managerStop = vi.fn()
    subscribeTimecardWeeksMock.mockImplementationOnce((_, onUpdate) => {
      managerWeeksUpdate = onUpdate
      return managerStop
    })
    const managerRecords = mountRecords({
      canManageJobTimecards: true,
      currentUserId: 'admin-1',
      jobId: 'job-5229',
    })

    managerRecords.records.startWeeksRecordsSubscription()

    expect(subscribeTimecardWeeksMock).toHaveBeenLastCalledWith(
      'job-5229',
      expect.any(Function),
      expect.any(Function),
      null,
    )

    managerWeeksUpdate([makeWeek({ id: 'week-admin' })])
    managerRecords.records.stopWeeksRecordsSubscription()

    expect(managerRecords.records.weeks.value[0]?.id).toBe('week-admin')
    expect(managerStop).toHaveBeenCalledTimes(1)
    foremanRecords.records.stopWeeksRecordsSubscription()
    expect(foremanStop).toHaveBeenCalledTimes(1)
  })

  it('does not start a week subscription when no job id is available', () => {
    const {
      records,
    } = mountRecords({ jobId: '' })

    records.startWeeksRecordsSubscription()

    expect(subscribeTimecardWeeksMock).not.toHaveBeenCalled()
  })

  it('does not query current-user weeks until the foreman uid is available', () => {
    const {
      onWeeksUpdate,
      records,
    } = mountRecords({
      canManageJobTimecards: false,
      currentUserId: null,
      jobId: 'job-5229',
      weekSubscriptionMode: 'current-user',
    })

    records.startWeeksRecordsSubscription()

    expect(subscribeTimecardWeeksMock).not.toHaveBeenCalled()
    expect(records.weeks.value).toEqual([])
    expect(records.weeksLoading.value).toBe(false)
    expect(onWeeksUpdate).toHaveBeenCalledTimes(1)
  })

  it('subscribes only to submitted job weeks for reporting-only users', () => {
    let reportWeeksUpdate!: (weeks: TimecardWeekRecord[]) => void
    subscribeTimecardWeeksMock.mockImplementationOnce((_, onUpdate) => {
      reportWeeksUpdate = onUpdate
      return vi.fn()
    })
    const {
      currentUserId,
      records,
    } = mountRecords({
      currentUserId: 'pm-1',
      jobId: 'job-5229',
      weekSubscriptionMode: 'submitted-report',
    })
    const submittedWeeks = [
      makeWeek({ id: 'week-submitted', status: 'submitted', ownerForemanUserId: 'foreman-1' }),
    ]

    records.startWeeksRecordsSubscription()

    expect(subscribeTimecardWeeksMock).toHaveBeenCalledWith(
      'job-5229',
      expect.any(Function),
      expect.any(Function),
      null,
      'submitted',
    )

    reportWeeksUpdate(submittedWeeks)

    expect(records.weeks.value).toEqual(submittedWeeks)
    expect(currentUserId.value).toBe('pm-1')
  })

  it('loads selected-week cards and protects locally pending cards from remote echoes', () => {
    let cardUpdate!: (cards: TimecardCardRecord[]) => void
    const stopCards = vi.fn()
    subscribeTimecardCardsMock.mockImplementation((_, __, ___, onUpdate) => {
      cardUpdate = onUpdate
      return stopCards
    })
    const selectedWeek = makeWeek({
      id: 'week-5229',
      weekStartDate: '2026-06-21',
    })
    const {
      getPendingStateMaps,
      onCardsUpdate,
      records,
    } = mountRecords({
      burdenValue: 0.42,
      pendingStateMaps: [{ 'card-pending': true }],
      selectedWeek,
    })
    const localPendingCard = makeCard({
      id: 'card-pending',
      notes: 'Local note still saving',
    })
    records.cards.value = [localPendingCard]
    const remotePendingEcho = makeCard({
      id: 'card-pending',
      notes: 'Older remote note',
    })
    const remoteCleanCard = makeCard({
      id: 'card-clean',
      notes: 'Remote clean note',
    })

    records.startCardsRecordsSubscription()

    expect(records.cardsLoading.value).toBe(true)
    expect(subscribeTimecardCardsMock).toHaveBeenCalledWith(
      'week-5229',
      '2026-06-21',
      0.42,
      expect.any(Function),
      expect.any(Function),
    )

    cardUpdate([remotePendingEcho, remoteCleanCard])

    expect(getPendingStateMaps).toHaveBeenCalledTimes(1)
    expect(records.cards.value).toEqual([localPendingCard, remoteCleanCard])
    expect(records.cardsLoading.value).toBe(false)
    expect(onCardsUpdate).toHaveBeenCalledWith([localPendingCard, remoteCleanCard])

    records.stopCardsRecordsSubscription()

    expect(stopCards).toHaveBeenCalledTimes(1)
  })

  it('does not start a card subscription when no week is selected', () => {
    const {
      records,
    } = mountRecords({ selectedWeek: null })

    records.startCardsRecordsSubscription()

    expect(subscribeTimecardCardsMock).not.toHaveBeenCalled()
  })

  it('forwards subscription errors with the feature fallback copy', () => {
    let employeeError!: (error: unknown) => void
    subscribeEmployeesMock.mockImplementation((_, onError) => {
      employeeError = onError!
      return vi.fn()
    })
    let weeksError!: (error: unknown) => void
    subscribeTimecardWeeksMock.mockImplementation((_, __, onError) => {
      weeksError = onError!
      return vi.fn()
    })
    let cardsError!: (error: unknown) => void
    subscribeTimecardCardsMock.mockImplementation((_, __, ___, ____, onError) => {
      cardsError = onError!
      return vi.fn()
    })
    const {
      onRecordsError,
      records,
    } = mountRecords()
    const employeeFailure = new Error('Employees denied')
    const weekFailure = new Error('Weeks denied')
    const cardFailure = new Error('Cards denied')

    records.startEmployeesSubscription()
    records.startWeeksRecordsSubscription()
    records.startCardsRecordsSubscription()

    employeeError(employeeFailure)
    weeksError(weekFailure)
    cardsError(cardFailure)

    expect(onRecordsError).toHaveBeenNthCalledWith(
      1,
      'Failed to load employees. Employees denied',
      'Failed to load employees.',
    )
    expect(onRecordsError).toHaveBeenNthCalledWith(
      2,
      'Failed to load timecard weeks. Weeks denied',
      'Failed to load timecard weeks.',
    )
    expect(onRecordsError).toHaveBeenNthCalledWith(
      3,
      'Failed to load timecard cards. Cards denied',
      'Failed to load timecard cards.',
    )
    expect(records.employeesLoading.value).toBe(false)
    expect(records.weeksLoading.value).toBe(false)
    expect(records.cardsLoading.value).toBe(false)
  })

  it('does not block the timecard workspace for transient card deadline errors', () => {
    let cardsError!: (error: unknown) => void
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    subscribeTimecardCardsMock.mockImplementation((_, __, ___, ____, onError) => {
      cardsError = onError!
      return vi.fn()
    })
    const {
      onRecordsError,
      records,
    } = mountRecords()
    const transientError = Object.assign(new Error('deadline-exceeded'), {
      code: 'deadline-exceeded',
    })

    records.startCardsRecordsSubscription()
    cardsError(transientError)

    expect(onRecordsError).not.toHaveBeenCalled()
    expect(records.cardsLoading.value).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      '[timecards] Timecard card listener deadline exceeded; keeping the workspace usable.',
      transientError,
    )

    warnSpy.mockRestore()
  })
})
