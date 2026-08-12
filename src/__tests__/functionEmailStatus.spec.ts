import { describe, expect, it } from 'vitest'

import {
  buildSubmittedEmailClaimUpdate,
  buildSubmittedEmailOperationId,
  buildSubmittedEmailStatusUpdate,
  isSubmittedEmailOperationAlreadySent,
  isSubmittedEmailOperationInProgress,
} from '../../functions/src/emailStatus'

const sentinels = {
  serverTimestamp: () => ({ sentinel: 'serverTimestamp' }),
  delete: () => ({ sentinel: 'delete' }),
}

describe('Cloud Functions email status helpers', () => {
  it('builds stable submitted-email operation ids', () => {
    expect(buildSubmittedEmailOperationId('dailyLogSubmittedEmail', ' daily-log-1 ')).toBe(
      'dailyLogSubmittedEmail:daily-log-1',
    )
    expect(buildSubmittedEmailOperationId('shopOrderSubmittedEmail', 'shop order 7')).toBe(
      'shopOrderSubmittedEmail:shop-order-7',
    )
    expect(buildSubmittedEmailOperationId('timecardWeekSubmittedEmail', 'week-1')).toBe(
      'timecardWeekSubmittedEmail:week-1',
    )
  })

  it('builds sent-email status metadata', () => {
    expect(buildSubmittedEmailStatusUpdate({
      emailSent: true,
      emailMessage: 'Email sent successfully',
      operationId: 'dailyLogSubmittedEmail:daily-log-1',
    }, sentinels)).toEqual({
      submittedEmailOperationId: 'dailyLogSubmittedEmail:daily-log-1',
      submittedEmailAttemptedAt: { sentinel: 'serverTimestamp' },
      submittedEmailInProgressAt: { sentinel: 'delete' },
      submittedEmailSentAt: { sentinel: 'serverTimestamp' },
      submittedEmailError: { sentinel: 'delete' },
    })
  })

  it('builds skipped or failed email status metadata', () => {
    expect(buildSubmittedEmailStatusUpdate({
      emailSent: false,
      emailMessage: 'No recipients configured.',
      operationId: 'shopOrderSubmittedEmail:order-1',
    }, sentinels)).toEqual({
      submittedEmailOperationId: 'shopOrderSubmittedEmail:order-1',
      submittedEmailAttemptedAt: { sentinel: 'serverTimestamp' },
      submittedEmailInProgressAt: { sentinel: 'delete' },
      submittedEmailSentAt: null,
      submittedEmailError: 'No recipients configured.',
    })
  })

  it('does not stamp an operation id when one is not provided', () => {
    expect(buildSubmittedEmailStatusUpdate({
      emailSent: false,
      emailMessage: 'Email sending disabled. Skipped.',
    }, sentinels)).toEqual({
      submittedEmailAttemptedAt: { sentinel: 'serverTimestamp' },
      submittedEmailInProgressAt: { sentinel: 'delete' },
      submittedEmailSentAt: null,
      submittedEmailError: 'Email sending disabled. Skipped.',
    })
  })

  it('builds claim metadata before sending submitted emails', () => {
    expect(buildSubmittedEmailClaimUpdate('shopOrderSubmittedEmail:order-1', sentinels)).toEqual({
      submittedEmailOperationId: 'shopOrderSubmittedEmail:order-1',
      submittedEmailAttemptedAt: { sentinel: 'serverTimestamp' },
      submittedEmailInProgressAt: { sentinel: 'serverTimestamp' },
      submittedEmailSentAt: null,
      submittedEmailError: { sentinel: 'delete' },
    })
  })

  it('detects already-sent submitted-email operations', () => {
    expect(isSubmittedEmailOperationAlreadySent({
      submittedEmailOperationId: 'dailyLogSubmittedEmail:daily-log-1',
      submittedEmailSentAt: { seconds: 1 },
    }, 'dailyLogSubmittedEmail:daily-log-1')).toBe(true)

    expect(isSubmittedEmailOperationAlreadySent({
      submittedEmailOperationId: 'dailyLogSubmittedEmail:daily-log-1',
      submittedEmailSentAt: null,
    }, 'dailyLogSubmittedEmail:daily-log-1')).toBe(false)

    expect(isSubmittedEmailOperationAlreadySent({
      submittedEmailOperationId: 'dailyLogSubmittedEmail:daily-log-2',
      submittedEmailSentAt: { seconds: 1 },
    }, 'dailyLogSubmittedEmail:daily-log-1')).toBe(false)
  })

  it('detects in-progress submitted-email operations without blocking failed or sent records', () => {
    const now = new Date('2026-06-04T10:10:00.000Z')

    expect(isSubmittedEmailOperationInProgress({
      submittedEmailOperationId: 'shopOrderSubmittedEmail:order-1',
      submittedEmailInProgressAt: new Date('2026-06-04T10:05:00.000Z'),
      submittedEmailSentAt: null,
      submittedEmailError: undefined,
    }, 'shopOrderSubmittedEmail:order-1', now)).toBe(true)

    expect(isSubmittedEmailOperationInProgress({
      submittedEmailOperationId: 'shopOrderSubmittedEmail:order-1',
      submittedEmailInProgressAt: new Date('2026-06-04T10:05:00.000Z'),
      submittedEmailSentAt: { seconds: 2 },
    }, 'shopOrderSubmittedEmail:order-1', now)).toBe(false)

    expect(isSubmittedEmailOperationInProgress({
      submittedEmailOperationId: 'shopOrderSubmittedEmail:order-1',
      submittedEmailInProgressAt: new Date('2026-06-04T10:05:00.000Z'),
      submittedEmailSentAt: null,
      submittedEmailError: 'Failed to send',
    }, 'shopOrderSubmittedEmail:order-1', now)).toBe(false)
  })

  it('allows stale in-progress submitted-email operations to retry', () => {
    expect(isSubmittedEmailOperationInProgress({
      submittedEmailOperationId: 'dailyLogSubmittedEmail:daily-log-1',
      submittedEmailInProgressAt: new Date('2026-06-04T10:00:00.000Z'),
      submittedEmailSentAt: null,
      submittedEmailError: undefined,
    }, 'dailyLogSubmittedEmail:daily-log-1', new Date('2026-06-04T10:15:00.000Z'))).toBe(false)
  })
})
