import { watch } from 'vue'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseJobTimecardWorkspaceSyncOptions {
  burdenValue: ReadonlyRef<number>
  cards: WritableRef<TimecardCardRecord[]>
  filteredCards: ReadonlyRef<TimecardCardRecord[]>
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  maybeBackfillSelectedDraftWeek: () => void | Promise<void>
  resetCardWorkspaceState: () => void
  resetPageAndSaveMessages: () => void
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekEndDate: WritableRef<string>
  selectedWeekId: WritableRef<string | null>
  subscribeCardsForWeek: () => void
  subscribeJob: () => void
  subscribeWeeksForJob: () => void
  syncSelectedCardFromVisibleCards: (cards: TimecardCardRecord[]) => void
  weekSubscriptionKey: ReadonlyRef<string>
  weeks: WritableRef<TimecardWeekRecord[]>
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
  weekSubscriptionKey,
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
    () => weeks.value.map((week) => `${week.id}:${week.weekEndDate}`).join('|'),
    () => {
      if (selectedWeekEndDate.value || selectedWeekId.value || !weeks.value.length) return

      const nextWeek = weeks.value[0]
      if (!nextWeek) return

      selectedWeekEndDate.value = nextWeek.weekEndDate
      selectedWeekId.value = nextWeek.id
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
    () => weekSubscriptionKey.value,
    () => {
      if (!jobId.value) return

      resetPageAndSaveMessages()
      weeks.value = []
      cards.value = []
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
