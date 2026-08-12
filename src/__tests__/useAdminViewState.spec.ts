import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  shouldShowEmployeeDetailSuccessToast,
  useEmployeeAdminViewState,
} from '@/features/employees/useEmployeeAdminViewState'
import {
  shouldShowUserDetailSuccessToast,
  useUserAdminViewState,
} from '@/features/users/useUserAdminViewState'
import type { EmployeeRecord, JobRecord, UserProfile } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    active: true,
    assignedJobIds: [],
    email: 'cj.blanchard@phase2co.com',
    firstName: 'CJ',
    id: 'user-cj',
    lastName: 'Blanchard',
    role: 'foreman',
    ...overrides,
  }
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: [],
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

describe('useUserAdminViewState', () => {
  it('derives filtered users, selected user state, pending invite counts, and delete copy', () => {
    const users = ref<UserProfile[]>([
      makeUser({ inviteStatus: 'pending' }),
      makeUser({
        active: false,
        email: 'alison@example.com',
        firstName: 'Alison',
        id: 'user-alison',
        inviteStatus: 'pending',
        lastName: 'Larsen',
        role: 'admin',
      }),
      makeUser({
        email: null,
        firstName: 'Rocky',
        id: 'user-rocky',
        inviteStatus: 'pending',
        lastName: 'Rodriguez',
        role: 'project-manager',
      }),
    ])
    const jobs = ref<JobRecord[]>([])
    const searchTerm = ref('foreman')
    const statusFilter = ref<DirectoryStatusFilter>('active')
    const selectedUserId = ref<string | 'new' | null>('user-cj')

    const state = useUserAdminViewState({
      createJobSearchTerm: ref(''),
      currentUserId: ref('user-cj'),
      detailJobSearchTerm: ref(''),
      jobs,
      searchTerm,
      selectedUserId,
      statusFilter,
      users,
    })

    expect(state.filteredUsers.value.map((user) => user.id)).toEqual(['user-cj'])
    expect(state.selectedUser.value?.id).toBe('user-cj')
    expect(state.isCreateMode.value).toBe(false)
    expect(state.editingSelf.value).toBe(true)
    expect(state.pendingInviteCount.value).toBe(1)
    expect(state.pendingInviteUsers.value.map((user) => user.id)).toEqual(['user-cj'])
    expect(state.deleteUserConfirmMessage.value).toBe(
      'Delete CJ Blanchard? This removes the user from Auth and Firestore.',
    )

    searchTerm.value = 'admin'
    statusFilter.value = 'inactive'

    expect(state.filteredUsers.value.map((user) => user.id)).toEqual(['user-alison'])

    selectedUserId.value = 'new'

    expect(state.isCreateMode.value).toBe(true)
    expect(state.selectedUser.value).toBeNull()
    expect(state.deleteUserConfirmMessage.value).toBe('')
  })

  it('derives active job assignment options from search terms', () => {
    const state = useUserAdminViewState({
      createJobSearchTerm: ref('lucky'),
      currentUserId: ref(null),
      detailJobSearchTerm: ref('736'),
      jobs: ref([
        makeJob(),
        makeJob({ code: '5229', id: 'job-lucky', name: 'Lucky 3 Ranch' }),
        makeJob({ active: false, code: '9999', id: 'job-archived', name: 'Archived Job' }),
      ]),
      searchTerm: ref(''),
      selectedUserId: ref(null),
      statusFilter: ref<DirectoryStatusFilter>('both'),
      users: ref([]),
    })

    expect(state.activeJobs.value.map((job) => job.id)).toEqual(['job-shop', 'job-lucky'])
    expect(state.filteredCreateJobs.value.map((job) => job.id)).toEqual(['job-lucky'])
    expect(state.filteredDetailJobs.value.map((job) => job.id)).toEqual(['job-shop'])
    expect(shouldShowUserDetailSuccessToast('Changes save automatically.')).toBe(false)
    expect(shouldShowUserDetailSuccessToast('Saving changes...')).toBe(false)
    expect(shouldShowUserDetailSuccessToast('All changes saved.')).toBe(false)
    expect(shouldShowUserDetailSuccessToast('User saved.')).toBe(true)
  })
})

describe('useEmployeeAdminViewState', () => {
  it('derives filtered employees, selected employee state, status counts, suggestions, and delete copy', () => {
    const employees = ref<EmployeeRecord[]>([
      makeEmployee(),
      makeEmployee({
        active: false,
        employeeNumber: '7001',
        firstName: 'Vince',
        id: 'employee-vince',
        lastName: 'Hintz',
        occupation: 'Superintendent',
      }),
      makeEmployee({
        employeeNumber: '9001',
        firstName: 'Rocky',
        id: 'employee-rocky',
        isContractor: true,
        lastName: 'Rodriguez',
        occupation: 'Foreman',
      }),
    ])
    const searchTerm = ref('foreman')
    const statusFilter = ref<DirectoryStatusFilter>('active')
    const selectedEmployeeId = ref<string | 'new'>('employee-cj')

    const state = useEmployeeAdminViewState({
      employees,
      searchTerm,
      selectedEmployeeId,
      statusFilter,
    })

    expect(state.filteredEmployees.value.map((employee) => employee.id)).toEqual([
      'employee-cj',
      'employee-rocky',
    ])
    expect(state.selectedEmployee.value?.id).toBe('employee-cj')
    expect(state.isCreateMode.value).toBe(false)
    expect(state.employeeStatusCounts.value).toEqual({ active: 2, inactive: 1 })
    expect(state.activeEmployeesCount.value).toBe(2)
    expect(state.inactiveEmployeesCount.value).toBe(1)
    expect(state.occupationSuggestions.value).toEqual(['Foreman', 'Superintendent'])
    expect(state.deleteEmployeeConfirmMessage.value).toBe(
      'Delete CJ Blanchard from the employee directory? This will not remove them from historical records.',
    )

    statusFilter.value = 'inactive'
    searchTerm.value = 'super'

    expect(state.filteredEmployees.value.map((employee) => employee.id)).toEqual(['employee-vince'])

    selectedEmployeeId.value = 'new'

    expect(state.isCreateMode.value).toBe(true)
    expect(state.selectedEmployee.value).toBeNull()
    expect(state.deleteEmployeeConfirmMessage.value).toBe('')
    expect(shouldShowEmployeeDetailSuccessToast('Changes save when you leave a field.')).toBe(false)
    expect(shouldShowEmployeeDetailSuccessToast('Saving changes...')).toBe(false)
    expect(shouldShowEmployeeDetailSuccessToast('All changes saved.')).toBe(false)
    expect(shouldShowEmployeeDetailSuccessToast('Employee saved.')).toBe(true)
  })
})
