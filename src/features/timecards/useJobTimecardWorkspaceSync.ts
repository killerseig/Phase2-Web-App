import { watch } from 'vue'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardWorkspaceSyncOptions {
  burdenValue: ReadonlyRef<number>
  cards: Ref<TimecardCardRecord[]>
  filteredCards: ReadonlyRef<TimecardCardRecord[]>
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  maybeBackfillSelectedDraftWeek: () => void | Promise<void>
  resetCardWorkspaceState: () => void
  resetPageAndSaveMessages: () => void
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekEndDate: ReadonlyRef<string>
  selectedWeekId: Ref<string | null>
  subscribeCardsForWeek: () => void
  subscribeJob: () => void
  subscribeWeeksForJob: () => void
  syncSelectedCardFromVisibleCards: (cards: TimecardCardRecord[]) => void
  weeks: Ref<TimecardWeekRecord[]>
}

export function useJobTimecardWorkspaceSync({
  burdenValue,
  cards,
  filteredCards,
  job,
  jobId,
  maybeBackfillSelectedDraftWeek,
  resetCardWorkspaceState,
  resetPageAndSaveMessages,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekId,
  subscribeCardsForWeek,
  subscribeJob,
  subscribeWeeksForJob,
  syncSelectedCardFromVisibleCards,
  weeks,
}: UseJobTimecardWorkspaceSyncOptions) {
  watch(
    () => selectedWeek.value?.id,
    () => {
      resetCardWorkspaceState()
      cards.value = []
      subscribeCardsForWeek()
    },
  )

  watch(
    () => selectedWeekEndDate.value,
    () => {
      resetCardWorkspaceState()
      cards.value = []
      void maybeBackfillSelectedDraftWeek()
    },
  )

  watch(
    () => jobId.value,
    () => {
      resetPageAndSaveMessages()
      resetCardWorkspaceState()
      selectedWeekId.value = null
      weeks.value = []
      cards.value = []
      subscribeJob()
      subscribeWeeksForJob()
    },
  )

  watch(
    () => job.value?.id,
    () => {
      void maybeBackfillSelectedDraftWeek()
    },
  )

  watch(
    () => burdenValue.value,
    () => {
      if (!selectedWeek.value) return
      subscribeCardsForWeek()
    },
  )

  watch(
    () => filteredCards.value.map((card) => card.id).join('|'),
    () => {
      syncSelectedCardFromVisibleCards(filteredCards.value)
    },
  )
}
