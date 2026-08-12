import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportFilteredWeekSync } from '@/features/timecards/useTimecardExportFilteredWeekSync'
import { createWorkbookLines } from '@/features/timecards/workbook'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'foreman-cj',
    status: 'submitted',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  return {
    id: 'card-1',
    archiveBurden: 0.33,
    archiveForemanName: 'CJ Blanchard',
    archiveJobCode: '736',
    archiveJobId: 'job-shop',
    archiveJobName: 'Shop',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekStatus: 'submitted',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'CJ',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Blanchard, CJ',
    isContractor: false,
    lastName: 'Blanchard',
    lines: createWorkbookLines('2026-06-14'),
    notes: '',
    occupation: 'Shop Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: null,
    ...overrides,
  }
}

interface Deferred<T = void> {
  promise: Promise<T>
  reject: (reason?: unknown) => void
  resolve: (value?: T | PromiseLike<T>) => void
}

function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value?: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve as (value?: T | PromiseLike<T>) => void
    reject = innerReject
  })

  return {
    promise,
    reject,
    resolve,
  }
}

async function flushWatchers() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

function mountFilteredWeekSync(options: {
  cards?: TimecardExportArchiveCardRecord[]
  filteredWeeks?: TimecardWeekRecord[]
  flushPendingSaves?: () => Promise<void>
  hasQueuedWork?: () => boolean
} = {}) {
  const cards = ref<TimecardExportArchiveCardRecord[]>(options.cards ?? [])
  const filteredWeeks = ref<TimecardWeekRecord[]>(options.filteredWeeks ?? [makeWeek()])
  const calls: string[] = []
  const flushPendingSaves = vi.fn(options.flushPendingSaves ?? (async () => {
    calls.push('flush-saves')
  }))
  const hasQueuedWork = vi.fn(options.hasQueuedWork ?? (() => false))
  const resetCardWorkspaceState = vi.fn(() => {
    calls.push('reset-workspace')
  })
  const resetPageAndSaveMessages = vi.fn(() => {
    calls.push('reset-messages')
  })
  const syncCardsForFilteredWeeks = vi.fn(() => {
    calls.push('sync-cards')
  })
  const scope = effectScope()

  scope.run(() => {
    useTimecardExportFilteredWeekSync({
      cards,
      filteredWeeks,
      flushPendingSaves,
      hasQueuedWork,
      resetCardWorkspaceState,
      resetPageAndSaveMessages,
      syncCardsForFilteredWeeks,
    })
  })

  return {
    calls,
    cards,
    filteredWeeks,
    flushPendingSaves,
    hasQueuedWork,
    resetCardWorkspaceState,
    resetPageAndSaveMessages,
    scope,
    syncCardsForFilteredWeeks,
  }
}

describe('useTimecardExportFilteredWeekSync', () => {
  it('immediately resets messages/workspace and syncs cards when no pending work exists', () => {
    const {
      calls,
      flushPendingSaves,
      hasQueuedWork,
      resetCardWorkspaceState,
      resetPageAndSaveMessages,
      scope,
      syncCardsForFilteredWeeks,
    } = mountFilteredWeekSync()

    expect(hasQueuedWork).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(resetCardWorkspaceState).toHaveBeenCalledTimes(1)
    expect(syncCardsForFilteredWeeks).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['reset-messages', 'reset-workspace', 'sync-cards'])

    scope.stop()
  })

  it('flushes pending saves before resetting and syncing when loaded cards are visible', async () => {
    const {
      calls,
      flushPendingSaves,
      hasQueuedWork,
      resetCardWorkspaceState,
      resetPageAndSaveMessages,
      scope,
      syncCardsForFilteredWeeks,
    } = mountFilteredWeekSync({
      cards: [makeCard()],
    })

    await flushWatchers()

    expect(hasQueuedWork).not.toHaveBeenCalled()
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(resetCardWorkspaceState).toHaveBeenCalledTimes(1)
    expect(syncCardsForFilteredWeeks).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['flush-saves', 'reset-messages', 'reset-workspace', 'sync-cards'])

    scope.stop()
  })

  it('flushes queued work even when no cards are currently loaded', async () => {
    const {
      calls,
      flushPendingSaves,
      hasQueuedWork,
      scope,
    } = mountFilteredWeekSync({
      hasQueuedWork: () => true,
    })

    await flushWatchers()

    expect(hasQueuedWork).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['flush-saves', 'reset-messages', 'reset-workspace', 'sync-cards'])

    scope.stop()
  })

  it('reruns sync when the filtered-week signature changes', async () => {
    const {
      calls,
      filteredWeeks,
      scope,
      syncCardsForFilteredWeeks,
    } = mountFilteredWeekSync()

    filteredWeeks.value = [
      makeWeek({
        id: 'week-2',
        jobId: 'job-lucky',
        status: 'draft',
        weekEndDate: '2026-06-27',
        weekStartDate: '2026-06-21',
      }),
    ]
    await flushWatchers()

    expect(syncCardsForFilteredWeeks).toHaveBeenCalledTimes(2)
    expect(calls).toEqual([
      'reset-messages',
      'reset-workspace',
      'sync-cards',
      'reset-messages',
      'reset-workspace',
      'sync-cards',
    ])

    scope.stop()
  })

  it('does not rerun sync for week fields outside the tracked signature', async () => {
    const {
      filteredWeeks,
      scope,
      syncCardsForFilteredWeeks,
    } = mountFilteredWeekSync()

    filteredWeeks.value = [
      makeWeek({
        jobName: 'Renamed Shop',
        ownerForemanName: 'Renamed Foreman',
      }),
    ]
    await flushWatchers()

    expect(syncCardsForFilteredWeeks).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('ignores stale sync work when the filtered-week signature changes during a pending flush', async () => {
    const pendingFlushes: Array<Deferred> = []
    const calls: string[] = []
    const {
      filteredWeeks,
      resetCardWorkspaceState,
      resetPageAndSaveMessages,
      scope,
      syncCardsForFilteredWeeks,
    } = mountFilteredWeekSync({
      cards: [makeCard()],
      flushPendingSaves: () => {
        calls.push('flush-saves')
        const deferred = createDeferred()
        pendingFlushes.push(deferred)
        return deferred.promise
      },
    })

    expect(pendingFlushes).toHaveLength(1)

    filteredWeeks.value = [
      makeWeek({
        id: 'week-2',
        weekEndDate: '2026-06-27',
        weekStartDate: '2026-06-21',
      }),
    ]
    await nextTick()

    expect(pendingFlushes).toHaveLength(2)

    pendingFlushes[0]!.resolve()
    await flushWatchers()

    expect(resetPageAndSaveMessages).not.toHaveBeenCalled()
    expect(resetCardWorkspaceState).not.toHaveBeenCalled()
    expect(syncCardsForFilteredWeeks).not.toHaveBeenCalled()

    pendingFlushes[1]!.resolve()
    await flushWatchers()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(resetCardWorkspaceState).toHaveBeenCalledTimes(1)
    expect(syncCardsForFilteredWeeks).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['flush-saves', 'flush-saves'])

    scope.stop()
  })
})
