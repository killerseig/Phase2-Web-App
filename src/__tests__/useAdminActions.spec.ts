import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useEmployeeActions } from '@/features/employees/useEmployeeActions'
import type { EmployeeFormState } from '@/features/employees/employeeViewHelpers'
import { useUserCreateActions } from '@/features/users/useUserCreateActions'
import { useUserDetailActions } from '@/features/users/useUserDetailActions'
import type { UserCreateFormState, UserDetailFormState } from '@/features/users/userViewHelpers'
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
  updateEmployeeRecord,
} from '@/services/employees'
import {
  createUserByAdmin,
  deleteUserByAdmin,
  resendUserInviteByAdmin,
  sendPendingInvitesByAdmin,
  sendUserPasswordResetByAdmin,
  updateUser,
} from '@/services/users'
import type { EmployeeRecord, UserProfile } from '@/types/domain'

vi.mock('@/services/users', () => ({
  createUserByAdmin: vi.fn(),
  deleteUserByAdmin: vi.fn(),
  resendUserInviteByAdmin: vi.fn(),
  sendPendingInvitesByAdmin: vi.fn(),
  sendUserPasswordResetByAdmin: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/services/employees', () => ({
  createEmployeeRecord: vi.fn(),
  deleteEmployeeRecord: vi.fn(),
  updateEmployeeRecord: vi.fn(),
}))

const createUserByAdminMock = vi.mocked(createUserByAdmin)
const deleteUserByAdminMock = vi.mocked(deleteUserByAdmin)
const resendUserInviteByAdminMock = vi.mocked(resendUserInviteByAdmin)
const sendPendingInvitesByAdminMock = vi.mocked(sendPendingInvitesByAdmin)
const sendUserPasswordResetByAdminMock = vi.mocked(sendUserPasswordResetByAdmin)
const updateUserMock = vi.mocked(updateUser)

const createEmployeeRecordMock = vi.mocked(createEmployeeRecord)
const deleteEmployeeRecordMock = vi.mocked(deleteEmployeeRecord)
const updateEmployeeRecordMock = vi.mocked(updateEmployeeRecord)

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

function makeEmployeeForm(overrides: Partial<EmployeeFormState> = {}): EmployeeFormState {
  return {
    active: true,
    employeeNumber: '',
    firstName: '',
    isContractor: false,
    lastName: '',
    occupation: '',
    ...overrides,
  }
}

function mountUserCreateActions() {
  const createAction = ref<'queue' | 'send' | null>(null)
  const inviteLoading = ref(false)
  const selectedUserId = ref<string | 'new' | null>(null)
  const createForm: UserCreateFormState = {
    assignedJobIds: [] as string[],
    email: '',
    firstName: '',
    lastName: '',
    role: 'foreman',
  }
  const createErrorMessages: string[] = []
  const createErrors: Array<{ error: unknown; fallback: string }> = []
  const createInfos: string[] = []
  const inviteErrors: Array<{ error: unknown; fallback: string }> = []
  const inviteInfos: string[] = []
  const resetCreateMessages = vi.fn()
  const resetInviteMessages = vi.fn()

  const actions = useUserCreateActions({
    createAction,
    createForm,
    inviteLoading,
    resetCreateMessages,
    resetInviteMessages,
    selectedUserId,
    setCreateError: (error, fallback) => createErrors.push({ error, fallback }),
    setCreateErrorMessage: (message) => createErrorMessages.push(message),
    setCreateInfo: (message) => createInfos.push(message),
    setInviteError: (error, fallback) => inviteErrors.push({ error, fallback }),
    setInviteInfo: (message) => inviteInfos.push(message),
  })

  return {
    actions,
    createAction,
    createErrorMessages,
    createErrors,
    createForm,
    createInfos,
    inviteErrors,
    inviteInfos,
    inviteLoading,
    resetCreateMessages,
    resetInviteMessages,
    selectedUserId,
  }
}

