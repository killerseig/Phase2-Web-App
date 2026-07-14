import { computed } from 'vue'
import {
  filterTimecardExportCards,
  sortTimecardExportCardsForMode,
  type TimecardExportArchiveCardRecord,
  type TimecardExportSortMode,
} from '@/features/timecards/exportViewHelpers'
import type { TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface TimecardExportVisibleCardFilters {
  cardSearch: string
}

interface UseTimecardExportVisibleCardsOptions {
  cards: ReadonlyRef<TimecardExportArchiveCardRecord[]>
  cardsByWeekId: Record<string, TimecardExportArchiveCardRecord[]>
  collator: Intl.Collator
  filters: TimecardExportVisibleCardFilters
  sortMode: ReadonlyRef<TimecardExportSortMode>
  targetCreateWeek: ReadonlyRef<TimecardWeekRecord | null>
}

export function useTimecardExportVisibleCards({
  cards,
  cardsByWeekId,
  collator,
  filters,
  sortMode,
  targetCreateWeek,
}: UseTimecardExportVisibleCardsOptions) {
  const activeCreateWeekCards = computed(() => {
    const week = targetCreateWeek.value
    if (!week) return [] as TimecardExportArchiveCardRecord[]
    return cardsByWeekId[week.id] ?? []
  })
  const filteredCards = computed(() => filterTimecardExportCards(cards.value, filters.cardSearch))
  const orderedCards = computed(() => sortTimecardExportCardsForMode(filteredCards.value, sortMode.value, collator))

  return {
    activeCreateWeekCards,
    filteredCards,
    orderedCards,
  }
}
