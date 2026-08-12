import { ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { useTimecardExportSubscriptions } from '@/features/timecards/useTimecardExportSubscriptions'
import { subscribeEmployees } from '@/services/employees'
import { subscribeAllTimecardWeeks } from '@/services/timecards'
import { subscribeUsers } from '@/services/users'
import type { EmployeeRecord, TimecardWeekRecord, UserProfile } from '@/types/domain'

vi.mock('@/composables/useSubscribedRecords', () => ({
  useSubscribedRecords: vi.fn(),
}))

vi.mock('@/services/employees', () => ({
  subscribeEmployees: vi.fn(),
}))

vi.mock('@/services/timecards', () => ({
  subscribeAllTimecardWeeks: vi.fn(),
}))

vi.mock('@/services/users', () => ({
  subscribeUsers: vi.fn(),
}))

interface MockSubscribedRecords<TRecord> {
  error: Ref<string>
  loading: Ref<boolean>
  options?: {
    errorMessage: string
    onError?: (error: unknown) => void
  }
  records: Ref<TRecord[]>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  subscriber?: unknown
}

const useSubscribedRecordsMock = vi.mocked(useSubscribedRecords)

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'foreman-cj',
    status: 'submitted',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    active: true,
    employeeNumber: '5133',
    firstName: 'CJ',
    isContractor: false,
    jobId: null,
    lastName: 'Blanchard',
    occupation: 'Shop Foreman',
    ...overrides,
  }
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'foreman-cj',
    active: true,
    assignedJobIds: ['job-shop'],
    email: 'cj.blanchard@phase2co.com',
    firstName: 'CJ',
    lastName: 'Blanchard',
    role: 'foreman',
    ...overrides,
  }
}

function makeSubscription<TRecord>(
  records: TRecord[] = [],
  loading = true,
): MockSubscribedRecords<TRecord> {
  return {
    error: ref(''),
    loading: ref(loading),
    records: ref(records) as Ref<TRecord[]>,
    start: vi.fn(),
    stop: vi.fn(),
  }
}

function mountSubscriptions(options: {
  canUseTimecardExport?: boolean
  employees?: EmployeeRecord[]
  employeesLoading?: boolean
  users?: UserProfile[]
  weeks?: TimecardWeekRecord[]
} = {}) {
  const canUseTimecardExport = ref(options.canUseTimecardExport ?? true)
  const setPageError = vi.fn()
  const weeksSubscription = makeSubscription(options.weeks ?? [makeWeek()])
  const employeesSubscription = makeSubscription(
    options.employees ?? [makeEmployee()],
    options.employeesLoading ?? true,
  )
  const usersSubscription = makeSubscription(options.users ?? [makeUser()])
  const subscriptions = [
    weeksSubscription,
    employeesSubscription,
    usersSubscription,
  ]

  useSubscribedRecordsMock.mockImplementation(((subscriber: unknown, subscriptionOptions: unknown) => {
    const subscription = subscriptions.shift()
    if (!subscription) {
      throw new Error('Unexpected useSubscribedRecords call.')
    }

    subscription.subscriber = subscriber
    subscription.options = subscriptionOptions as MockSubscribedRecords<unknown>['options']
    return subscription
  }) as typeof useSubscribedRecords)

  const state = useTimecardExportSubscriptions({
    getCanUseTimecardExport: () => canUseTimecardExport.value,
    setPageError,
  })

  return {
    canUseTimecardExport,
    employeesSubscription,
    setPageError,
    state,
    usersSubscription,
    weeksSubscription,
  }
}

