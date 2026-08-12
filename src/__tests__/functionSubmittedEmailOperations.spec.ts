import { describe, expect, it, vi } from 'vitest'

import {
  claimSubmittedEmailOperation,
  getSubmittedEmailClaimShortCircuitMessage,
  SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE,
  SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE,
  type SubmittedEmailOperationClaimStatus,
} from '../../functions/src/submittedEmailOperations'

interface FakeRef {
  id: string
  record?: Record<string, unknown>
  updates: Array<Record<string, unknown>>
}

function makeRef(id: string, record?: Record<string, unknown>): FakeRef {
  return {
    id,
    record,
    updates: [],
  }
}

function makeTransactionHarness() {
  const transaction = {
    get: vi.fn(async (ref: FakeRef) => ({
      exists: ref.record !== undefined,
      data: () => ref.record,
      ref,
    })),
    update: vi.fn((ref: FakeRef, payload: Record<string, unknown>) => {
      ref.updates.push(payload)
      ref.record = {
        ...(ref.record || {}),
        ...payload,
      }
    }),
  }

  const db = {
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<SubmittedEmailOperationClaimStatus>) => (
      callback(transaction)
    )),
  }

  return {
    db,
    transaction,
  }
}

describe('submitted email operation claims', () => {
  it('centralizes submitted-email claim short-circuit messages', () => {
    expect(getSubmittedEmailClaimShortCircuitMessage('already-sent')).toBe(
      SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE,
    )
    expect(getSubmittedEmailClaimShortCircuitMessage('in-progress')).toBe(
      SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE,
    )
    expect(getSubmittedEmailClaimShortCircuitMessage('claimed')).toBeNull()
    expect(getSubmittedEmailClaimShortCircuitMessage('missing-record')).toBeNull()
  })

  it('claims existing submitted-email records before sending', async () => {
    const operationId = 'shopOrderSubmittedEmail:order-1'
    const rootRef = makeRef('root', { status: 'submitted' })
    const legacyRef = makeRef('legacy', { status: 'submitted' })
    const { db, transaction } = makeTransactionHarness()

    await expect(
      claimSubmittedEmailOperation(db as never, [rootRef as never, legacyRef as never], operationId, {
        operation: 'sendShopOrderEmail',
      }),
    ).resolves.toBe('claimed')

    expect(transaction.get).toHaveBeenCalledTimes(2)
    expect(transaction.update).toHaveBeenCalledTimes(2)
    expect(rootRef.updates[0]).toMatchObject({
      submittedEmailOperationId: operationId,
      submittedEmailSentAt: null,
    })
    expect(rootRef.updates[0]?.submittedEmailAttemptedAt).toBeDefined()
    expect(rootRef.updates[0]?.submittedEmailInProgressAt).toBeDefined()
    expect(rootRef.updates[0]?.submittedEmailError).toBeDefined()
    expect(legacyRef.updates[0]).toMatchObject({
      submittedEmailOperationId: operationId,
      submittedEmailSentAt: null,
    })
  })

  it('does not claim when the same submitted-email operation was already sent', async () => {
    const operationId = 'dailyLogSubmittedEmail:daily-log-1'
    const sentRef = makeRef('sent', {
      submittedEmailOperationId: operationId,
      submittedEmailSentAt: { seconds: 1 },
    })
    const staleRef = makeRef('stale', { status: 'submitted' })
    const { db, transaction } = makeTransactionHarness()

    await expect(
      claimSubmittedEmailOperation(db as never, [sentRef as never, staleRef as never], operationId, {
        operation: 'sendDailyLogEmail',
      }),
    ).resolves.toBe('already-sent')

    expect(transaction.update).not.toHaveBeenCalled()
    expect(sentRef.updates).toHaveLength(0)
    expect(staleRef.updates).toHaveLength(0)
  })

  it('does not claim when the same submitted-email operation is currently in progress', async () => {
    const operationId = 'shopOrderSubmittedEmail:order-1'
    const inProgressRef = makeRef('in-progress', {
      submittedEmailOperationId: operationId,
      submittedEmailInProgressAt: new Date(),
      submittedEmailSentAt: null,
    })
    const { db, transaction } = makeTransactionHarness()

    await expect(
      claimSubmittedEmailOperation(db as never, [inProgressRef as never], operationId, {
        operation: 'sendShopOrderEmail',
      }),
    ).resolves.toBe('in-progress')

    expect(transaction.update).not.toHaveBeenCalled()
    expect(inProgressRef.updates).toHaveLength(0)
  })

  it('allows stale in-progress claims to be reclaimed for retry', async () => {
    const operationId = 'dailyLogSubmittedEmail:daily-log-1'
    const staleRef = makeRef('stale', {
      submittedEmailOperationId: operationId,
      submittedEmailInProgressAt: new Date('2020-01-01T00:00:00.000Z'),
      submittedEmailSentAt: null,
    })
    const { db, transaction } = makeTransactionHarness()

    await expect(
      claimSubmittedEmailOperation(db as never, [staleRef as never], operationId, {
        operation: 'sendDailyLogEmail',
      }),
    ).resolves.toBe('claimed')

    expect(transaction.update).toHaveBeenCalledTimes(1)
    expect(staleRef.updates[0]).toMatchObject({
      submittedEmailOperationId: operationId,
      submittedEmailSentAt: null,
    })
  })

  it('returns missing-record without claiming when no status documents exist', async () => {
    const operationId = 'shopOrderSubmittedEmail:missing-order'
    const rootRef = makeRef('missing-root')
    const legacyRef = makeRef('missing-legacy')
    const { db, transaction } = makeTransactionHarness()

    await expect(
      claimSubmittedEmailOperation(db as never, [rootRef as never, legacyRef as never], operationId, {
        operation: 'sendShopOrderEmail',
      }),
    ).resolves.toBe('missing-record')

    expect(transaction.get).toHaveBeenCalledTimes(2)
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it('claims only the submitted-email status documents that exist', async () => {
    const operationId = 'dailyLogSubmittedEmail:daily-log-1'
    const rootRef = makeRef('root', { status: 'submitted' })
    const missingLegacyRef = makeRef('missing-legacy')
    const { db, transaction } = makeTransactionHarness()

    await expect(
      claimSubmittedEmailOperation(db as never, [rootRef as never, missingLegacyRef as never], operationId, {
        operation: 'sendDailyLogEmail',
      }),
    ).resolves.toBe('claimed')

    expect(transaction.update).toHaveBeenCalledTimes(1)
    expect(rootRef.updates).toHaveLength(1)
    expect(missingLegacyRef.updates).toHaveLength(0)
  })
})
