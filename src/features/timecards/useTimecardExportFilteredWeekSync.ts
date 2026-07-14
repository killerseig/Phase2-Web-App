import { watch } from 'vue'
import type { TimecardExportArchiveCardRecord } from '@/features/timecards/exportViewHelpers'
import type { TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportFilteredWeekSyncOptions {
  cards: ReadonlyRef<TimecardExportArchiveCardRecord[]>
  filteredWeeks: ReadonlyRef<TimecardWeekRecord[]>
  flushPendingSaves: () => Promise<void>
  hasQueuedWork: () => boolean
  resetCardWorkspaceState: () => void
  resetPageAndSaveMessages: () => void
  syncCardsForFilteredWeeks: () => void
}

function buildFilteredWeeksSignature(weeks: TimecardWeekRecord[]) {
  return weeks
    .map((week) => `${week.id}:${week.weekStartDate}:${week.weekEndDate}:${week.jobId}:${week.status}`)
    .join('|')
}

export function useTimecardExportFilteredWeekSync({
  cards,
  filteredWeeks,
  flushPendingSaves,
  hasQueuedWork,
  resetCardWorkspaceState,
  resetPageAndSaveMessages,
  syncCardsForFilteredWeeks,
}: UseTimecardExportFilteredWeekSyncOptions) {
  let syncToken = 0

  watch(
    () => buildFilteredWeeksSignature(filteredWeeks.value),
    async () => {
      const currentSyncToken = ++syncToken
      if (cards.value.length || hasQueuedWork()) {
        await flushPendingSaves()
        if (currentSyncToken !== syncToken) return
      }

      resetPageAndSaveMessages()
      resetCardWorkspaceState()
      syncCardsForFilteredWeeks()
    },
    { immediate: true },
  )
}
