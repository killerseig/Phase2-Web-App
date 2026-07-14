import { onBeforeUnmount, onMounted } from 'vue'

interface UseTimecardExportLifecycleOptions {
  disconnectCardMeasurements: () => void
  disposeSaveQueue: () => void
  startEmployeesSubscription: () => void
  startJobsSubscription: () => void
  startUsersSubscription: () => void
  startWeeksSubscription: () => void
  stopCardsSubscription: () => void
  stopEmployeesSubscription: () => void
  stopUsersSubscription: () => void
  stopWeeksSubscription: () => void
}

export function useTimecardExportLifecycle({
  disconnectCardMeasurements,
  disposeSaveQueue,
  startEmployeesSubscription,
  startJobsSubscription,
  startUsersSubscription,
  startWeeksSubscription,
  stopCardsSubscription,
  stopEmployeesSubscription,
  stopUsersSubscription,
  stopWeeksSubscription,
}: UseTimecardExportLifecycleOptions) {
  onMounted(() => {
    startJobsSubscription()
    startWeeksSubscription()
    startEmployeesSubscription()
    startUsersSubscription()
  })

  onBeforeUnmount(() => {
    disposeSaveQueue()
    disconnectCardMeasurements()
    stopWeeksSubscription()
    stopCardsSubscription()
    stopEmployeesSubscription()
    stopUsersSubscription()
  })
}
