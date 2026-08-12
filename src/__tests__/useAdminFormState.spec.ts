import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useEmployeeFormState } from '@/features/employees/useEmployeeFormState'
import { useUserFormState } from '@/features/users/useUserFormState'
import type { EmployeeRecord, UserProfile } from '@/types/domain'

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    active: true,
    assignedJobIds: ['job-2', 'job-1'],
    email: 'cj.blanchard@phase2co.com',
    firstName: 'CJ',
    id: 'user-cj',
    lastName: 'Blanchard',
    role: 'foreman',
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

describe('useUserFormState', () => {
  it('owns create-form defaults, field updates, assignment toggles, admin cleanup, and reset messaging', async () => {
    const resetCreateMessages = vi.fn()
    const formState = useUserFormState({ resetCreateMessages })

    expect(formState.createForm).toEqual({
      assignedJobIds: [],
      email: '',
      firstName: '',
      lastName: '',
      role: 'foreman',
    })

    formState.updateCreateTextField('email', 'cj.blanchard@phase2co.com')
    formState.updateCreateTextField('firstName', 'CJ')
    formState.updateCreateTextField('lastName', 'Blanchard')
    formState.toggleCreateAssignedJob('job-shop')
    formState.toggleCreateAssignedJob('job-lucky')
    formState.toggleCreateAssignedJob('job-shop')

    expect(formState.createForm.assignedJobIds).toEqual(['job-lucky'])

    formState.updateCreateRole('admin')
    await nextTick()

    expect(formState.createForm.assignedJobIds).toEqual([])
    expect(formState.createForm.role).toBe('admin')

    formState.resetCreateForm()

    expect(resetCreateMessages).toHaveBeenCalledTimes(1)
    expect(formState.createForm).toEqual({
      assignedJobIds: [],
      email: '',
      firstName: '',
      lastName: '',
      role: 'foreman',
    })
    expect(formState.createJobSearchTerm.value).toBe('')
  })

  it('hydrates selected users, normalizes editable roles, tracks dirty detail changes, and clears admin assignments', async () => {
    const formState = useUserFormState({ resetCreateMessages: vi.fn() })
    const projectManager = makeUser({
      assignedJobIds: ['job-b', 'job-a'],
      role: 'project-manager',
    })

    const hydration = formState.applyUserToDetailForm(projectManager)
    expect(formState.syncingDetailForm.value).toBe(true)
    await hydration

    expect(formState.syncingDetailForm.value).toBe(false)
    expect(formState.detailForm).toEqual({
      active: true,
      assignedJobIds: ['job-b', 'job-a'],
      firstName: 'CJ',
      lastName: 'Blanchard',
      role: 'project-manager',
    })
    expect(formState.getDetailFormSnapshot()).toEqual({
      active: true,
      assignedJobIds: ['job-a', 'job-b'],
      firstName: 'CJ',
      lastName: 'Blanchard',
      role: 'project-manager',
    })
    expect(formState.hasUnsavedDetailChanges(projectManager)).toBe(false)

    formState.updateDetailTextField('firstName', 'Christopher')
    expect(formState.hasUnsavedDetailChanges(projectManager)).toBe(true)

    formState.updateDetailTextField('firstName', 'CJ')
    formState.toggleDetailAssignedJob('job-b')
    expect(formState.hasUnsavedDetailChanges(projectManager)).toBe(true)

    formState.toggleDetailAssignedJob('job-b')
    formState.updateDetailActive(false)
    expect(formState.hasUnsavedDetailChanges(projectManager)).toBe(true)

    formState.updateDetailActive(true)
    formState.updateDetailRole('admin')
    await nextTick()

    expect(formState.detailForm.assignedJobIds).toEqual([])
    expect(formState.getDetailFormSnapshot()).toEqual({
      active: true,
      assignedJobIds: [],
      firstName: 'CJ',
      lastName: 'Blanchard',
      role: 'admin',
    })

    formState.detailJobSearchTerm.value = 'shop'
    formState.resetDetailJobSearchTerm()
    expect(formState.detailJobSearchTerm.value).toBe('')

    await formState.applyUserToDetailForm(null)
    expect(formState.detailForm).toEqual({
      active: true,
      assignedJobIds: [],
      firstName: '',
      lastName: '',
      role: 'foreman',
    })
  })

  it('keeps non-assignable stored roles out of job assignments without marking them dirty', async () => {
    const formState = useUserFormState({ resetCreateMessages: vi.fn() })
    const payrollUser = makeUser({
      assignedJobIds: ['job-a'],
      email: 'payroll@phase2co.com',
      firstName: 'Payroll',
      lastName: 'User',
      role: 'payroll',
    })

    await formState.applyUserToDetailForm(payrollUser)

    expect(formState.detailForm).toEqual({
      active: true,
      assignedJobIds: [],
      firstName: 'Payroll',
      lastName: 'User',
      role: 'payroll',
    })
    expect(formState.getDetailFormSnapshot()).toEqual({
      active: true,
      assignedJobIds: [],
      firstName: 'Payroll',
      lastName: 'User',
      role: 'payroll',
    })
    expect(formState.hasUnsavedDetailChanges(payrollUser)).toBe(false)
  })
})

