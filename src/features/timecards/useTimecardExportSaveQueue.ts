import type { TimecardExportArchiveCardRecord } from '@/features/timecards/exportViewHelpers'
import { useTimecardSaveQueue } from '@/features/timecards/useTimecardSaveQueue'
import { updateTimecardCard } from '@/services/timecards'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseTimecardExportSaveQueueOptions {
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<readonly TimecardExportArchiveCardRecord[]>
  getCurrentUserId?: () => string | null
}

export function useTimecardExportSaveQueue({
  canEditWeek,
  cards,
  getCurrentUserId,
}: UseTimecardExportSaveQueueOptions) {
  return useTimecardSaveQueue<TimecardExportArchiveCardRecord>({
    canSave: () => canEditWeek.value,
    getCards: () => cards.value,
    context: () => `${getCurrentUserId?.() ?? ''}|${canEditWeek.value}`,
    saveCard: async (card) => {
      await updateTimecardCard(
        card.archiveWeekId,
        card.id,
        card.archiveWeekStartDate,
        card,
        card.archiveBurden,
      )
    },
  })
}
