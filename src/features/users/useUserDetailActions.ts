import { currentRoleCanBeAssignedJobs } from '@/auth/roles'
import {
  getUserDetailUpdateRole,
  type UserDetailFormState,
} from '@/features/users/userViewHelpers'
import { deleteUserByAdmin, updateUser } from '@/services/users'
import type { UserProfile } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseUserDetailActionsOptions {
  deleteConfirmOpen: WritableRef<boolean>
  deleteLoading: WritableRef<boolean>
  detailError: ReadonlyRef<string>
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

  async function handleAutoSaveUser() {
    if (!selectedUser.value) return

    clearDetailSaveTimer()
    setDetailErrorMessage('')

    if (!hasUnsavedDetailChanges(selectedUser.value)) {
      setDetailInfo('Changes save automatically.')
      return
    }

    if (!detailForm.firstName.trim() || !detailForm.lastName.trim()) {
      setDetailErrorMessage('Enter the first name and last name.')
      return
    }

    saveLoading.value = true
    setDetailInfo('Saving changes...')
    try {
      const role = getUserDetailUpdateRole(selectedUser.value, detailForm.role)
      await updateUser(selectedUser.value.id, {
        firstName: detailForm.firstName,
        lastName: detailForm.lastName,
        role,
        active: detailForm.active,
        assignedJobIds: currentRoleCanBeAssignedJobs(role) ? detailForm.assignedJobIds : [],
      })

      setDetailInfo('All changes saved.')
    } catch (error) {
      setDetailError(error, 'Failed to update user.')
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
    if (!selectedUser.value || editingSelf.value) return
    deleteConfirmOpen.value = true
  }

  async function confirmDeleteUser() {
    if (!selectedUser.value || editingSelf.value) {
      deleteConfirmOpen.value = false
      return
    }

    setDetailErrorMessage('')
    deleteLoading.value = true
    try {
      const result = await deleteUserByAdmin(selectedUser.value.id)
      setDetailInfo(result.message || 'User deleted.')
      selectedUserId.value = null
      resetCreateForm()
      deleteConfirmOpen.value = false
    } catch (error) {
      setDetailError(error, 'Failed to delete user.')
    } finally {
      deleteLoading.value = false
    }
  }

  function handleDetailAssignedJobToggle(jobId: string) {
    toggleDetailAssignedJob(jobId)

    if (syncingDetailForm.value || !selectedUser.value || isCreateMode.value) return

    void handleAutoSaveUser()
  }

  return {
    clearDetailSaveTimer,
    confirmDeleteUser,
    handleAutoSaveUser,
    handleDeleteUser,
    handleDetailAssignedJobToggle,
    queueDetailSave,
  }
}
