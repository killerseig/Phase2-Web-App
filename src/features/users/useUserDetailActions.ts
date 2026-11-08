import { getCurrentScope, onScopeDispose, watch } from 'vue'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { currentRoleCanHaveAccountJobAssignments } from '@/auth/roles'
import { getUserDetailFormSnapshot, getUserDetailUpdateRole, type UserDetailFormState } from '@/features/users/userViewHelpers'
import {
  deleteUserByAdmin,
  resendUserInviteByAdmin,
  sendUserPasswordResetByAdmin,
  updateUser,
} from '@/services/users'
import type { UserProfile } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseUserDetailActionsOptions {
  context?: AdminRequestContext
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
  context,
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
  const scope = useAdminRequestScope(context, () => selectedUserId.value, () => getUserDetailFormSnapshot(detailForm))
  let deletion: { id: string; current: () => boolean } | undefined
  watch(scope.revision, () => {
    clearDetailSaveTimer()
    saveLoading.value = false
    deleteLoading.value = false
    emailAction.value = null
    deleteConfirmOpen.value = false
    deletion = undefined
  }, { flush: 'sync' })

  function clearDetailSaveTimer() {
    if (detailSaveTimer !== null) {
      window.clearTimeout(detailSaveTimer)
      detailSaveTimer = null
    }
  }
  if (getCurrentScope()) onScopeDispose(clearDetailSaveTimer)

  async function handleAutoSaveUser(): Promise<boolean> {
    const user = selectedUser.value
    if (!scope.allowed.value || !user || saveLoading.value || deleteLoading.value || deleteConfirmOpen.value) return false
    const request = scope.capture()

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
        assignedJobIds: currentRoleCanHaveAccountJobAssignments(role) ? detailForm.assignedJobIds : [],
      })

      if (request.draftCurrent()) {
        setDetailInfo('All changes saved.')
      }
      return request.draftCurrent()
    } catch (error) {
      if (request.draftCurrent()) {
        setDetailError(error, 'Failed to update user.')
      }
      return false
    } finally {
      if (request.current()) {
        saveLoading.value = false
        if (!request.draftCurrent()) queueDetailSave()
      }
    }
  }

  function queueDetailSave(delay = 450) {
    if (!scope.allowed.value || isCreateMode.value || !selectedUser.value || syncingDetailForm.value) return

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
      !scope.allowed.value ||
      !selectedUser.value ||
      editingSelf.value ||
      deleteLoading.value ||
      emailAction.value !== null ||
      saveLoading.value
    )
      return
    deletion = { id: selectedUser.value.id, current: scope.capture().current }
    deleteConfirmOpen.value = true
  }

  async function confirmDeleteUser() {
    if (deleteLoading.value || emailAction.value !== null || saveLoading.value) return
    const user = selectedUser.value
    const target = deletion
    if (!target?.current() || !deleteConfirmOpen.value || !user || user.id !== target.id || editingSelf.value) {
      deleteConfirmOpen.value = false
      return
    }

    setDetailErrorMessage('')
    deleteLoading.value = true
    try {
      const result = await deleteUserByAdmin(user.id)
      if (target.current()) {
        setDetailInfo(result.message || 'User deleted.')
        deleteLoading.value = false
        deleteConfirmOpen.value = false
        selectedUserId.value = null
        resetCreateForm()
      }
    } catch (error) {
      if (target.current()) {
        setDetailError(error, 'Failed to delete user.')
      }
    } finally {
      if (target.current()) deleteLoading.value = false
    }
  }

  function handleDetailAssignedJobToggle(jobId: string) {
    if (!scope.allowed.value || deleteLoading.value || deleteConfirmOpen.value || emailAction.value) return
    toggleDetailAssignedJob(jobId)

    if (syncingDetailForm.value || !selectedUser.value || isCreateMode.value) return

    void handleAutoSaveUser()
  }

  async function handleResendInvite() {
    const request = scope.capture()
    const user = selectedUser.value
    const email = user?.email?.trim()
    if (
      !scope.allowed.value ||
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

    if (!(await handleAutoSaveUser()) || !request.draftCurrent()) return

    emailAction.value = 'invite'
    try {
      const result = await resendUserInviteByAdmin(user.id)
      if (request.current()) {
        setDetailInfo(result.message || `Invite email sent to ${email}.`)
      }
    } catch (error) {
      if (request.current()) {
        setDetailError(error, `Failed to resend invite email to ${email}.`)
      }
    } finally {
      if (request.current()) emailAction.value = null
    }
  }

  async function handleSendPasswordReset() {
    const request = scope.capture()
    const user = selectedUser.value
    const email = user?.email?.trim()
    if (
      !scope.allowed.value ||
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

    if (!(await handleAutoSaveUser()) || !request.draftCurrent()) return

    emailAction.value = 'reset'
    try {
      const result = await sendUserPasswordResetByAdmin(user.id)
      if (request.current()) {
        setDetailInfo(result.message || `Password reset email sent to ${email}.`)
      }
    } catch (error) {
      if (request.current()) {
        setDetailError(error, `Failed to send password reset email to ${email}.`)
      }
    } finally {
      if (request.current()) emailAction.value = null
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
