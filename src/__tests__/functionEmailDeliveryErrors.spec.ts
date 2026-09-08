import { describe, expect, it } from 'vitest'

import {
  classifyEmailDeliveryError,
  EmailDeliveryError,
  isRetryableEmailDeliveryStatus,
} from '../../functions/src/emailDeliveryErrors'

describe('email delivery error classification', () => {
  it('retries no-response failures, explicit transient statuses, and server failures', () => {
    expect(isRetryableEmailDeliveryStatus()).toBe(true)
    expect(isRetryableEmailDeliveryStatus(408)).toBe(true)
    expect(isRetryableEmailDeliveryStatus(409)).toBe(true)
    expect(isRetryableEmailDeliveryStatus(425)).toBe(true)
    expect(isRetryableEmailDeliveryStatus(429)).toBe(true)
    expect(isRetryableEmailDeliveryStatus(500)).toBe(true)
    expect(isRetryableEmailDeliveryStatus(599)).toBe(true)
  })

  it('treats other client responses as permanent', () => {
    expect(isRetryableEmailDeliveryStatus(400)).toBe(false)
    expect(isRetryableEmailDeliveryStatus(401)).toBe(false)
    expect(isRetryableEmailDeliveryStatus(403)).toBe(false)
    expect(isRetryableEmailDeliveryStatus(404)).toBe(false)
    expect(isRetryableEmailDeliveryStatus(422)).toBe(false)
  })

  it('classifies typed and Axios-shaped delivery failures', () => {
    expect(
      classifyEmailDeliveryError(new EmailDeliveryError('Rate limited', { httpStatus: 429 })),
    ).toEqual({ httpStatus: 429, retryable: true })
    expect(classifyEmailDeliveryError({ response: { status: 403 } })).toEqual({
      httpStatus: 403,
      retryable: false,
    })
    expect(classifyEmailDeliveryError(new Error('Connection reset'))).toEqual({
      retryable: true,
    })
  })

  it('allows an explicit retryability decision to accompany a delivery error', () => {
    expect(
      classifyEmailDeliveryError(
        new EmailDeliveryError('Provider-specific conflict', {
          httpStatus: 409,
          retryable: false,
        }),
      ),
    ).toEqual({ httpStatus: 409, retryable: false })
  })
})
