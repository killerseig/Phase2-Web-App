import { describe, expect, it, vi } from 'vitest'

import { claimJobNotificationEventInTransaction } from '../../functions/src/jobNotificationEmail'

function makeTransaction(existing: Record<string, unknown> | null) {
  return {
    get: vi.fn(async () => ({
      exists: existing !== null,
      data: () => existing ?? undefined,
    })),
    set: vi.fn(),
  }
}

const metadata = {
  jobId: 'job-1',
  notificationKey: 'newJobs' as const,
}

describe('job notification event claims', () => {
  it('claims missing events transactionally with lease and retention metadata', async () => {
    const transaction = makeTransaction(null)
    const now = new Date('2026-09-08T16:00:00.000Z')

    await expect(
      claimJobNotificationEventInTransaction(
        transaction as never,
        { id: 'event-ref' } as never,
        'newJobs:event-1',
        metadata,
        now,
      ),
    ).resolves.toBe(true)

    expect(transaction.set).toHaveBeenCalledWith(
      { id: 'event-ref' },
      expect.objectContaining({
        attemptCount: 1,
        eventKey: 'newJobs:event-1',
        jobId: 'job-1',
        notificationKey: 'newJobs',
        status: 'processing',
        leaseExpiresAt: expect.objectContaining({}),
        expiresAt: expect.objectContaining({}),
      }),
      { merge: true },
    )
  })

  it('returns false for sent events without writing', async () => {
    const transaction = makeTransaction({ status: 'sent', attemptCount: 1 })

    await expect(
      claimJobNotificationEventInTransaction(
        transaction as never,
        {} as never,
        'newJobs:event-sent',
        metadata,
      ),
    ).resolves.toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('returns false for permanently failed events without writing', async () => {
    const transaction = makeTransaction({ status: 'failed-permanent', attemptCount: 1 })

    await expect(
      claimJobNotificationEventInTransaction(
        transaction as never,
        {} as never,
        'newJobs:event-permanent-failure',
        metadata,
      ),
    ).resolves.toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('rejects recent processing claims so the background event remains retryable', async () => {
    const now = new Date('2026-09-08T16:00:00.000Z')
    const transaction = makeTransaction({
      status: 'processing',
      leaseExpiresAt: new Date(now.getTime() + 60_000),
    })

    await expect(
      claimJobNotificationEventInTransaction(
        transaction as never,
        {} as never,
        'newJobs:event-processing',
        metadata,
        now,
      ),
    ).rejects.toThrow('already processing')
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('reclaims stale processing events and increments the attempt count', async () => {
    const now = new Date('2026-09-08T16:00:00.000Z')
    const transaction = makeTransaction({
      status: 'processing',
      attemptCount: 2,
      leaseExpiresAt: new Date(now.getTime() - 1),
    })

    await expect(
      claimJobNotificationEventInTransaction(
        transaction as never,
        {} as never,
        'newJobs:event-stale',
        metadata,
        now,
      ),
    ).resolves.toBe(true)
    expect(transaction.set).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ attemptCount: 3, status: 'processing' }),
      { merge: true },
    )
  })
})
