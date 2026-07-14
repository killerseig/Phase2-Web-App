import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { useSubscribedValue } from '@/composables/useSubscribedValue'
import { createEmptyNotificationRecipients } from '@/features/jobs/jobViewHelpers'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import { subscribeUsers } from '@/services/users'
import type { NotificationRecipients, UserProfile } from '@/types/domain'

interface UseJobsAdminSubscriptionsOptions {
  getIsAdmin: () => boolean
  setDetailError: (error: unknown, fallbackMessage: string) => void
}

export function useJobsAdminSubscriptions({
  getIsAdmin,
  setDetailError,
}: UseJobsAdminSubscriptionsOptions) {
  const {
    error: usersError,
    loading: usersLoading,
    records: users,
    start: startUsersSubscription,
    stop: stopUsersSubscription,
  } = useSubscribedRecords<UserProfile>(subscribeUsers, {
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
    if (!getIsAdmin()) return

    startUsersSubscription()
    startGlobalNotificationRecipientsSubscription()
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
