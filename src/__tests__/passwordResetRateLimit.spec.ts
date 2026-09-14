import { describe, expect, it, vi } from 'vitest'

vi.mock('../../functions/src/runtime', () => ({ db: {} }))
import { nextResetAllowance } from '../../functions/src/passwordResetRateLimit'

describe('password reset rate limit', () => {
  const now = 10_000_000
  it('allows the first request, blocks the limit, and resets an expired window', () => {
    expect(nextResetAllowance({}, 3, now)).toEqual({ windowStart: now, count: 1 })
    expect(nextResetAllowance({ windowStart: now - 1000, count: 2 }, 3, now)).toEqual({ windowStart: now - 1000, count: 3 })
    expect(nextResetAllowance({ windowStart: now - 1000, count: 3 }, 3, now)).toBeNull()
    expect(nextResetAllowance({ windowStart: now - 3600000, count: 3 }, 3, now)).toEqual({ windowStart: now, count: 1 })
  })
  it('does not allow a malformed counter to bypass an active limit', () => {
    expect(nextResetAllowance({ windowStart: now, count: 'invalid' }, 3, now)).toBeNull()
  })
})
