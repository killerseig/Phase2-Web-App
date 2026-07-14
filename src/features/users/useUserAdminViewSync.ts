import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue'
import type { UserProfile } from '@/types/domain'
import type { UserDetailSnapshot } from './userViewHelpers'

type UseUserAdminViewSyncOptions = {
  applySelectedUserToForm: (user: UserProfile | null) => void | Promise<void>
  clearDetailSaveTimer: () => void
  getDetailFormSnapshot: () => UserDetailSnapshot
  queueDetailSave: () => void
  resetCreateForm: () => void
  resetDetailJobSearchTerm: () => void
  selectedUser: ComputedRef<UserProfile | null>
  selectedUserId: Ref<string | 'new' | null>
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  startJobsSubscription: () => void
  startUsersSubscription: () => void
  stopJobsSubscription: () => void
  stopUsersSubscription: () => void
}

export function useUserAdminViewSync({
  applySelectedUserToForm,
  clearDetailSaveTimer,
  getDetailFormSnapshot,
  queueDetailSave,
  resetCreateForm,
  resetDetailJobSearchTerm,
  selectedUser,
  selectedUserId,
  setDetailErrorMessage,
  setDetailInfo,
  startJobsSubscription,
  startUsersSubscription,
  stopJobsSubscription,
  stopUsersSubscription,
}: UseUserAdminViewSyncOptions) {
  watch(selectedUserId, (nextValue) => {
    clearDetailSaveTimer()
    setDetailErrorMessage('')
    setDetailInfo(nextValue && nextValue !== 'new' ? 'Changes save automatically.' : '')
    resetDetailJobSearchTerm()
  })

  watch(selectedUser, (user) => {
    if (!user) {
      if (selectedUserId.value === 'new') {
        resetCreateForm()
      }
      void applySelectedUserToForm(null)
      return
    }

    void applySelectedUserToForm(user)
  })

  watch(
    () => JSON.stringify(getDetailFormSnapshot()),
    () => {
      queueDetailSave()
    },
  )

  onMounted(() => {
    startUsersSubscription()
    startJobsSubscription()
  })

  onBeforeUnmount(() => {
    clearDetailSaveTimer()
    stopUsersSubscription()
    stopJobsSubscription()
  })
}
