interface DirtySnapshotHydrationOptions {
  incomingSignature: string
  lastSavedSignature: string
  localSignature: string
  protectLocalMismatch?: boolean
  selectionChanged?: boolean
  trackUnsavedLocalChanges?: boolean
}

export function shouldHydrateDirtySnapshot({
  incomingSignature,
  lastSavedSignature,
  localSignature,
  protectLocalMismatch = false,
  selectionChanged = false,
  trackUnsavedLocalChanges = false,
}: DirtySnapshotHydrationOptions) {
  if (selectionChanged) return true

  if (trackUnsavedLocalChanges && localSignature !== lastSavedSignature) return false
  if (incomingSignature === lastSavedSignature) return false
  if (protectLocalMismatch && localSignature !== incomingSignature) return false

  return true
}
