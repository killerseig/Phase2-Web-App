import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getDailyLogTodayDateString,
  useDailyLogFormState,
} from '@/features/dailyLogs/useDailyLogFormState'
import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { getE2ENowValue } from '@/testing/e2eRuntime'

vi.mock('@/testing/e2eRuntime', () => ({
  getE2ENowValue: vi.fn(),
}))

const getE2ENowValueMock = vi.mocked(getE2ENowValue)

describe('useDailyLogFormState', () => {
  afterEach(() => {
    vi.useRealTimers()
    getE2ENowValueMock.mockReset()
  })

  it('formats today from the E2E runtime clock when one is provided', () => {
    getE2ENowValueMock.mockReturnValue(new Date(2026, 5, 4, 9, 30, 0))

    expect(getDailyLogTodayDateString()).toBe('2026-06-04')
  })

  it('formats today from the real Date fallback when no E2E clock is provided', () => {
    getE2ENowValueMock.mockReturnValue(null)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 9, 7, 15, 0))

    expect(getDailyLogTodayDateString()).toBe('2026-01-09')
  })

  it('initializes selected date, selected log, and form payload defaults', () => {
    getE2ENowValueMock.mockReturnValue(new Date(2026, 6, 15, 12, 0, 0))

    const state = useDailyLogFormState()

    expect(state.selectedDate.value).toBe('2026-07-15')
    expect(state.selectedLogId.value).toBeNull()
    expect(state.form.value).toEqual(createEmptyDailyLogPayload())
  })

  it('updates only the requested daily-log text field', () => {
    const state = useDailyLogFormState()

    state.updateDailyLogTextField('weeklySchedule', 'Frame Level 2.')
    state.updateDailyLogTextField('safetyConcerns', 'Reviewed lift access.')

    expect(state.form.value.weeklySchedule).toBe('Frame Level 2.')
    expect(state.form.value.safetyConcerns).toBe('Reviewed lift access.')
    expect(state.form.value.budgetConcerns).toBe('')
    expect(state.form.value.manpowerLines).toHaveLength(1)
    expect(state.form.value.indoorClimateReadings).toHaveLength(1)
  })
})
