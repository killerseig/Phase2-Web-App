import { describe, expect, it } from 'vitest'

import { formatAppTimestamp, toAppDate, toAppMillis } from '@/utils/dateTime'

describe('date time helpers', () => {
  it('normalizes common app and Firestore timestamp values', () => {
    const date = new Date(2026, 5, 4, 9, 8)

    expect(toAppDate(date)).toBe(date)
    expect(toAppDate(date.toISOString())?.getFullYear()).toBe(2026)
    expect(toAppDate({ toDate: () => date })).toBe(date)
    expect(toAppDate({ toMillis: () => date.getTime() })?.getTime()).toBe(date.getTime())
    expect(toAppMillis({ toMillis: () => date.getTime() })).toBe(date.getTime())
  })

  it('falls back for invalid timestamp values', () => {
    expect(toAppDate(null)).toBeNull()
    expect(toAppDate('not a date')).toBeNull()
    expect(toAppMillis('not a date')).toBe(0)
    expect(formatAppTimestamp('not a date', 'Unknown date')).toBe('Unknown date')
  })

  it('formats timestamps with the app display format', () => {
    const formatted = formatAppTimestamp(new Date(2026, 5, 4, 9, 8), 'Unknown date')

    expect(formatted).toContain('2026')
    expect(formatted).toContain('9:08')
  })
})
