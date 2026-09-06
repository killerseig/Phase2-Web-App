import { describe, expect, it, vi } from 'vitest'

import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { useSubscribedValue } from '@/composables/useSubscribedValue'

interface TestRecord {
  id: string
  label: string
}

describe('useSubscribedRecords', () => {
  it('starts with loading state, accepts record updates, and calls update hooks', () => {
    const unsubscribe = vi.fn()
    const onUpdate = vi.fn()
    let emitRecords: (records: TestRecord[]) => void = () => {}
    const subscriber = vi.fn((next: (records: TestRecord[]) => void) => {
      emitRecords = next
      return unsubscribe
    })
    const subscription = useSubscribedRecords<TestRecord>(subscriber, {
      errorMessage: 'Failed to load records.',
      onUpdate,
    })

    expect(subscription.loading.value).toBe(true)
    expect(subscription.records.value).toEqual([])

    subscription.start()
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscription.loading.value).toBe(true)

    emitRecords([{ id: 'record-1', label: 'Record 1' }])

    expect(subscription.records.value).toEqual([{ id: 'record-1', label: 'Record 1' }])
    expect(subscription.loading.value).toBe(false)
    expect(subscription.error.value).toBe('')
    expect(onUpdate).toHaveBeenCalledWith([{ id: 'record-1', label: 'Record 1' }])
  })

  it('stops existing subscriptions before restarting or stopping explicitly', () => {
    const firstUnsubscribe = vi.fn()
    const secondUnsubscribe = vi.fn()
    const subscriber = vi
      .fn()
      .mockReturnValueOnce(firstUnsubscribe)
      .mockReturnValueOnce(secondUnsubscribe)
    const subscription = useSubscribedRecords<TestRecord>(subscriber, {
      errorMessage: 'Failed to load records.',
      initialLoading: false,
    })

    expect(subscription.loading.value).toBe(false)

    subscription.start()
    subscription.start()

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
    expect(secondUnsubscribe).not.toHaveBeenCalled()

    subscription.stop()

    expect(secondUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('normalizes callback and synchronous subscriber failures', () => {
    const onError = vi.fn()
    let emitError: (error: unknown) => void = () => {}
    const callbackFailureSubscriber = vi.fn(
      (_next: (records: TestRecord[]) => void, error?: (caughtError: unknown) => void) => {
        emitError = error ?? (() => {})
        return vi.fn()
      },
    )
    const callbackFailure = useSubscribedRecords<TestRecord>(callbackFailureSubscriber, {
      errorMessage: 'Failed to load records.',
      onError,
    })

    callbackFailure.start()
    emitError({ code: 'firestore/permission-denied' })

    expect(callbackFailure.loading.value).toBe(false)
    expect(callbackFailure.error.value).toBe(
      'Permission denied. Your account may not have access yet, or Firestore rules may still need to be deployed.',
    )
    expect(onError).toHaveBeenCalledWith({ code: 'firestore/permission-denied' })

    const syncFailure = useSubscribedRecords<TestRecord>(
      () => {
        throw new Error('Listener failed')
      },
      {
        errorMessage: 'Failed to load records.',
        onError,
      },
    )

    syncFailure.start()

    expect(syncFailure.loading.value).toBe(false)
    expect(syncFailure.error.value).toBe('Listener failed')
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('clears previous errors when a subscription restarts', () => {
    let emitError: (error: unknown) => void = () => {}
    const subscriber = vi.fn(
      (_next: (records: TestRecord[]) => void, error?: (caughtError: unknown) => void) => {
        emitError = error ?? (() => {})
        return vi.fn()
      },
    )
    const subscription = useSubscribedRecords<TestRecord>(subscriber, {
      errorMessage: 'Failed to load records.',
    })

    subscription.start()
    emitError('No connection')
    expect(subscription.error.value).toBe('No connection')

    subscription.start()

    expect(subscription.error.value).toBe('')
    expect(subscription.loading.value).toBe(true)
  })
})

describe('useSubscribedValue', () => {
  it('starts with an initial value, accepts updates, and calls update hooks', () => {
    const unsubscribe = vi.fn()
    const onUpdate = vi.fn()
    let emitValue: (value: string) => void = () => {}
    const subscriber = vi.fn((next: (value: string) => void) => {
      emitValue = next
      return unsubscribe
    })
    const subscription = useSubscribedValue(subscriber, 'initial', {
      errorMessage: 'Failed to load value.',
      onUpdate,
    })

    expect(subscription.value.value).toBe('initial')
    expect(subscription.loading.value).toBe(true)

    subscription.start()
    emitValue('updated')

    expect(subscription.value.value).toBe('updated')
    expect(subscription.loading.value).toBe(false)
    expect(subscription.error.value).toBe('')
    expect(onUpdate).toHaveBeenCalledWith('updated')
  })

  it('stops existing value subscriptions before restarting or stopping explicitly', () => {
    const firstUnsubscribe = vi.fn()
    const secondUnsubscribe = vi.fn()
    const subscriber = vi
      .fn()
      .mockReturnValueOnce(firstUnsubscribe)
      .mockReturnValueOnce(secondUnsubscribe)
    const subscription = useSubscribedValue(
      subscriber,
      { count: 0 },
      {
        errorMessage: 'Failed to load value.',
        initialLoading: false,
      },
    )

    expect(subscription.loading.value).toBe(false)

    subscription.start()
    subscription.start()

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
    expect(secondUnsubscribe).not.toHaveBeenCalled()

    subscription.stop()

    expect(secondUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('normalizes value callback and synchronous subscriber failures', () => {
    const onError = vi.fn()
    let emitError: (error: unknown) => void = () => {}
    const callbackFailureSubscriber = vi.fn(
      (_next: (value: string) => void, error?: (caughtError: unknown) => void) => {
        emitError = error ?? (() => {})
        return vi.fn()
      },
    )
    const callbackFailure = useSubscribedValue(callbackFailureSubscriber, 'initial', {
      errorMessage: 'Failed to load value.',
      onError,
    })

    callbackFailure.start()
    emitError({ code: 'storage/unauthorized' })

    expect(callbackFailure.loading.value).toBe(false)
    expect(callbackFailure.error.value).toBe(
      'You do not have permission to add or view this photo.',
    )
    expect(callbackFailure.value.value).toBe('initial')
    expect(onError).toHaveBeenCalledWith({ code: 'storage/unauthorized' })

    const syncFailure = useSubscribedValue(
      () => {
        throw new Error('Value listener failed')
      },
      'initial',
      {
        errorMessage: 'Failed to load value.',
        onError,
      },
    )

    syncFailure.start()

    expect(syncFailure.loading.value).toBe(false)
    expect(syncFailure.error.value).toBe('Value listener failed')
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('clears value subscription errors when restarted', () => {
    let emitError: (error: unknown) => void = () => {}
    const subscriber = vi.fn(
      (_next: (value: string) => void, error?: (caughtError: unknown) => void) => {
        emitError = error ?? (() => {})
        return vi.fn()
      },
    )
    const subscription = useSubscribedValue(subscriber, 'initial', {
      errorMessage: 'Failed to load value.',
    })

    subscription.start()
    emitError('No value connection')
    expect(subscription.error.value).toBe('No value connection')

    subscription.start()

    expect(subscription.error.value).toBe('')
    expect(subscription.loading.value).toBe(true)
    expect(subscription.value.value).toBe('initial')
  })
})
