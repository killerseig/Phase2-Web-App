import { useTimecardSaveQueue } from '@/features/timecards/useTimecardSaveQueue'
import { updateTimecardCard } from '@/services/timecards'
import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardSaveQueueOptions {
  burdenValue: ReadonlyRef<number>
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<readonly TimecardCardRecord[]>
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekStartDate: ReadonlyRef<string>
}

export function useJobTimecardSaveQueue({
  burdenValue,
  canEditWeek,
  cards,
  selectedWeek,
  selectedWeekStartDate,
}: UseJobTimecardSaveQueueOptions) {
  return useTimecardSaveQueue<TimecardCardRecord>({
    canSave: () => !!selectedWeek.value && canEditWeek.value,
    getCards: () => cards.value,
    saveCard: async (card) => {
      const week = selectedWeek.value
      if (!week) return
      await updateTimecardCard(
        week.id,
        card.id,
        selectedWeekStartDate.value,
        card,
        burdenValue.value,
      )
    },
  })
}
