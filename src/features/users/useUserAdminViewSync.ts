import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { UserProfile } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import type { UserDetailSnapshot } from './userViewHelpers'

type UseUserAdminViewSyncOptions = {
  applyUserToDetailForm: (user: UserProfile | null) => void | Promise<void>
  clearDetailSaveTimer: () => void
  getDetailFormSnapshot: () => UserDetailSnapshot
  queueDetailSave: () => void
  resetCreateForm: () => void
  resetDetailJobSearchTerm: () => void
  selectedUser: ReadonlyRef<UserProfile | null>
  selectedUserId: WritableRef<string | 'new' | null>
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  startJobsSubscription: () => void
  startUsersSubscription: () => void
  stopJobsSubscription: () => void
  stopUsersSubscription: () => void
}

export function useUserAdminViewSync({
  applyUserToDetailForm,
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
  watch(() => selectedUserId.value, (nextValue) => {
    clearDetailSaveTimer()
    setDetailErrorMessage('')
    setDetailInfo(nextValue && nextValue !== 'new' ? 'Changes save automatically.' : '')
    resetDetailJobSearchTerm()
  })

  watch(() => selectedUser.value, (user) => {
    clearDetailSaveTimer()

    if (!user) {
      if (selectedUserId.value === 'new') {
        resetCreateForm()
      }
      void applyUserToDetailForm(null)
      return
    }

    void applyUserToDetailForm(user)
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
