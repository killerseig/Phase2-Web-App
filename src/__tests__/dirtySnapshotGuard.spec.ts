import { describe, expect, it } from 'vitest'

import { shouldHydrateDirtySnapshot } from '@/utils/dirtySnapshotGuard'

describe('dirty snapshot guard', () => {
  it('hydrates immediately when the selected record changes', () => {
    expect(
      shouldHydrateDirtySnapshot({
        incomingSignature: 'incoming',
        lastSavedSignature: 'saved',
        localSignature: 'dirty local',
        selectionChanged: true,
        trackUnsavedLocalChanges: true,
      }),
    ).toBe(true)
  })

  it('blocks hydration when editable local state has unsaved changes', () => {
    expect(
      shouldHydrateDirtySnapshot({
        incomingSignature: 'incoming',
        lastSavedSignature: 'saved',
        localSignature: 'dirty local',
        trackUnsavedLocalChanges: true,
      }),
    ).toBe(false)
  })

  it('skips hydration when the incoming snapshot matches the saved signature', () => {
    expect(
      shouldHydrateDirtySnapshot({
        incomingSignature: 'saved',
        lastSavedSignature: 'saved',
        localSignature: 'saved',
      }),
    ).toBe(false)
  })

  it('blocks hydration when a feature wants to protect mismatched local form state', () => {
    expect(
      shouldHydrateDirtySnapshot({
        incomingSignature: 'remote edit',
        lastSavedSignature: 'saved',
        localSignature: 'local edit',
        protectLocalMismatch: true,
      }),
    ).toBe(false)
  })

  it('hydrates when local state is clean and a new incoming snapshot differs from the saved one', () => {
    expect(
      shouldHydrateDirtySnapshot({
        incomingSignature: 'remote edit',
        lastSavedSignature: 'saved',
        localSignature: 'saved',
        trackUnsavedLocalChanges: true,
      }),
    ).toBe(true)
  })
})
