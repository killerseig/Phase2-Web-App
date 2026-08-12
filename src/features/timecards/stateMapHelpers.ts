export type TimecardPendingStateMap = Readonly<Record<string, boolean>>

export function clearRecord<T>(stateMap: Record<string, T>) {
  Object.keys(stateMap).forEach((key) => {
    delete stateMap[key]
  })
}

export function clearBooleanRecord(stateMap: Record<string, boolean>) {
  clearRecord(stateMap)
}

export function pruneRecordToIds<T>(stateMap: Record<string, T>, validIds: ReadonlySet<string>) {
  Object.keys(stateMap).forEach((key) => {
    if (!validIds.has(key)) {
      delete stateMap[key]
    }
  })
}

export function collectTimecardPendingStateMaps(
  scheduledSaveIds: TimecardPendingStateMap,
  savingIds: TimecardPendingStateMap,
  queuedSaveIds: TimecardPendingStateMap,
) {
  return [scheduledSaveIds, savingIds, queuedSaveIds] as const
}
