import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callable: vi.fn(), httpsCallable: vi.fn() }))
vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }))
vi.mock('@/firebase', () => ({ requireFirebaseServices: () => ({ functions: {} }) }))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => false }))
import { updateDailyLogRecord, sendDailyLogEmail } from '@/services/dailyLogs'

const interrupted = Object.assign(new Error('internal [0]'), { code: 'functions/internal' })

describe('daily log submission recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.callable.mockReset().mockResolvedValue({ data: { success: true } })
    mocks.httpsCallable.mockReset().mockReturnValue(mocks.callable)
  })
  afterEach(() => vi.useRealTimers())

  it('recovers on the third attempt using the same submission ID and content', async () => {
    mocks.callable.mockRejectedValueOnce(interrupted).mockRejectedValueOnce(interrupted)
    const save = updateDailyLogRecord('retry-log', { status: 'submitted' })
    await vi.runAllTimersAsync()
    await save
    expect(mocks.callable).toHaveBeenCalledTimes(3)
    const requests = mocks.callable.mock.calls.map(([request]) => request)
    expect(requests[0].submissionRequestId).toEqual(expect.any(String))
    expect(requests[1]).toEqual(requests[0])
    expect(requests[2]).toEqual(requests[0])
  })

  it('keeps the same ID for a manual retry after all automatic attempts failed', async () => {
    mocks.callable.mockRejectedValue(interrupted)
    const failure = expect(
      updateDailyLogRecord('manual-log', { status: 'submitted' }),
    ).rejects.toThrow('server response could not be confirmed')
    await vi.runAllTimersAsync()
    await failure
    const originalId = mocks.callable.mock.calls[0]![0].submissionRequestId
    expect(mocks.callable).toHaveBeenCalledTimes(3)
    mocks.callable.mockResolvedValue({ data: { success: true } })
    await updateDailyLogRecord('manual-log', { status: 'submitted' })
    expect(mocks.callable.mock.lastCall![0].submissionRequestId).toBe(originalId)
  })

  it.each(['functions/permission-denied', 'functions/invalid-argument', 'functions/internal'])(
    'does not retry a server error with code %s',
    async (code) => {
      mocks.callable.mockRejectedValue(Object.assign(new Error('Rejected [500]'), { code }))
      await expect(updateDailyLogRecord(code, { status: 'submitted' })).rejects.toThrow('Rejected')
      expect(mocks.callable).toHaveBeenCalledTimes(1)
    },
  )

  it('waits for an earlier draft save before submitting, even if that save fails', async () => {
    let rejectDraft!: (reason: unknown) => void
    mocks.callable.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectDraft = reject
        }),
    )
    const draft = updateDailyLogRecord('queued-log', { payloadFields: { weeklySchedule: 'Old' } })
    const failure = expect(draft).rejects.toThrow('interrupted')
    const submit = updateDailyLogRecord('queued-log', {
      status: 'submitted',
      payloadFields: { weeklySchedule: 'Latest' },
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.callable).toHaveBeenCalledTimes(1)
    rejectDraft(interrupted)
    await failure
    await submit
    expect(mocks.callable).toHaveBeenCalledTimes(2)
    expect(mocks.callable.mock.lastCall![0].payloadFields.weeklySchedule).toBe('Latest')
  })

  it('allows email requests to wait beyond the server timeout without automatically resending', async () => {
    mocks.callable.mockRejectedValue(interrupted)
    await expect(sendDailyLogEmail('job', 'email-log')).rejects.toThrow('interrupted')
    expect(mocks.httpsCallable).toHaveBeenCalledWith({}, 'sendDailyLogEmail', { timeout: 135000 })
    expect(mocks.callable).toHaveBeenCalledTimes(1)
  })
})
