import { describe, expect, it } from 'vitest'

import {
  formatDailyLogTimestamp,
  getDailyLogLabel,
  getDailyLogStatusLabel,
  getDailyLogTimestampLabel,
} from '@/features/dailyLogs/format'
import type { DailyLogRecord } from '@/types/domain'

function makeDailyLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    additionalRecipients: [],
    foremanName: 'Chris Larsen',
    foremanUserId: 'user-1',
    id: 'log-1',
    jobCode: '1A',
    jobId: 'job-1',
    jobName: 'Phase 2 Company Acoustical remodel',
    logDate: '2026-06-04',
    payload: {} as DailyLogRecord['payload'],
    sequenceNumber: 1,
    status: 'draft',
    ...overrides,
  }
}

describe('daily log format helpers', () => {
  it('formats daily log status and sequence labels', () => {
    expect(getDailyLogLabel(null)).toBe('No log selected')
    expect(getDailyLogStatusLabel(makeDailyLog({ status: 'draft' }))).toBe('Draft')
    expect(getDailyLogStatusLabel(makeDailyLog({ status: 'submitted' }))).toBe('Submitted')
    expect(getDailyLogLabel(makeDailyLog({ sequenceNumber: 12, status: 'submitted' }))).toBe('Submitted #12')
  })

  it('formats Firestore-like timestamps and invalid timestamp fallbacks', () => {
    const timestamp = {
      toDate: () => new Date(2026, 5, 4, 9, 8),
    }

    expect(formatDailyLogTimestamp(undefined)).toBe('Unknown time')
    expect(formatDailyLogTimestamp('not a date')).toBe('Unknown time')
    expect(formatDailyLogTimestamp(timestamp)).toContain('2026')
    expect(formatDailyLogTimestamp(timestamp)).toContain('9:08')
  })

  it('uses submitted, updated, then created timestamps for history labels', () => {
    const submittedLabel = getDailyLogTimestampLabel(
      makeDailyLog({
        createdAt: new Date(2025, 5, 4, 9, 8),
        submittedAt: new Date(2026, 5, 4, 9, 8),
        updatedAt: new Date(2024, 5, 4, 9, 8),
      }),
    )

    const updatedLabel = getDailyLogTimestampLabel(
      makeDailyLog({
        createdAt: new Date(2025, 5, 4, 9, 8),
        updatedAt: new Date(2026, 5, 4, 9, 8),
      }),
    )

    expect(submittedLabel).toContain('2026')
    expect(updatedLabel).toContain('2026')
  })
})
