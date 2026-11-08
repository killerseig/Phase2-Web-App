import { useTimecardSaveQueue } from '@/features/timecards/useTimecardSaveQueue'
import { updateTimecardCard } from '@/services/timecards'
import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseJobTimecardSaveQueueOptions {
  burdenValue: ReadonlyRef<number>
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<readonly TimecardCardRecord[]>
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekStartDate: ReadonlyRef<string>
  getCurrentUserId?: () => string | null
}

export function useJobTimecardSaveQueue({
  burdenValue,
  canEditWeek,
  cards,
  selectedWeek,
  selectedWeekStartDate,
  getCurrentUserId,
}: UseJobTimecardSaveQueueOptions) {
  return useTimecardSaveQueue<TimecardCardRecord>({
    canSave: () => !!selectedWeek.value && canEditWeek.value,
    getCards: () => cards.value,
    context: () => `${getCurrentUserId?.() ?? ''}|${selectedWeek.value?.id ?? ''}|${canEditWeek.value}`,
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
