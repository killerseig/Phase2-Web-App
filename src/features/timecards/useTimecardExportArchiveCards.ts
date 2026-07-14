import { reactive, ref } from 'vue'
import {
  decorateTimecardExportArchiveCards,
  getNextTimecardExportSortIndex,
  getTimecardExportWeekBurden,
  mergeTimecardExportRemoteArchiveCardsWithLocalState,
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { clearRecord } from '@/features/timecards/stateMapHelpers'
import { subscribeTimecardCards } from '@/services/timecards'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportArchiveCardsOptions {
  defaultBurden: number
  filteredWeeks: ReadonlyRef<TimecardWeekRecord[]>
  getJobs: () => readonly JobRecord[]
  getPendingStateMaps: () => ReadonlyArray<Readonly<Record<string, boolean>>>
  onCardsChanged: (cards: TimecardExportArchiveCardRecord[]) => void
  onError: (error: unknown, week: TimecardWeekRecord) => void
}

export function useTimecardExportArchiveCards(options: UseTimecardExportArchiveCardsOptions) {
  const cards = ref<TimecardExportArchiveCardRecord[]>([])
  const cardsLoading = ref(false)
  const cardsByWeekId = reactive<Record<string, TimecardExportArchiveCardRecord[]>>({})
  const pendingCardWeekIds = reactive<Record<string, boolean>>({})
  const cardSubscriptionStops = new Map<string, () => void>()

  function getWeekBurden(week: TimecardWeekRecord) {
    return getTimecardExportWeekBurden(week, options.getJobs(), options.defaultBurden)
  }

  function decorateArchiveCards(week: TimecardWeekRecord, nextCards: readonly TimecardCardRecord[]) {
    return decorateTimecardExportArchiveCards(week, nextCards, getWeekBurden(week))
  }

  function rebuildArchiveCards() {
    cards.value = options.filteredWeeks.value.flatMap((week) => cardsByWeekId[week.id] ?? [])
    options.onCardsChanged(cards.value)
  }

  function syncCardsLoadingState() {
    cardsLoading.value = Object.keys(pendingCardWeekIds).length > 0
  }

  function stopCardsSubscription(weekId?: string) {
    if (weekId) {
      cardSubscriptionStops.get(weekId)?.()
      cardSubscriptionStops.delete(weekId)
      delete cardsByWeekId[weekId]
      delete pendingCardWeekIds[weekId]
      return
    }

    cardSubscriptionStops.forEach((stop) => stop())
    cardSubscriptionStops.clear()
    clearRecord(cardsByWeekId)
    clearRecord(pendingCardWeekIds)
  }

  function mergeRemoteArchiveCardsWithLocalState(weekId: string, nextCards: TimecardExportArchiveCardRecord[]) {
    return mergeTimecardExportRemoteArchiveCardsWithLocalState(
      nextCards,
      cardsByWeekId[weekId] ?? [],
      options.getPendingStateMaps(),
    )
  }

  function syncCardsForFilteredWeeks() {
    const targetWeeks = options.filteredWeeks.value
    const targetWeekIds = new Set(targetWeeks.map((week) => week.id))

    Array.from(cardSubscriptionStops.keys()).forEach((weekId) => {
      if (!targetWeekIds.has(weekId)) {
        stopCardsSubscription(weekId)
      }
    })

    if (!targetWeeks.length) {
      cards.value = []
      options.onCardsChanged([])
      syncCardsLoadingState()
      return
    }

    targetWeeks.forEach((week) => {
      if (cardSubscriptionStops.has(week.id)) {
        const currentCards = cardsByWeekId[week.id]
        if (currentCards) {
          cardsByWeekId[week.id] = decorateArchiveCards(week, currentCards)
        }
        return
      }

      pendingCardWeekIds[week.id] = true
      const stop = subscribeTimecardCards(
        week.id,
        week.weekStartDate,
        getWeekBurden(week),
        (nextCards) => {
          cardsByWeekId[week.id] = mergeRemoteArchiveCardsWithLocalState(
            week.id,
            decorateArchiveCards(week, nextCards),
          )
          delete pendingCardWeekIds[week.id]
          rebuildArchiveCards()
          syncCardsLoadingState()
        },
        (error) => {
          delete pendingCardWeekIds[week.id]
          syncCardsLoadingState()
          options.onError(error, week)
        },
      )

      cardSubscriptionStops.set(week.id, stop)
    })

    rebuildArchiveCards()
    syncCardsLoadingState()
  }

  function redecorateLoadedCards() {
    Object.keys(cardsByWeekId).forEach((weekId) => {
      const week = options.filteredWeeks.value.find((entry) => entry.id === weekId)
      const currentCards = cardsByWeekId[weekId]
      if (!week || !currentCards) return
      cardsByWeekId[weekId] = decorateArchiveCards(week, currentCards)
    })

    rebuildArchiveCards()
  }

  function deleteWeekCache(weekId: string) {
    delete cardsByWeekId[weekId]
    delete pendingCardWeekIds[weekId]
    rebuildArchiveCards()
    syncCardsLoadingState()
  }

  function getNextSortIndexForWeek(weekId: string) {
    return getNextTimecardExportSortIndex(cardsByWeekId[weekId] ?? [])
  }

  return {
    cards,
    cardsByWeekId,
    cardsLoading,
    deleteWeekCache,
    getNextSortIndexForWeek,
    rebuildArchiveCards,
    redecorateLoadedCards,
    stopCardsSubscription,
    syncCardsForFilteredWeeks,
  }
}
