import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTimecardSaveQueue } from './useTimecardSaveQueue'
import { effectScope, ref } from 'vue'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture() {
  const cards = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }]
  const save = vi.fn<(card: typeof cards[number]) => Promise<void>>().mockResolvedValue()
  const queue = useTimecardSaveQueue({ getCards: () => cards, canSave: () => true, saveCard: save })
  return { cards, save, queue }
}
afterEach(() => vi.useRealTimers())

describe('timecard pending-save contract', () => {
  it('rejects flush when an already active save fails, retaining work for retry', async () => {
    const { cards, save, queue } = fixture(), pending = deferred()
    save.mockReturnValueOnce(pending.promise)
    const active = queue.persistCard(cards[0]!).catch(() => undefined)
    const flushed = queue.flushPendingSaves().catch((error: unknown) => error)
    pending.reject(new Error('Save failed'))
    await active
    expect(await flushed).toEqual(new Error('Save failed'))
    expect(queue.hasQueuedWork()).toBe(true)
    await queue.flushPendingSaves()
    expect(save).toHaveBeenCalledTimes(2)
    expect(queue.hasQueuedWork()).toBe(false)
  })

  it('retains a failed card when another card saves successfully', async () => {
    const { cards, save, queue } = fixture()
    save.mockRejectedValueOnce(new Error('First card failed'))
    await expect(queue.persistCard(cards[0]!)).rejects.toThrow('First card failed')
    await queue.persistCard(cards[1]!)
    expect(queue.scheduledSaveIds.a).toBe(true)
    await queue.flushPendingSaves()
    expect(save.mock.calls.map(([card]) => card.id)).toEqual(['a', 'b', 'a'])
  })

  it('waits for edits queued during an active save before resolving flush', async () => {
    const { cards, save, queue } = fixture(), first = deferred(), second = deferred()
    save.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const active = queue.persistCard(cards[0]!)
    let finished = false
    const flushed = queue.flushPendingSaves().then(() => { finished = true })
    cards[0]!.value = 3
    queue.scheduleCardSave(cards[0]!)
    first.resolve()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(finished).toBe(false)
    second.resolve()
    await Promise.all([active, flushed])
    expect(queue.hasQueuedWork()).toBe(false)
  })

  it('does not let an obsolete save clear the new context or report old errors', async () => {
    const { cards, save, queue } = fixture(), old = deferred(), current = deferred()
    save.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const previous = queue.persistCard(cards[0]!).catch(() => undefined)
    queue.resetSaveQueueState({ clearQueued: true })
    const latest = queue.persistCard(cards[0]!)
    old.reject(new Error('Obsolete failure'))
    await previous
    expect(queue.savingIds.a).toBe(true)
    expect(queue.saveError.value).toBe('')
    current.resolve()
    await latest
  })

  it('does not send the next old card after a reset during a multi-card flush', async () => {
    const { cards, save, queue } = fixture(), pending = deferred()
    save.mockReturnValueOnce(pending.promise)
    queue.scheduleCardSave(cards[0]!)
    queue.scheduleCardSave(cards[1]!)
    const flushed = queue.flushPendingSaves().catch((error: unknown) => error)
    queue.resetSaveQueueState({ clearQueued: true })
    cards.splice(0, cards.length, { id: 'new-card', value: 9 })
    pending.resolve()
    expect(await flushed).toEqual(new Error('The timecard context changed before saving finished.'))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('invalidates pending writes synchronously across same-account leave and return', async () => {
    const context = ref('a'), scope = effectScope(), pending = deferred()
    const cards = [{ id: 'a' }, { id: 'b' }]
    const save = vi.fn<(card: { id: string }) => Promise<void>>().mockReturnValueOnce(pending.promise)
    const queue = scope.run(() => useTimecardSaveQueue({ context: () => context.value, canSave: () => true, getCards: () => cards, saveCard: save }))!
    queue.scheduleCardSave(cards[0]!)
    queue.scheduleCardSave(cards[1]!)
    const flushed = queue.flushPendingSaves().catch((error: unknown) => error)
    context.value = ''; context.value = 'a'
    pending.resolve()
    expect(await flushed).toEqual(new Error('The timecard context changed before saving finished.'))
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.hasQueuedWork()).toBe(false)
    scope.stop()
  })
})
