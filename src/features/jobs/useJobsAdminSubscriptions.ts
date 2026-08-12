import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { useSubscribedValue } from '@/composables/useSubscribedValue'
import { createEmptyNotificationRecipients } from '@/features/jobs/jobViewHelpers'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import { subscribeAssignableUsers } from '@/services/users'
import type { NotificationRecipients, UserProfile } from '@/types/domain'

interface UseJobsAdminSubscriptionsOptions {
  getCanLoadAssignableUsers: () => boolean
  getCanManageGlobalRecipients: () => boolean
  setDetailError: (error: unknown, fallbackMessage: string) => void
}

export function useJobsAdminSubscriptions({
  getCanLoadAssignableUsers,
  getCanManageGlobalRecipients,
  setDetailError,
}: UseJobsAdminSubscriptionsOptions) {
  const {
    error: usersError,
    loading: usersLoading,
    records: users,
    start: startUsersSubscription,
    stop: stopUsersSubscription,
  } = useSubscribedRecords<UserProfile>(subscribeAssignableUsers, {
    errorMessage: 'Failed to load assignable users.',
    initialLoading: false,
  })
  const {
    start: startGlobalNotificationRecipientsSubscription,
    stop: stopGlobalNotificationRecipientsSubscription,
    value: globalNotificationRecipients,
  } = useSubscribedValue<NotificationRecipients>(
    subscribeGlobalNotificationRecipients,
    createEmptyNotificationRecipients(),
    {
      errorMessage: 'Failed to load all-jobs recipients.',
      initialLoading: false,
      onError: (error) => {
        setDetailError(error, 'Failed to load all-jobs recipients.')
      },
    },
  )

  function startAdminSubscriptions() {
    if (getCanLoadAssignableUsers()) startUsersSubscription()
    if (getCanManageGlobalRecipients()) startGlobalNotificationRecipientsSubscription()
  }

  function stopAdminSubscriptions() {
    stopUsersSubscription()
    stopGlobalNotificationRecipientsSubscription()
  }

  return {
    globalNotificationRecipients,
    startAdminSubscriptions,
    stopAdminSubscriptions,
    users,
    usersError,
    usersLoading,
  }
}
