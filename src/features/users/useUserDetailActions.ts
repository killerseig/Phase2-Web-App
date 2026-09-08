import { currentRoleCanBeAssignedJobs } from '@/auth/roles'
import { getUserDetailUpdateRole, type UserDetailFormState } from '@/features/users/userViewHelpers'
import {
  deleteUserByAdmin,
  resendUserInviteByAdmin,
  sendUserPasswordResetByAdmin,
  updateUser,
} from '@/services/users'
import type { UserProfile } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseUserDetailActionsOptions {
  deleteConfirmOpen: WritableRef<boolean>
  deleteLoading: WritableRef<boolean>
  detailError: ReadonlyRef<string>
  emailAction: WritableRef<'invite' | 'reset' | null>
  detailForm: UserDetailFormState
  editingSelf: ReadonlyRef<boolean>
  hasUnsavedDetailChanges: (user: UserProfile | null) => boolean
  isCreateMode: ReadonlyRef<boolean>
  resetCreateForm: () => void
  saveLoading: WritableRef<boolean>
  selectedUser: ReadonlyRef<UserProfile | null>
  selectedUserId: WritableRef<string | 'new' | null>
  setDetailError: (error: unknown, fallback: string) => void
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  syncingDetailForm: ReadonlyRef<boolean>
  toggleDetailAssignedJob: (jobId: string) => void
}

export function useUserDetailActions({
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
  setDetailError,
  setDetailErrorMessage,
  setDetailInfo,
  syncingDetailForm,
  toggleDetailAssignedJob,
}: UseUserDetailActionsOptions) {
  let detailSaveTimer: number | null = null

  function clearDetailSaveTimer() {
    if (detailSaveTimer !== null) {
      window.clearTimeout(detailSaveTimer)
      detailSaveTimer = null
    }
  }

  async function handleAutoSaveUser(): Promise<boolean> {
    const user = selectedUser.value
    if (!user || saveLoading.value) return false

    clearDetailSaveTimer()
    setDetailErrorMessage('')

    if (!hasUnsavedDetailChanges(user)) {
      setDetailInfo('Changes save automatically.')
      return true
    }

    if (!detailForm.firstName.trim() || !detailForm.lastName.trim()) {
      setDetailErrorMessage('Enter the first name and last name.')
      return false
    }

    saveLoading.value = true
    setDetailInfo('Saving changes...')
    try {
      const role = getUserDetailUpdateRole(user, detailForm.role)
      await updateUser(user.id, {
        firstName: detailForm.firstName,
        lastName: detailForm.lastName,
        role,
        active: detailForm.active,
        assignedJobIds: currentRoleCanBeAssignedJobs(role) ? detailForm.assignedJobIds : [],
      })

      if (selectedUser.value?.id === user.id) {
        setDetailInfo('All changes saved.')
      }
      return true
    } catch (error) {
      if (selectedUser.value?.id === user.id) {
        setDetailError(error, 'Failed to update user.')
      }
      return false
    } finally {
      saveLoading.value = false
    }
  }

  function queueDetailSave(delay = 450) {
    if (isCreateMode.value || !selectedUser.value || syncingDetailForm.value) return

    clearDetailSaveTimer()

    if (!hasUnsavedDetailChanges(selectedUser.value)) {
      if (!detailError.value) {
        setDetailInfo('Changes save automatically.')
      }
      return
    }

    if (detailError.value) {
      setDetailErrorMessage('')
    }

    detailSaveTimer = window.setTimeout(() => {
      void handleAutoSaveUser()
    }, delay)
  }

  async function handleDeleteUser() {
    if (
      !selectedUser.value ||
      editingSelf.value ||
      deleteLoading.value ||
      emailAction.value !== null ||
      saveLoading.value
    )
      return
    deleteConfirmOpen.value = true
  }

  async function confirmDeleteUser() {
    const user = selectedUser.value
    if (!user || editingSelf.value) {
      deleteConfirmOpen.value = false
      return
    }
    if (deleteLoading.value || emailAction.value !== null || saveLoading.value) return

    setDetailErrorMessage('')
    deleteLoading.value = true
    try {
      const result = await deleteUserByAdmin(user.id)
      if (selectedUserId.value === user.id || selectedUserId.value === null) {
        setDetailInfo(result.message || 'User deleted.')
        selectedUserId.value = null
        resetCreateForm()
      }
      deleteConfirmOpen.value = false
    } catch (error) {
      if (selectedUser.value?.id === user.id) {
        setDetailError(error, 'Failed to delete user.')
      }
    } finally {
      if (selectedUser.value?.id !== user.id) {
        deleteConfirmOpen.value = false
      }
      deleteLoading.value = false
    }
  }

  function handleDetailAssignedJobToggle(jobId: string) {
    toggleDetailAssignedJob(jobId)

    if (syncingDetailForm.value || !selectedUser.value || isCreateMode.value) return

    void handleAutoSaveUser()
  }

  async function handleResendInvite() {
    const user = selectedUser.value
    const email = user?.email?.trim()
    if (
      !user ||
      deleteConfirmOpen.value ||
      deleteLoading.value ||
      emailAction.value !== null ||
      saveLoading.value
    )
      return

    setDetailErrorMessage('')
    setDetailInfo('')
    if (!email) {
      setDetailErrorMessage('This user does not have an email address.')
      return
    }

    if (!(await handleAutoSaveUser()) || selectedUser.value?.id !== user.id) return

    emailAction.value = 'invite'
    try {
      const result = await resendUserInviteByAdmin(user.id)
      if (selectedUser.value?.id === user.id) {
        setDetailInfo(result.message || `Invite email sent to ${email}.`)
      }
    } catch (error) {
      if (selectedUser.value?.id === user.id) {
        setDetailError(error, `Failed to resend invite email to ${email}.`)
      }
    } finally {
      emailAction.value = null
    }
  }

  async function handleSendPasswordReset() {
    const user = selectedUser.value
    const email = user?.email?.trim()
    if (
      !user ||
      deleteConfirmOpen.value ||
      deleteLoading.value ||
      emailAction.value !== null ||
      saveLoading.value
    )
      return

    setDetailErrorMessage('')
    setDetailInfo('')
    if (!email) {
      setDetailErrorMessage('This user does not have an email address.')
      return
    }

    if (!(await handleAutoSaveUser()) || selectedUser.value?.id !== user.id) return

    emailAction.value = 'reset'
    try {
      const result = await sendUserPasswordResetByAdmin(user.id)
      if (selectedUser.value?.id === user.id) {
        setDetailInfo(result.message || `Password reset email sent to ${email}.`)
      }
    } catch (error) {
      if (selectedUser.value?.id === user.id) {
        setDetailError(error, `Failed to send password reset email to ${email}.`)
      }
    } finally {
      emailAction.value = null
    }
  }

  return {
    clearDetailSaveTimer,
    confirmDeleteUser,
    handleAutoSaveUser,
    handleDeleteUser,
    handleDetailAssignedJobToggle,
    handleResendInvite,
    handleSendPasswordReset,
    queueDetailSave,
  }
}