describe('useEmployeeFormState', () => {
  it('owns create-form updates, boolean updates, reset behavior, and reset messaging', () => {
    const resetCreateMessages = vi.fn()
    const clearDetailError = vi.fn()
    const formState = useEmployeeFormState({
      clearDetailError,
      resetCreateMessages,
    })

    formState.updateCreateTextField('employeeNumber', '5133')
    formState.updateCreateTextField('firstName', 'CJ')
    formState.updateCreateTextField('lastName', 'Blanchard')
    formState.updateCreateTextField('occupation', 'Foreman')
    formState.updateCreateBooleanField('active', false)
    formState.updateCreateBooleanField('isContractor', true)

    expect(formState.createForm).toEqual({
      active: false,
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: true,
      lastName: 'Blanchard',
      occupation: 'Foreman',
    })

    formState.resetCreateForm()

    expect(resetCreateMessages).toHaveBeenCalledTimes(1)
    expect(formState.createForm).toEqual({
      active: true,
      employeeNumber: '',
      firstName: '',
      isContractor: false,
      lastName: '',
      occupation: '',
    })
    expect(clearDetailError).not.toHaveBeenCalled()
  })

  it('hydrates selected employees, clears detail errors, tracks sync state, and updates detail fields', async () => {
    const resetCreateMessages = vi.fn()
    const clearDetailError = vi.fn()
    const formState = useEmployeeFormState({
      clearDetailError,
      resetCreateMessages,
    })

    const hydration = formState.applyEmployeeToDetailForm(makeEmployee({
      active: false,
      isContractor: true,
      occupation: 'Shop Foreman',
    }))
    expect(formState.syncingDetailForm.value).toBe(true)
    await hydration

    expect(clearDetailError).toHaveBeenCalledTimes(1)
    expect(formState.syncingDetailForm.value).toBe(false)
    expect(formState.detailForm).toEqual({
      active: false,
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: true,
      lastName: 'Blanchard',
      occupation: 'Shop Foreman',
    })
    expect(formState.getDetailFormSnapshot()).toEqual({
      active: false,
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: true,
      lastName: 'Blanchard',
      occupation: 'Shop Foreman',
    })
    expect(formState.hasUnsavedDetailChanges(makeEmployee({
      active: false,
      isContractor: true,
      occupation: 'Shop Foreman',
    }))).toBe(false)

    formState.updateDetailTextField('occupation', 'Superintendent')
    formState.updateDetailBooleanField('active', true)
    formState.updateDetailBooleanField('isContractor', false)
    expect(formState.hasUnsavedDetailChanges(makeEmployee({
      active: false,
      isContractor: true,
      occupation: 'Shop Foreman',
    }))).toBe(true)

    expect(formState.detailForm).toEqual({
      active: true,
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: false,
      lastName: 'Blanchard',
      occupation: 'Superintendent',
    })

    await formState.applyEmployeeToDetailForm(null)

    expect(clearDetailError).toHaveBeenCalledTimes(2)
    expect(formState.detailForm).toEqual({
      active: true,
      employeeNumber: '',
      firstName: '',
      isContractor: false,
      lastName: '',
      occupation: '',
    })
    expect(resetCreateMessages).not.toHaveBeenCalled()
  })
})
