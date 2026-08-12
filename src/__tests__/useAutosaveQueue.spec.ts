import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutosaveQueue } from '@/composables/useAutosaveQueue'

describe('useAutosaveQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces saves and records the last saved time', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = useAutosaveQueue({
      debounceMs: 100,
      save,
    })

    queue.queueAutosave()

    expect(queue.isScheduled.value).toBe(true)
    expect(queue.hasQueuedWork.value).toBe(true)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)

    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.isScheduled.value).toBe(false)
    expect(queue.isSaving.value).toBe(false)
    expect(queue.lastSavedAt.value).toBe(new Date('2026-06-04T12:00:00.100Z').getTime())
  })

  it('reschedules pending saves when another change arrives before the debounce expires', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = useAutosaveQueue({
      debounceMs: 100,
      save,
    })

    queue.queueAutosave()
    await vi.advanceTimersByTimeAsync(75)
    queue.queueAutosave()
    await vi.advanceTimersByTimeAsync(99)

    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not schedule saves while canSave is false', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = useAutosaveQueue({
      canSave: () => false,
      debounceMs: 100,
      save,
    })

    queue.queueAutosave()
    await vi.advanceTimersByTimeAsync(100)

    expect(queue.isScheduled.value).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('clears pending saves before they run', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = useAutosaveQueue({
      debounceMs: 100,
      save,
    })

    queue.queueAutosave()
    queue.clearQueuedSave()
    await vi.advanceTimersByTimeAsync(100)

    expect(queue.isScheduled.value).toBe(false)
    expect(queue.hasQueuedWork.value).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('captures save errors for background autosaves', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Network unavailable'))
    const queue = useAutosaveQueue({
      debounceMs: 100,
      save,
      saveErrorFallback: 'Could not save.',
    })

    queue.queueAutosave()
    await vi.advanceTimersByTimeAsync(100)

    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.saveError.value).toBe('Network unavailable')
    expect(queue.isSaving.value).toBe(false)
  })
})
