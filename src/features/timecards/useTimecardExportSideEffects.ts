import { watch } from 'vue'
import type { JobRecord, TimecardCardRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

type UseTimecardExportSideEffectsOptions<TCard extends TimecardCardRecord> = {
  getJobs: () => readonly JobRecord[]
  orderedCards: ReadonlyRef<readonly TCard[]>
  redecorateLoadedCards: () => void
  syncSelectedCardFromVisibleCards: (cards: readonly TCard[]) => void
}

export function useTimecardExportSideEffects<TCard extends TimecardCardRecord>({
  getJobs,
  orderedCards,
  redecorateLoadedCards,
  syncSelectedCardFromVisibleCards,
}: UseTimecardExportSideEffectsOptions<TCard>) {
  watch(
    () => getJobs().map((job) => `${job.id}:${job.productionBurden ?? ''}`).join('|'),
    () => {
      redecorateLoadedCards()
    },
  )

  watch(
    () => orderedCards.value.map((card) => card.id).join('|'),
    () => {
      syncSelectedCardFromVisibleCards(orderedCards.value)
    },
  )
}
