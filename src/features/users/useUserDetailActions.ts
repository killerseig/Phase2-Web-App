import type { UserDetailFormState } from '@/features/users/userViewHelpers'
import { deleteUserByAdmin, updateUser } from '@/services/users'
import type { UserProfile } from '@/types/domain'
import { roleCanBeAssignedJobs } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseUserDetailActionsOptions {
  deleteConfirmOpen: Ref<boolean>
  deleteLoading: Ref<boolean>
  detailError: ReadonlyRef<string>
  detailForm: UserDetailFormState
  editingSelf: ReadonlyRef<boolean>
  hasUnsavedDetailChanges: () => boolean
  isCreateMode: ReadonlyRef<boolean>
  resetCreateForm: () => void
  saveLoading: Ref<boolean>
  selectedUser: ReadonlyRef<UserProfile | null>
  selectedUserId: Ref<string | 'new' | null>
  setDetailError: (error: unknown, fallback: string) => void
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  syncingDetailForm: ReadonlyRef<boolean>
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

    if (!hasUnsavedDetailChanges()) {
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
      await updateUser(selectedUser.value.id, {
        firstName: detailForm.firstName,
        lastName: detailForm.lastName,
        role: detailForm.role,
        active: detailForm.active,
        assignedJobIds: roleCanBeAssignedJobs(detailForm.role) ? detailForm.assignedJobIds : [],
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

    if (!hasUnsavedDetailChanges()) {
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

  return {
    clearDetailSaveTimer,
    confirmDeleteUser,
    handleAutoSaveUser,
    handleDeleteUser,
    queueDetailSave,
  }
}
