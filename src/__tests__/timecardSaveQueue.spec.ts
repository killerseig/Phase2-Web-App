import { describe, expect, it, vi } from 'vitest'
import { useTimecardSaveQueue, type TimecardSaveQueueItem } from '@/features/timecards/useTimecardSaveQueue'

interface TestCard extends TimecardSaveQueueItem {
  label: string
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks(times = 3) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve()
  }
}

describe('useTimecardSaveQueue', () => {
  it('debounces scheduled card saves and records a recent save', async () => {
    vi.useFakeTimers()
    try {
      const cards: TestCard[] = [{ id: 'card-a', label: 'A' }]
      const saveCard = vi.fn(async () => {})
      const queue = useTimecardSaveQueue<TestCard>({
        canSave: () => true,
        getCards: () => cards,
        saveCard,
      })

      queue.scheduleCardSave(cards[0]!)

      expect(queue.pendingSaveCount.value).toBe(1)
      expect(saveCard).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(899)
      expect(saveCard).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      await flushMicrotasks()

      expect(saveCard).toHaveBeenCalledTimes(1)
      expect(queue.pendingSaveCount.value).toBe(0)
      expect(queue.lastSavedAt.value).toEqual(expect.any(Number))
    } finally {
      vi.useRealTimers()
    }
  })

  it('queues a second save when a card changes while a save is in flight', async () => {
    const cards: TestCard[] = [{ id: 'card-a', label: 'A' }]
    const firstSave = createDeferred()
    const secondSave = createDeferred()
    const saveCard = vi.fn(async () => {
      const deferred = saveCard.mock.calls.length === 1 ? firstSave : secondSave
      await deferred.promise
    })
    const queue = useTimecardSaveQueue<TestCard>({
      canSave: () => true,
      getCards: () => cards,
      saveCard,
    })

    const firstSavePromise = queue.persistCard(cards[0]!)
    await flushMicrotasks()

    const secondSavePromise = queue.persistCard(cards[0]!)
    await flushMicrotasks()

    expect(queue.savingIds['card-a']).toBe(true)
    expect(queue.queuedSaveIds['card-a']).toBe(true)
    expect(saveCard).toHaveBeenCalledTimes(1)

    firstSave.resolve()
    await flushMicrotasks()

    expect(saveCard).toHaveBeenCalledTimes(2)
    expect(queue.queuedSaveIds['card-a']).toBeUndefined()

    secondSave.resolve()
    await Promise.all([firstSavePromise, secondSavePromise])

    expect(queue.savingIds['card-a']).toBeUndefined()
    expect(queue.lastSavedAt.value).toEqual(expect.any(Number))
  })

  it('prunes timers and state for cards that are no longer visible', () => {
    vi.useFakeTimers()
    try {
      const cards: TestCard[] = [
        { id: 'card-a', label: 'A' },
        { id: 'card-b', label: 'B' },
      ]
      const queue = useTimecardSaveQueue<TestCard>({
        canSave: () => true,
        getCards: () => cards,
        saveCard: async () => {},
      })

      queue.scheduleCardSave(cards[0]!)
      queue.scheduleCardSave(cards[1]!)

      expect(queue.pendingSaveCount.value).toBe(2)

      queue.pruneSaveQueueToIds(new Set(['card-b']))

      expect(queue.scheduledSaveIds['card-a']).toBeUndefined()
      expect(queue.scheduledSaveIds['card-b']).toBe(true)
      expect(queue.pendingSaveCount.value).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
