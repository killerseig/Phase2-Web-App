import { describe, expect, it } from 'vitest'
import {
  createDatePickerConfig,
  formatDateInputValue,
  getDateInputValueFromSelection,
  getLastCompletedSaturdayDateInputValue,
  getTodayDateInputValue,
  isValidDateInputValue,
  toDateInputValue,
} from '@/utils/dateInputs'

describe('dateInputs utilities', () => {
  it('formats local dates for date inputs', () => {
    expect(formatDateInputValue(new Date(2026, 2, 18))).toBe('2026-03-18')
    expect(getTodayDateInputValue(new Date(2026, 2, 18))).toBe('2026-03-18')
  })

  it('validates date input values', () => {
    expect(isValidDateInputValue('2026-03-18')).toBe(true)
    expect(isValidDateInputValue('2026-02-29')).toBe(false)
    expect(isValidDateInputValue('invalid')).toBe(false)
  })

  it('extracts date input values from flatpickr-style selections', () => {
    expect(getDateInputValueFromSelection([new Date(2026, 2, 18)])).toBe('2026-03-18')
    expect(getDateInputValueFromSelection([])).toBeNull()
  })

  it('computes the last completed Saturday using local dates', () => {
    expect(getLastCompletedSaturdayDateInputValue(new Date(2026, 2, 18, 12, 0, 0))).toBe('2026-03-14')
    expect(getLastCompletedSaturdayDateInputValue(new Date(2026, 2, 21, 12, 0, 0))).toBe('2026-03-21')
  })

  it('normalizes date input values from strings and Date objects', () => {
    expect(toDateInputValue('2026-03-18')).toBe('2026-03-18')
    expect(toDateInputValue(new Date(2026, 2, 18))).toBe('2026-03-18')
    expect(toDateInputValue('2026-02-29')).toBeUndefined()
  })

  it('builds shared date picker config with overrides', () => {
    expect(createDatePickerConfig({ maxDate: '2026-03-21' })).toEqual({
      dateFormat: 'Y-m-d',
      disableMobile: true,
      prevArrow: '<i class="bi bi-chevron-left"></i>',
      nextArrow: '<i class="bi bi-chevron-right"></i>',
      maxDate: '2026-03-21',
    })
  })
})