function mountUserDetailActions(
  options: {
    editingSelf?: boolean
    hasUnsavedDetailChanges?: boolean
    isCreateMode?: boolean
    selectedUser?: UserProfile | null
    syncingDetailForm?: boolean
  } = {},
) {
  const deleteConfirmOpen = ref(false)
  const deleteLoading = ref(false)
  const detailError = ref('')
  const emailAction = ref<'invite' | 'reset' | null>(null)
  const detailForm: UserDetailFormState = {
    active: false,
    assignedJobIds: ['job-shop'],
    firstName: 'Christopher',
    lastName: 'Blanchard',
    role: 'foreman',
  }
  const editingSelf = ref(options.editingSelf ?? false)
  const hasUnsavedDetailChanges = vi.fn(() => options.hasUnsavedDetailChanges ?? true)
  const isCreateMode = ref(options.isCreateMode ?? false)
  const resetCreateForm = vi.fn()
  const saveLoading = ref(false)
  const selectedUser = ref<UserProfile | null>(options.selectedUser ?? makeUser())
  const selectedUserId = ref<string | 'new' | null>(selectedUser.value?.id ?? null)
  const detailErrorMessages: string[] = []
  const detailErrors: Array<{ error: unknown; fallback: string }> = []
  const detailInfos: string[] = []
  const syncingDetailForm = ref(options.syncingDetailForm ?? false)
  const toggleDetailAssignedJob = vi.fn((jobId: string) => {
    if (detailForm.assignedJobIds.includes(jobId)) {
      detailForm.assignedJobIds = detailForm.assignedJobIds.filter((id) => id !== jobId)
      return
    }

    detailForm.assignedJobIds.push(jobId)
  })

  const actions = useUserDetailActions({
    deleteConfirmOpen,
    deleteLoading,
    detailError,
    emailAction,
    detailForm,
    editingSelf,
    hasUnsavedDetailChanges,
    isCreateMode,
    resetCreateForm,
    saveLoading,
    selectedUser,
    selectedUserId,
    setDetailError: (error, fallback) => detailErrors.push({ error, fallback }),
    setDetailErrorMessage: (message) => {
      detailError.value = message
      detailErrorMessages.push(message)
    },
    setDetailInfo: (message) => detailInfos.push(message),
    syncingDetailForm,
    toggleDetailAssignedJob,
  })

  return {
    actions,
    deleteConfirmOpen,
    deleteLoading,
    detailError,
    detailErrorMessages,
    detailErrors,
    detailForm,
    detailInfos,
    emailAction,
    editingSelf,
    hasUnsavedDetailChanges,
    resetCreateForm,
    saveLoading,
    selectedUser,
    selectedUserId,
    toggleDetailAssignedJob,
  }
}

function mountEmployeeActions(
  options: {
    hasUnsavedDetailChanges?: boolean
    selectedEmployee?: EmployeeRecord | null
    syncingDetailForm?: boolean
  } = {},
) {
  const createForm = makeEmployeeForm()
  const createLoading = ref(false)
  const deleteConfirmOpen = ref(false)
  const deleteLoading = ref(false)
  const detailForm = makeEmployeeForm({
    active: false,
    employeeNumber: '5133',
    firstName: 'Christopher',
    isContractor: true,
    lastName: 'Blanchard',
    occupation: 'Shop Foreman',
  })
  const resetCreateForm = vi.fn()
  const resetCreateMessages = vi.fn()
  const resetDetailMessages = vi.fn()
  const saveLoading = ref(false)
  const selectedEmployee = ref<EmployeeRecord | null>(options.selectedEmployee ?? makeEmployee())
  const selectedEmployeeId = ref<string | 'new'>(selectedEmployee.value?.id ?? 'new')
  const hasUnsavedDetailChanges = vi.fn(() => options.hasUnsavedDetailChanges ?? true)
  const createErrorMessages: string[] = []
  const createErrors: Array<{ error: unknown; fallback: string }> = []
  const createInfos: string[] = []
  const detailErrorMessages: string[] = []
  const detailErrors: Array<{ error: unknown; fallback: string }> = []
  const detailInfos: string[] = []
  const syncingDetailForm = ref(options.syncingDetailForm ?? false)

  const actions = useEmployeeActions({
    createForm,
    createLoading,
    deleteConfirmOpen,
    deleteLoading,
    detailForm,
    hasUnsavedDetailChanges,
    resetCreateForm,
    resetCreateMessages,
    resetDetailMessages,
    saveLoading,
    selectedEmployee,
    selectedEmployeeId,
    setCreateError: (error, fallback) => createErrors.push({ error, fallback }),
    setCreateErrorMessage: (message) => createErrorMessages.push(message),
    setCreateInfo: (message) => createInfos.push(message),
    setDetailError: (error, fallback) => detailErrors.push({ error, fallback }),
    setDetailErrorMessage: (message) => detailErrorMessages.push(message),
    setDetailInfo: (message) => detailInfos.push(message),
    syncingDetailForm,
  })

  return {
    actions,
    createErrorMessages,
    createErrors,
    createForm,
    createInfos,
    createLoading,
    deleteConfirmOpen,
    deleteLoading,
    detailErrorMessages,
    detailErrors,
    detailForm,
    detailInfos,
    hasUnsavedDetailChanges,
    resetCreateForm,
    resetCreateMessages,
    resetDetailMessages,
    saveLoading,
    selectedEmployee,
    selectedEmployeeId,
  }
}

