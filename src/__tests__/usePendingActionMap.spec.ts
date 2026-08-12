import { describe, expect, it } from 'vitest'

import { usePendingActionMap } from '@/composables/usePendingActionMap'

function createDeferred<TResult>() {
  let resolve!: (value: TResult) => void
  const promise = new Promise<TResult>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

describe('usePendingActionMap', () => {
  it('tracks pending state for only the action key being run', async () => {
    const pendingActions = usePendingActionMap()
    const deferred = createDeferred<string>()

    const resultPromise = pendingActions.runWithPendingAction('item-1', () => deferred.promise)

    expect(pendingActions.isActionPending('item-1')).toBe(true)
    expect(pendingActions.isActionPending('item-2')).toBe(false)
    expect(pendingActions.pendingCount.value).toBe(1)
    expect(pendingActions.hasPendingActions.value).toBe(true)

    deferred.resolve('saved')

    await expect(resultPromise).resolves.toBe('saved')
    expect(pendingActions.isActionPending('item-1')).toBe(false)
    expect(pendingActions.pendingCount.value).toBe(0)
    expect(pendingActions.hasPendingActions.value).toBe(false)
  })

  it('clears pending state when an action rejects', async () => {
    const pendingActions = usePendingActionMap()

    await expect(
      pendingActions.runWithPendingAction('item-1', async () => {
        throw new Error('Nope')
      }),
    ).rejects.toThrow('Nope')

    expect(pendingActions.isActionPending('item-1')).toBe(false)
  })

  it('can clear all pending keys', () => {
    const pendingActions = usePendingActionMap()

    pendingActions.pendingKeys['one'] = true
    pendingActions.pendingKeys['two'] = true
    pendingActions.clearPendingActions()

    expect(pendingActions.pendingCount.value).toBe(0)
  })
})
