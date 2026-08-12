import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEmployeeAdminRecords } from '@/features/employees/useEmployeeAdminRecords'
import { useEmployeeAdminViewSync } from '@/features/employees/useEmployeeAdminViewSync'
import { useUserAdminRecords } from '@/features/users/useUserAdminRecords'
import { useUserAdminViewSync } from '@/features/users/useUserAdminViewSync'
import { subscribeEmployees } from '@/services/employees'
import { subscribeVisibleJobs } from '@/services/jobs'
import { subscribeUsers } from '@/services/users'
import type { EmployeeRecord, JobRecord, UserProfile } from '@/types/domain'

vi.mock('@/services/employees', () => ({
  subscribeEmployees: vi.fn(),
}))

vi.mock('@/services/jobs', () => ({
  subscribeVisibleJobs: vi.fn(),
}))

vi.mock('@/services/users', () => ({
  subscribeUsers: vi.fn(),
}))

const subscribeEmployeesMock = vi.mocked(subscribeEmployees)
const subscribeVisibleJobsMock = vi.mocked(subscribeVisibleJobs)
const subscribeUsersMock = vi.mocked(subscribeUsers)

type RecordsListener<TRecord> = {
  onError?: (error: unknown) => void
  onUpdate: (records: TRecord[]) => void
  unsubscribe: ReturnType<typeof vi.fn>
}

const employeeListeners: RecordsListener<EmployeeRecord>[] = []
const jobListeners: RecordsListener<JobRecord>[] = []
const userListeners: RecordsListener<UserProfile>[] = []

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    active: true,
    employeeNumber: '5133',
    firstName: 'CJ',
    id: 'employee-cj',
    isContractor: false,
    jobId: null,
    lastName: 'Blanchard',
    occupation: 'Foreman',
    ...overrides,
  }
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: ['user-cj'],
    code: '736',
    finishDate: '2026-06-30',
    gc: 'Phase 2',
    id: 'job-shop',
    jobAddress: 'Shop',
    name: 'Shop',
    productionBurden: 0.33,
    startDate: '2026-06-01',
    type: 'general',
    ...overrides,
  }
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    active: true,
    assignedJobIds: ['job-shop'],
    email: 'cj.blanchard@phase2co.com',
    firstName: 'CJ',
    id: 'user-cj',
    lastName: 'Blanchard',
    role: 'foreman',
    ...overrides,
  }
}

function installListenerMocks() {
  subscribeEmployeesMock.mockImplementation((onUpdate, onError) => {
    const listener = { onError, onUpdate, unsubscribe: vi.fn() }
    employeeListeners.push(listener)
    return listener.unsubscribe
  })

  subscribeVisibleJobsMock.mockImplementation((_viewer, onUpdate, onError) => {
    const listener = { onError, onUpdate, unsubscribe: vi.fn() }
    jobListeners.push(listener)
    return listener.unsubscribe
  })

  subscribeUsersMock.mockImplementation((onUpdate, onError) => {
    const listener = { onError, onUpdate, unsubscribe: vi.fn() }
    userListeners.push(listener)
    return listener.unsubscribe
  })
}

