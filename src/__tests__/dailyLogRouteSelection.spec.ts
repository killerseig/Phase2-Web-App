import { describe, expect, it } from 'vitest'

import { getDailyLogRouteSelection } from '@/features/dailyLogs/routeSelection'

describe('daily log route selection', () => {
  it('reads the exact date and log id from an email deep link', () => {
    expect(getDailyLogRouteSelection({
      date: '2026-08-20',
      logId: 'daily-log-123',
    })).toEqual({
      date: '2026-08-20',
      logId: 'daily-log-123',
    })
  })

  it('accepts repeated query values and ignores invalid dates', () => {
    expect(getDailyLogRouteSelection({
      date: ['not-a-date', '2026-08-20'],
      logId: [' daily-log-123 ', 'ignored'],
    })).toEqual({
      date: null,
      logId: 'daily-log-123',
    })
  })
})
