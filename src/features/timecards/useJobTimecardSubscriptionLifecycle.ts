import { onBeforeUnmount, onMounted } from 'vue'
import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

type UseJobTimecardSubscriptionLifecycleOptions = {
  cards: Ref<TimecardCardRecord[]>
  cardsLoading: Ref<boolean>
  disconnectCardMeasurements: () => void
  disposeSaveQueue: () => void
  jobId: ReadonlyRef<string | null>
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  startCardsRecordsSubscription: () => void
  startEmployeesSubscription: () => void
  startWeeksRecordsSubscription: () => void
  stopCardsRecordsSubscription: () => void
  stopEmployeesSubscription: () => void
  stopRouteJobSubscription: () => void
  stopWeeksRecordsSubscription: () => void
  subscribeRouteJob: () => void
}

export function useJobTimecardSubscriptionLifecycle({
  cards,
  cardsLoading,
  disconnectCardMeasurements,
  disposeSaveQueue,
  jobId,
  selectedWeek,
  startCardsRecordsSubscription,
  startEmployeesSubscription,
  startWeeksRecordsSubscription,
  stopCardsRecordsSubscription,
  stopEmployeesSubscription,
  stopRouteJobSubscription,
  stopWeeksRecordsSubscription,
  subscribeRouteJob,
}: UseJobTimecardSubscriptionLifecycleOptions) {
  function stopWeeksSubscription() {
    stopWeeksRecordsSubscription()
  }

  function stopCardsSubscription() {
    stopCardsRecordsSubscription()
  }

  function subscribeJob() {
    subscribeRouteJob()
  }

  function subscribeWeeksForJob() {
    if (!jobId.value) return
    startWeeksRecordsSubscription()
  }

  function subscribeCardsForWeek() {
    stopCardsSubscription()

    if (!selectedWeek.value) {
      cards.value = []
      cardsLoading.value = false
      return
    }

    cardsLoading.value = true
    startCardsRecordsSubscription()
  }

  onMounted(() => {
    subscribeJob()
    subscribeWeeksForJob()
    startEmployeesSubscription()
  })

  onBeforeUnmount(() => {
    disposeSaveQueue()
    disconnectCardMeasurements()
    stopWeeksSubscription()
    stopCardsSubscription()
    stopEmployeesSubscription()
    stopRouteJobSubscription()
  })

  return {
    subscribeCardsForWeek,
    subscribeJob,
    subscribeWeeksForJob,
  }
}
