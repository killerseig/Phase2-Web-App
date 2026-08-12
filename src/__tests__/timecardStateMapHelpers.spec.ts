import { describe, expect, it } from 'vitest'

import {
  clearBooleanRecord,
  clearRecord,
  collectTimecardPendingStateMaps,
  pruneRecordToIds,
} from '@/features/timecards/stateMapHelpers'

describe('timecard state map helpers', () => {
  it('clears generic and boolean state maps in place', () => {
    const generic = {
      'card-a': 'saving',
      'card-b': 'queued',
    }
    const booleanMap = {
      'card-a': true,
      'card-b': false,
    }

    clearRecord(generic)
    clearBooleanRecord(booleanMap)

    expect(generic).toEqual({})
    expect(booleanMap).toEqual({})
  })

  it('prunes state maps to the valid card ids', () => {
    const stateMap = {
      'card-a': true,
      'card-b': true,
      'card-c': true,
    }

    pruneRecordToIds(stateMap, new Set(['card-a', 'card-c']))

    expect(stateMap).toEqual({
      'card-a': true,
      'card-c': true,
    })
  })

  it('collects pending save maps in the order expected by timecard subscription adapters', () => {
    const scheduledSaveIds = { 'card-scheduled': true }
    const savingIds = { 'card-saving': true }
    const queuedSaveIds = { 'card-queued': true }

    const pendingMaps = collectTimecardPendingStateMaps(scheduledSaveIds, savingIds, queuedSaveIds)

    expect(pendingMaps).toEqual([scheduledSaveIds, savingIds, queuedSaveIds])
    expect(pendingMaps[0]).toBe(scheduledSaveIds)
    expect(pendingMaps[1]).toBe(savingIds)
    expect(pendingMaps[2]).toBe(queuedSaveIds)
  })
})
