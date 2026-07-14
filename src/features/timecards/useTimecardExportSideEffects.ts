import { watch, type ComputedRef } from 'vue'
import type { JobRecord, TimecardCardRecord } from '@/types/domain'

type UseTimecardExportSideEffectsOptions<TCard extends TimecardCardRecord> = {
  getJobs: () => readonly JobRecord[]
  orderedCards: ComputedRef<TCard[]>
  redecorateLoadedCards: () => void
  syncSelectedCardFromVisibleCards: (cards: TCard[]) => void
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