describe('admin user actions', () => {
  beforeEach(() => {
    createUserByAdminMock.mockReset()
    deleteUserByAdminMock.mockReset()
    resendUserInviteByAdminMock.mockReset()
    sendPendingInvitesByAdminMock.mockReset()
    sendUserPasswordResetByAdminMock.mockReset()
    updateUserMock.mockReset()
    createUserByAdminMock.mockResolvedValue({
      message: 'User created.',
      success: true,
      uid: 'user-new',
    })
    deleteUserByAdminMock.mockResolvedValue({ message: 'User deleted.', success: true })
    resendUserInviteByAdminMock.mockResolvedValue({
      email: 'cj.blanchard@phase2co.com',
      message: 'Invite email sent to cj.blanchard@phase2co.com.',
      success: true,
    })
    sendPendingInvitesByAdminMock.mockResolvedValue({
      message: 'Pending invites sent.',
      sentCount: 2,
      skippedCount: 0,
      success: true,
    })
    sendUserPasswordResetByAdminMock.mockResolvedValue({
      email: 'cj.blanchard@phase2co.com',
      message: 'Password reset email sent to cj.blanchard@phase2co.com.',
      success: true,
    })
    updateUserMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('validates create-user fields before calling the service', async () => {
    const { actions, createErrorMessages, resetCreateMessages } = mountUserCreateActions()

    await actions.handleCreateUser(false)

    expect(resetCreateMessages).toHaveBeenCalledTimes(1)
    expect(createErrorMessages).toEqual(['Enter the email, first name, and last name.'])
    expect(createUserByAdminMock).not.toHaveBeenCalled()
  })

  it('creates users with assigned jobs only for assignable roles and clears loading state', async () => {
    const { actions, createAction, createForm, createInfos, selectedUserId } =
      mountUserCreateActions()
    createForm.email = 'pm@example.com'
    createForm.firstName = 'Project'
    createForm.lastName = 'Manager'
    createForm.role = 'project-manager'
    createForm.assignedJobIds = ['job-2', 'job-1']

    await actions.handleCreateUser(true)

    expect(createUserByAdminMock).toHaveBeenCalledWith({
      assignedJobIds: ['job-2', 'job-1'],
      email: 'pm@example.com',
      firstName: 'Project',
      lastName: 'Manager',
      role: 'project-manager',
      sendInvite: true,
    })
    expect(createInfos).toEqual(['User created.'])
    expect(selectedUserId.value).toBe('user-new')
    expect(createAction.value).toBeNull()

    createForm.role = 'admin'
    createForm.assignedJobIds = ['job-should-not-send']

    await actions.handleCreateUser(false)

    expect(createUserByAdminMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assignedJobIds: [],
        sendInvite: false,
      }),
    )
  })

  it('sends pending invites and forwards invite failures', async () => {
    const { actions, inviteErrors, inviteInfos, inviteLoading, resetInviteMessages } =
      mountUserCreateActions()

    await actions.handleSendPendingInvites()

    expect(resetInviteMessages).toHaveBeenCalledTimes(1)
    expect(sendPendingInvitesByAdminMock).toHaveBeenCalledTimes(1)
    expect(inviteInfos).toEqual(['Pending invites sent.'])
    expect(inviteLoading.value).toBe(false)

    const error = new Error('Invite denied')
    sendPendingInvitesByAdminMock.mockRejectedValueOnce(error)

    await actions.handleSendPendingInvites()

    expect(inviteErrors).toEqual([{ error, fallback: 'Failed to send pending invites.' }])
    expect(inviteLoading.value).toBe(false)
  })

  it('autosaves user detail changes, validates names, and suppresses unchanged saves', async () => {
    const unchanged = mountUserDetailActions({ hasUnsavedDetailChanges: false })

    await expect(unchanged.actions.handleAutoSaveUser()).resolves.toBe(true)

    expect(updateUserMock).not.toHaveBeenCalled()
    expect(unchanged.hasUnsavedDetailChanges).toHaveBeenCalledWith(unchanged.selectedUser.value)
    expect(unchanged.detailInfos).toEqual(['Changes save automatically.'])

    const invalid = mountUserDetailActions()
    invalid.detailForm.firstName = ''

    await expect(invalid.actions.handleAutoSaveUser()).resolves.toBe(false)

    expect(invalid.detailErrorMessages).toContain('Enter the first name and last name.')
    expect(updateUserMock).not.toHaveBeenCalled()

    const changed = mountUserDetailActions()

    await expect(changed.actions.handleAutoSaveUser()).resolves.toBe(true)

    expect(updateUserMock).toHaveBeenCalledWith('user-cj', {
      active: false,
      assignedJobIds: ['job-shop'],
      firstName: 'Christopher',
      lastName: 'Blanchard',
      role: 'foreman',
    })
    expect(changed.detailInfos).toContain('All changes saved.')
    expect(changed.saveLoading.value).toBe(false)
  })

  it('preserves target-only stored roles when autosaving editable profile fields', async () => {
    const changed = mountUserDetailActions({
      selectedUser: makeUser({
        assignedJobIds: ['job-shop'],
        email: 'payroll@phase2co.com',
        firstName: 'Payroll',
        lastName: 'User',
        role: 'payroll',
      }),
    })
    changed.detailForm.role = 'payroll'
    changed.detailForm.assignedJobIds = []

    await changed.actions.handleAutoSaveUser()

    expect(updateUserMock).toHaveBeenCalledWith('user-cj', {
      active: false,
      assignedJobIds: [],
      firstName: 'Christopher',
      lastName: 'Blanchard',
      role: 'payroll',
    })
    expect(changed.detailInfos).toContain('All changes saved.')
  })

  it('queues user detail autosaves only when editing a dirty selected user', async () => {
    vi.useFakeTimers()
    const queued = mountUserDetailActions()

    queued.actions.queueDetailSave(25)
    expect(updateUserMock).not.toHaveBeenCalled()
    expect(queued.hasUnsavedDetailChanges).toHaveBeenCalledWith(queued.selectedUser.value)

    await vi.advanceTimersByTimeAsync(25)

    expect(updateUserMock).toHaveBeenCalledTimes(1)

    const createMode = mountUserDetailActions({ isCreateMode: true })
    createMode.actions.queueDetailSave(25)
    await vi.advanceTimersByTimeAsync(25)

    expect(updateUserMock).toHaveBeenCalledTimes(1)
  })

  it('toggles user detail job assignments and autosaves only for editable selected users', async () => {
    const changed = mountUserDetailActions()

    changed.actions.handleDetailAssignedJobToggle('job-lucky')
    await Promise.resolve()

    expect(changed.toggleDetailAssignedJob).toHaveBeenCalledWith('job-lucky')
    expect(updateUserMock).toHaveBeenCalledWith(
      'user-cj',
      expect.objectContaining({
        assignedJobIds: ['job-shop', 'job-lucky'],
      }),
    )

    const createMode = mountUserDetailActions({ isCreateMode: true })
    createMode.actions.handleDetailAssignedJobToggle('job-lucky')
    await Promise.resolve()

    expect(createMode.toggleDetailAssignedJob).toHaveBeenCalledWith('job-lucky')
    expect(updateUserMock).toHaveBeenCalledTimes(1)

    const syncing = mountUserDetailActions({ syncingDetailForm: true })
    syncing.actions.handleDetailAssignedJobToggle('job-lucky')
    await Promise.resolve()

    expect(syncing.toggleDetailAssignedJob).toHaveBeenCalledWith('job-lucky')
    expect(updateUserMock).toHaveBeenCalledTimes(1)
  })

  it('resends an individual invite and sends a password reset with distinct feedback', async () => {
    const callOrder: string[] = []
    updateUserMock.mockImplementation(async () => {
      callOrder.push('save')
    })
    resendUserInviteByAdminMock.mockImplementation(async () => {
      callOrder.push('invite')
      return {
        email: 'cj.blanchard@phase2co.com',
        message: 'Invite email sent to cj.blanchard@phase2co.com.',
        success: true,
      }
    })
    sendUserPasswordResetByAdminMock.mockImplementation(async () => {
      callOrder.push('reset')
      return {
        email: 'cj.blanchard@phase2co.com',
        message: 'Password reset email sent to cj.blanchard@phase2co.com.',
        success: true,
      }
    })
    const resend = mountUserDetailActions()

    await resend.actions.handleResendInvite()

    expect(resendUserInviteByAdminMock).toHaveBeenCalledWith('user-cj')
    expect(resend.detailInfos).toContain('Invite email sent to cj.blanchard@phase2co.com.')
    expect(resend.emailAction.value).toBeNull()

    await resend.actions.handleSendPasswordReset()

    expect(sendUserPasswordResetByAdminMock).toHaveBeenCalledWith('user-cj')
    expect(resend.detailInfos).toContain('Password reset email sent to cj.blanchard@phase2co.com.')
    expect(resend.emailAction.value).toBeNull()
    expect(callOrder).toEqual(['save', 'invite', 'save', 'reset'])
  })

  it('does not send account emails when pending profile changes cannot be saved', async () => {
    const invalid = mountUserDetailActions()
    invalid.detailForm.firstName = ''

    await invalid.actions.handleResendInvite()
    await invalid.actions.handleSendPasswordReset()

    expect(updateUserMock).not.toHaveBeenCalled()
    expect(resendUserInviteByAdminMock).not.toHaveBeenCalled()
    expect(sendUserPasswordResetByAdminMock).not.toHaveBeenCalled()
    expect(invalid.detailErrorMessages).toContain('Enter the first name and last name.')

    const saveError = new Error('Profile save failed')
    updateUserMock.mockRejectedValue(saveError)
    const failedSave = mountUserDetailActions()

    await failedSave.actions.handleResendInvite()
    await failedSave.actions.handleSendPasswordReset()

    expect(updateUserMock).toHaveBeenCalledTimes(2)
    expect(resendUserInviteByAdminMock).not.toHaveBeenCalled()
    expect(sendUserPasswordResetByAdminMock).not.toHaveBeenCalled()
    expect(failedSave.detailErrors).toEqual([
      { error: saveError, fallback: 'Failed to update user.' },
      { error: saveError, fallback: 'Failed to update user.' },
    ])
  })

  it('keeps delete and account email actions from overlapping', async () => {
    const guarded = mountUserDetailActions({ hasUnsavedDetailChanges: false })

    guarded.emailAction.value = 'invite'
    await guarded.actions.handleDeleteUser()
    guarded.deleteConfirmOpen.value = true
    await guarded.actions.confirmDeleteUser()

    expect(deleteUserByAdminMock).not.toHaveBeenCalled()

    guarded.emailAction.value = null
    await guarded.actions.handleResendInvite()
    await guarded.actions.handleSendPasswordReset()

    expect(resendUserInviteByAdminMock).not.toHaveBeenCalled()
    expect(sendUserPasswordResetByAdminMock).not.toHaveBeenCalled()
  })

  it('does not show account email results after the admin selects another user', async () => {
    let resolveInvite!: (value: { email: string; message: string; success: boolean }) => void
    const inviteResult = new Promise<{
      email: string
      message: string
      success: boolean
    }>((resolve) => {
      resolveInvite = resolve
    })
    resendUserInviteByAdminMock.mockReturnValueOnce(inviteResult)
    const invite = mountUserDetailActions({ hasUnsavedDetailChanges: false })

    const pendingInvite = invite.actions.handleResendInvite()
    await vi.waitFor(() => expect(resendUserInviteByAdminMock).toHaveBeenCalledTimes(1))
    invite.selectedUser.value = makeUser({ id: 'user-other', email: 'other@example.com' })
    invite.selectedUserId.value = 'user-other'
    resolveInvite({
      email: 'cj.blanchard@phase2co.com',
      message: 'Invite email sent to cj.blanchard@phase2co.com.',
      success: true,
    })
    await pendingInvite

    expect(invite.detailInfos).not.toContain('Invite email sent to cj.blanchard@phase2co.com.')

    let rejectReset!: (error: unknown) => void
    const resetResult = new Promise<never>((_resolve, reject) => {
      rejectReset = reject
    })
    sendUserPasswordResetByAdminMock.mockReturnValueOnce(resetResult)
    const reset = mountUserDetailActions({ hasUnsavedDetailChanges: false })
    const resetError = new Error('Reset failed')

    const pendingReset = reset.actions.handleSendPasswordReset()
    await vi.waitFor(() => expect(sendUserPasswordResetByAdminMock).toHaveBeenCalledTimes(1))
    reset.selectedUser.value = makeUser({ id: 'user-other', email: 'other@example.com' })
    reset.selectedUserId.value = 'user-other'
    rejectReset(resetError)
    await pendingReset

    expect(reset.detailErrors).toEqual([])
  })

  it('guards unavailable emails and reports invite and reset failures separately', async () => {
    const unavailable = mountUserDetailActions({
      selectedUser: makeUser({ email: null }),
    })

    await unavailable.actions.handleResendInvite()
    await unavailable.actions.handleSendPasswordReset()

    expect(unavailable.detailErrorMessages).toContain('This user does not have an email address.')
    expect(resendUserInviteByAdminMock).not.toHaveBeenCalled()
    expect(sendUserPasswordResetByAdminMock).not.toHaveBeenCalled()

    const failures = mountUserDetailActions()
    const inviteError = new Error('Invite delivery failed')
    const resetError = new Error('Reset delivery failed')
    resendUserInviteByAdminMock.mockRejectedValueOnce(inviteError)
    sendUserPasswordResetByAdminMock.mockRejectedValueOnce(resetError)

    await failures.actions.handleResendInvite()
    await failures.actions.handleSendPasswordReset()

    expect(failures.detailErrors).toEqual([
      {
        error: inviteError,
        fallback: 'Failed to resend invite email to cj.blanchard@phase2co.com.',
      },
      {
        error: resetError,
        fallback: 'Failed to send password reset email to cj.blanchard@phase2co.com.',
      },
    ])
    expect(failures.emailAction.value).toBeNull()
  })

  it('opens, confirms, and guards user deletion', async () => {
    const {
      actions,
      deleteConfirmOpen,
      deleteLoading,
      detailInfos,
      resetCreateForm,
      selectedUserId,
    } = mountUserDetailActions()

    await actions.handleDeleteUser()

    expect(deleteConfirmOpen.value).toBe(true)

    await actions.confirmDeleteUser()

    expect(deleteUserByAdminMock).toHaveBeenCalledWith('user-cj')
    expect(detailInfos).toEqual(['User deleted.'])
    expect(selectedUserId.value).toBeNull()
    expect(resetCreateForm).toHaveBeenCalledTimes(1)
    expect(deleteConfirmOpen.value).toBe(false)
    expect(deleteLoading.value).toBe(false)

    const editingSelf = mountUserDetailActions({ editingSelf: true })
    await editingSelf.actions.handleDeleteUser()
    await editingSelf.actions.confirmDeleteUser()

    expect(editingSelf.deleteConfirmOpen.value).toBe(false)
    expect(deleteUserByAdminMock).toHaveBeenCalledTimes(1)
  })

  it('does not clear a newly selected user or show stale feedback after deletion finishes', async () => {
    let resolveDelete!: (value: { message: string; success: boolean }) => void
    deleteUserByAdminMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve
      }),
    )
    const deletion = mountUserDetailActions()

    await deletion.actions.handleDeleteUser()
    const pendingDelete = deletion.actions.confirmDeleteUser()
    await vi.waitFor(() => expect(deleteUserByAdminMock).toHaveBeenCalledWith('user-cj'))
    deletion.selectedUser.value = makeUser({ id: 'user-other', email: 'other@example.com' })
    deletion.selectedUserId.value = 'user-other'
    resolveDelete({ message: 'User deleted.', success: true })
    await pendingDelete

    expect(deletion.selectedUserId.value).toBe('user-other')
    expect(deletion.detailInfos).not.toContain('User deleted.')
    expect(deletion.deleteConfirmOpen.value).toBe(false)
  })
})

