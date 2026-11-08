import { useAdminRecords } from '@/features/admin/useAdminRecords'
import { watch } from 'vue'
import type { AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { subscribeVisibleJobs } from '@/services/jobs'
import { subscribeUsers } from '@/services/users'
import type { JobRecord, UserProfile } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseUserAdminRecordsOptions {
  context?: AdminRequestContext
  deleting?: ReadonlyRef<boolean>
  selectedUserId: WritableRef<string | 'new' | null>
}

export function useUserAdminRecords({
  context,
  deleting,
  selectedUserId,
}: UseUserAdminRecordsOptions) {
  const subscribeAssignableJobs = (
    onUpdate: (records: JobRecord[]) => void,
    onError?: (error: unknown) => void,
  ) => subscribeVisibleJobs(undefined, onUpdate, onError)

  const {
    error: jobsError,
    loading: jobsLoading,
    records: jobs,
    start: startJobsSubscription,
    stop: stopJobsSubscription,
  } = useAdminRecords<JobRecord>(subscribeAssignableJobs, {
    context,
    errorMessage: 'Failed to load jobs.',
  })

  const {
    error: usersError,
    loading: usersLoading,
    records: users,
    start: startUsersSubscription,
    stop: stopUsersSubscription,
  } = useAdminRecords<UserProfile>(subscribeUsers, {
    context,
    errorMessage: 'Failed to load users.',
    onUpdate: reconcileSelection,
  })
  function reconcileSelection(nextUsers: UserProfile[]) {
    // The deletion owner reports its result before releasing its selection.
    // Listener removal may arrive before the callable response.
    if (
      !deleting?.value &&
      selectedUserId.value &&
      selectedUserId.value !== 'new' &&
      !nextUsers.some((user) => user.id === selectedUserId.value)
    ) {
      selectedUserId.value = null
    }
  }
  if (deleting) watch(() => deleting.value, () => reconcileSelection(users.value), { flush: 'sync' })

  return {
    jobs,
    jobsError,
    jobsLoading,
    startJobsSubscription,
    stopJobsSubscription,
    users,
    usersError,
    usersLoading,
    startUsersSubscription,
    stopUsersSubscription,
  }
}