describe('useTimecardExportSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSubscribedRecordsMock.mockReset()
  })

  it('wires saved-week, employee, and foreman subscriptions with feature-specific errors', () => {
    const {
      employeesSubscription,
      setPageError,
      usersSubscription,
      weeksSubscription,
    } = mountSubscriptions()

    expect(useSubscribedRecordsMock).toHaveBeenCalledTimes(3)
    expect(weeksSubscription.subscriber).toBe(subscribeAllTimecardWeeks)
    expect(employeesSubscription.subscriber).toBe(subscribeEmployees)
    expect(usersSubscription.subscriber).toBe(subscribeUsers)
    expect(weeksSubscription.options?.errorMessage).toBe('Failed to load saved timecard weeks.')
    expect(employeesSubscription.options?.errorMessage).toBe('Failed to load employees.')
    expect(usersSubscription.options?.errorMessage).toBe('Failed to load foremen.')

    const weeksError = new Error('weeks failed')
    const employeesError = new Error('employees failed')
    const usersError = new Error('users failed')
    weeksSubscription.options?.onError?.(weeksError)
    employeesSubscription.options?.onError?.(employeesError)
    usersSubscription.options?.onError?.(usersError)

    expect(setPageError).toHaveBeenNthCalledWith(1, weeksError, 'Failed to load saved timecard weeks.')
    expect(setPageError).toHaveBeenNthCalledWith(2, employeesError, 'Failed to load employees.')
    expect(setPageError).toHaveBeenNthCalledWith(3, usersError, 'Failed to load foremen.')
  })

  it('starts and stops the saved-week archive subscription independently of export permission', () => {
    const {
      state,
      weeksSubscription,
    } = mountSubscriptions({
      canUseTimecardExport: false,
    })

    state.subscribeWeeksForArchive()
    state.stopWeeksSubscription()

    expect(weeksSubscription.start).toHaveBeenCalledTimes(1)
    expect(weeksSubscription.stop).toHaveBeenCalledTimes(1)
  })

  it('starts employees and users subscriptions when Timecard Export is allowed', () => {
    const {
      employeesSubscription,
      state,
      usersSubscription,
    } = mountSubscriptions({
      canUseTimecardExport: true,
    })

    state.subscribeEmployeesForExport()
    state.subscribeUsersForExport()

    expect(employeesSubscription.start).toHaveBeenCalledTimes(1)
    expect(employeesSubscription.stop).not.toHaveBeenCalled()
    expect(usersSubscription.start).toHaveBeenCalledTimes(1)
    expect(usersSubscription.stop).not.toHaveBeenCalled()
    expect(state.employees.value).toEqual([makeEmployee()])
    expect(state.users.value).toEqual([makeUser()])
  })

  it('stops and clears employees when Timecard Export access is denied', () => {
    const {
      employeesSubscription,
      state,
    } = mountSubscriptions({
      canUseTimecardExport: false,
      employees: [makeEmployee({ id: 'employee-existing' })],
      employeesLoading: true,
    })

    state.subscribeEmployeesForExport()

    expect(employeesSubscription.stop).toHaveBeenCalledTimes(1)
    expect(employeesSubscription.start).not.toHaveBeenCalled()
    expect(state.employees.value).toEqual([])
    expect(state.employeesLoading.value).toBe(false)
  })

  it('stops and clears foreman users when Timecard Export access is denied', () => {
    const {
      state,
      usersSubscription,
    } = mountSubscriptions({
      canUseTimecardExport: false,
      users: [makeUser({ id: 'foreman-existing' })],
    })

    state.subscribeUsersForExport()

    expect(usersSubscription.stop).toHaveBeenCalledTimes(1)
    expect(usersSubscription.start).not.toHaveBeenCalled()
    expect(state.users.value).toEqual([])
  })

  it('uses the latest Timecard Export permission each time gated subscriptions start', () => {
    const {
      canUseTimecardExport,
      employeesSubscription,
      state,
      usersSubscription,
    } = mountSubscriptions({
      canUseTimecardExport: false,
    })

    state.subscribeEmployeesForExport()
    state.subscribeUsersForExport()
    canUseTimecardExport.value = true
    state.subscribeEmployeesForExport()
    state.subscribeUsersForExport()

    expect(employeesSubscription.stop).toHaveBeenCalledTimes(1)
    expect(employeesSubscription.start).toHaveBeenCalledTimes(1)
    expect(usersSubscription.stop).toHaveBeenCalledTimes(1)
    expect(usersSubscription.start).toHaveBeenCalledTimes(1)
  })
})
