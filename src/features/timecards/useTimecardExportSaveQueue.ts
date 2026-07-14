import type { TimecardExportArchiveCardRecord } from '@/features/timecards/exportViewHelpers'
import { useTimecardSaveQueue } from '@/features/timecards/useTimecardSaveQueue'
import { updateTimecardCard } from '@/services/timecards'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportSaveQueueOptions {
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<readonly TimecardExportArchiveCardRecord[]>
}

export function useTimecardExportSaveQueue({
  canEditWeek,
  cards,
}: UseTimecardExportSaveQueueOptions) {
  return useTimecardSaveQueue<TimecardExportArchiveCardRecord>({
    canSave: () => canEditWeek.value,
    getCards: () => cards.value,
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