describe('admin employee actions', () => {
  beforeEach(() => {
    createEmployeeRecordMock.mockReset()
    deleteEmployeeRecordMock.mockReset()
    updateEmployeeRecordMock.mockReset()
    createEmployeeRecordMock.mockResolvedValue('employee-new')
    deleteEmployeeRecordMock.mockResolvedValue(undefined)
    updateEmployeeRecordMock.mockResolvedValue(undefined)
  })

  it('validates employee creation before calling the service', async () => {
    const { actions, createErrorMessages, resetCreateMessages } = mountEmployeeActions()

    await actions.handleCreateEmployee()

    expect(resetCreateMessages).toHaveBeenCalledTimes(1)
    expect(createErrorMessages).toEqual(['Enter the employee number.'])
    expect(createEmployeeRecordMock).not.toHaveBeenCalled()
  })

  it('creates employees with the editable form payload and selects the new employee', async () => {
    const { actions, createForm, createInfos, createLoading, selectedEmployeeId } =
      mountEmployeeActions()
    Object.assign(createForm, {
      active: true,
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: false,
      lastName: 'Blanchard',
      occupation: 'Foreman',
    })

    await actions.handleCreateEmployee()

    expect(createEmployeeRecordMock).toHaveBeenCalledWith({
      active: true,
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: false,
      lastName: 'Blanchard',
      occupation: 'Foreman',
    })
    expect(createInfos).toEqual(['Employee created.'])
    expect(selectedEmployeeId.value).toBe('employee-new')
    expect(createLoading.value).toBe(false)
  })

  it('autosaves changed employees, skips syncing state, and reports validation errors', async () => {
    const syncing = mountEmployeeActions({ syncingDetailForm: true })

    await syncing.actions.handleAutoSaveEmployee()

    expect(updateEmployeeRecordMock).not.toHaveBeenCalled()

    const invalid = mountEmployeeActions()
    invalid.detailForm.firstName = ''

    await invalid.actions.handleAutoSaveEmployee()

    expect(invalid.detailErrorMessages).toEqual(['', 'Enter the first name.'])
    expect(updateEmployeeRecordMock).not.toHaveBeenCalled()

    const changed = mountEmployeeActions()

    await changed.actions.handleAutoSaveEmployee()

    expect(changed.hasUnsavedDetailChanges).toHaveBeenCalledWith(changed.selectedEmployee.value)
    expect(updateEmployeeRecordMock).toHaveBeenCalledWith('employee-cj', {
      active: false,
      employeeNumber: '5133',
      firstName: 'Christopher',
      isContractor: true,
      lastName: 'Blanchard',
      occupation: 'Shop Foreman',
    })
    expect(changed.detailInfos).toContain('All changes saved.')
    expect(changed.saveLoading.value).toBe(false)
  })

  it('opens and confirms employee deletion with selection reset', async () => {
    const {
      actions,
      deleteConfirmOpen,
      deleteLoading,
      detailInfos,
      resetCreateForm,
      resetDetailMessages,
      selectedEmployeeId,
    } = mountEmployeeActions()

    await actions.handleDeleteEmployee()

    expect(deleteConfirmOpen.value).toBe(true)

    await actions.confirmDeleteEmployee()

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(deleteEmployeeRecordMock).toHaveBeenCalledWith('employee-cj')
    expect(detailInfos).toEqual(['Employee deleted.'])
    expect(selectedEmployeeId.value).toBe('new')
    expect(resetCreateForm).toHaveBeenCalledTimes(1)
    expect(deleteConfirmOpen.value).toBe(false)
    expect(deleteLoading.value).toBe(false)
  })
})