describe('admin records composables', () => {
  beforeEach(() => {
    employeeListeners.length = 0
    jobListeners.length = 0
    userListeners.length = 0
    subscribeEmployeesMock.mockReset()
    subscribeVisibleJobsMock.mockReset()
    subscribeUsersMock.mockReset()
    installListenerMocks()
  })

  it('subscribes to users and assignable jobs, resets missing selected users, and cleans up listeners', () => {
    const selectedUserId = ref<string | 'new' | null>('user-missing')
    const records = useUserAdminRecords({ selectedUserId })

    records.startUsersSubscription()
    records.startJobsSubscription()

    expect(subscribeUsersMock).toHaveBeenCalledTimes(1)
    expect(subscribeVisibleJobsMock).toHaveBeenCalledWith(undefined, expect.any(Function), expect.any(Function))
    expect(records.usersLoading.value).toBe(true)
    expect(records.jobsLoading.value).toBe(true)

    userListeners[0]!.onUpdate([makeUser()])
    jobListeners[0]!.onUpdate([makeJob()])

    expect(records.users.value.map((user) => user.id)).toEqual(['user-cj'])
    expect(records.jobs.value.map((job) => job.id)).toEqual(['job-shop'])
    expect(selectedUserId.value).toBeNull()
    expect(records.usersLoading.value).toBe(false)
    expect(records.jobsLoading.value).toBe(false)

    selectedUserId.value = 'user-cj'
    records.startUsersSubscription()

    expect(userListeners[0]!.unsubscribe).toHaveBeenCalledTimes(1)

    records.stopUsersSubscription()
    records.stopJobsSubscription()

    expect(userListeners[1]!.unsubscribe).toHaveBeenCalledTimes(1)
    expect(jobListeners[0]!.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('surfaces user and job subscription errors with feature-specific fallback copy', () => {
    const records = useUserAdminRecords({ selectedUserId: ref<string | 'new' | null>(null) })

    records.startUsersSubscription()
    records.startJobsSubscription()

    userListeners[0]!.onError?.({})
    jobListeners[0]!.onError?.({})

    expect(records.usersError.value).toBe('Failed to load users.')
    expect(records.jobsError.value).toBe('Failed to load jobs.')
    expect(records.usersLoading.value).toBe(false)
    expect(records.jobsLoading.value).toBe(false)
  })

  it('subscribes to employees, falls back to create mode when selection disappears, and cleans up', () => {
    const selectedEmployeeId = ref<string | 'new'>('employee-missing')
    const records = useEmployeeAdminRecords({ selectedEmployeeId })

    records.startEmployeesSubscription()

    expect(subscribeEmployeesMock).toHaveBeenCalledTimes(1)
    expect(records.employeesLoading.value).toBe(true)

    employeeListeners[0]!.onUpdate([makeEmployee()])

    expect(records.employees.value.map((employee) => employee.id)).toEqual(['employee-cj'])
    expect(selectedEmployeeId.value).toBe('new')
    expect(records.employeesLoading.value).toBe(false)

    records.stopEmployeesSubscription()

    expect(employeeListeners[0]!.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('surfaces employee subscription errors with feature-specific fallback copy', () => {
    const records = useEmployeeAdminRecords({ selectedEmployeeId: ref<string | 'new'>('new') })

    records.startEmployeesSubscription()
    employeeListeners[0]!.onError?.({})

    expect(records.employeesError.value).toBe('Failed to load employees.')
    expect(records.employeesLoading.value).toBe(false)
  })
})

describe('admin view synchronization composables', () => {
  it('starts and stops user admin subscriptions and reacts to selected user state', async () => {
    const selectedUserId = ref<string | 'new' | null>(null)
    const selectedUserRecord = ref<UserProfile | null>(null)
    const snapshotVersion = ref(0)
    const calls: string[] = []
    const applyUserToDetailForm = vi.fn((user: UserProfile | null) => {
      calls.push(`apply:${user?.id ?? 'none'}`)
    })
    const clearDetailSaveTimer = vi.fn(() => calls.push('clearTimer'))
    const queueDetailSave = vi.fn(() => calls.push('queueSave'))
    const resetCreateForm = vi.fn(() => calls.push('resetCreate'))
    const resetDetailJobSearchTerm = vi.fn(() => calls.push('resetSearch'))
    const setDetailErrorMessage = vi.fn((message: string) => calls.push(`error:${message}`))
    const setDetailInfo = vi.fn((message: string) => calls.push(`info:${message}`))
    const startJobsSubscription = vi.fn(() => calls.push('startJobs'))
    const startUsersSubscription = vi.fn(() => calls.push('startUsers'))
    const stopJobsSubscription = vi.fn(() => calls.push('stopJobs'))
    const stopUsersSubscription = vi.fn(() => calls.push('stopUsers'))

    const Component = defineComponent({
      setup() {
        useUserAdminViewSync({
          applyUserToDetailForm,
          clearDetailSaveTimer,
          getDetailFormSnapshot: () => ({
            active: true,
            assignedJobIds: [],
            firstName: `Version ${snapshotVersion.value}`,
            lastName: 'User',
            role: 'foreman',
          }),
          queueDetailSave,
          resetCreateForm,
          resetDetailJobSearchTerm,
          selectedUser: computed(() => selectedUserRecord.value),
          selectedUserId,
          setDetailErrorMessage,
          setDetailInfo,
          startJobsSubscription,
          startUsersSubscription,
          stopJobsSubscription,
          stopUsersSubscription,
        })

        return () => null
      },
    })

    const wrapper = mount(Component)

    expect(calls).toEqual(['startUsers', 'startJobs'])

    selectedUserId.value = 'user-cj'
    await nextTick()

    expect(clearDetailSaveTimer).toHaveBeenCalledTimes(1)
    expect(setDetailErrorMessage).toHaveBeenLastCalledWith('')
    expect(setDetailInfo).toHaveBeenLastCalledWith('Changes save automatically.')
    expect(resetDetailJobSearchTerm).toHaveBeenCalledTimes(1)

    selectedUserRecord.value = makeUser()
    await nextTick()

    expect(clearDetailSaveTimer).toHaveBeenCalledTimes(2)
    expect(applyUserToDetailForm).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'user-cj' }))

    snapshotVersion.value += 1
    await nextTick()

    expect(queueDetailSave).toHaveBeenCalledTimes(1)

    selectedUserId.value = 'new'
    selectedUserRecord.value = null
    await nextTick()

    expect(resetCreateForm).toHaveBeenCalledTimes(1)
    expect(clearDetailSaveTimer).toHaveBeenCalledTimes(4)
    expect(applyUserToDetailForm).toHaveBeenLastCalledWith(null)

    wrapper.unmount()

    expect(calls.slice(-3)).toEqual(['clearTimer', 'stopUsers', 'stopJobs'])
  })

  it('starts and stops employee admin subscriptions and reacts to selected employee state', async () => {
    const selectedEmployeeId = ref<string | 'new'>('new')
    const selectedEmployeeRecord = ref<EmployeeRecord | null>(null)
    const calls: string[] = []
    const applyEmployeeToDetailForm = vi.fn((employee: EmployeeRecord | null) => {
      calls.push(`apply:${employee?.id ?? 'none'}`)
    })
    const resetCreateForm = vi.fn(() => calls.push('resetCreate'))
    const setDetailErrorMessage = vi.fn((message: string) => calls.push(`error:${message}`))
    const setDetailInfo = vi.fn((message: string) => calls.push(`info:${message}`))
    const startEmployeesSubscription = vi.fn(() => calls.push('startEmployees'))
    const stopEmployeesSubscription = vi.fn(() => calls.push('stopEmployees'))

    const Component = defineComponent({
      setup() {
        useEmployeeAdminViewSync({
          applyEmployeeToDetailForm,
          resetCreateForm,
          selectedEmployee: computed(() => selectedEmployeeRecord.value),
          selectedEmployeeId,
          setDetailErrorMessage,
          setDetailInfo,
          startEmployeesSubscription,
          stopEmployeesSubscription,
        })

        return () => null
      },
    })

    const wrapper = mount(Component)

    expect(calls).toEqual(['startEmployees'])

    selectedEmployeeId.value = 'employee-cj'
    await nextTick()

    expect(setDetailErrorMessage).toHaveBeenLastCalledWith('')
    expect(setDetailInfo).toHaveBeenLastCalledWith('Changes save when you leave a field.')

    selectedEmployeeRecord.value = makeEmployee()
    await nextTick()

    expect(applyEmployeeToDetailForm).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'employee-cj' }))

    selectedEmployeeId.value = 'new'
    selectedEmployeeRecord.value = null
    await nextTick()

    expect(resetCreateForm).toHaveBeenCalledTimes(1)
    expect(setDetailInfo).toHaveBeenLastCalledWith('')
    expect(applyEmployeeToDetailForm).toHaveBeenLastCalledWith(null)

    wrapper.unmount()

    expect(stopEmployeesSubscription).toHaveBeenCalledTimes(1)
    expect(calls[calls.length - 1]).toBe('stopEmployees')
  })
})
