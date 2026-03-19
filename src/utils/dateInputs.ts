export type SharedDatePickerConfig = {
  dateFormat: string
  disableMobile: boolean
  prevArrow: string
  nextArrow: string
  maxDate?: string | Date
  minDate?: string | Date
}

const BASE_DATE_PICKER_CONFIG: SharedDatePickerConfig = {
  dateFormat: 'Y-m-d',
  disableMobile: true,
  prevArrow: '<i class="bi bi-chevron-left"></i>',
  nextArrow: '<i class="bi bi-chevron-right"></i>',
}

export function createDatePickerConfig(overrides: Partial<SharedDatePickerConfig> = {}): SharedDatePickerConfig {
  return {
    ...BASE_DATE_PICKER_CONFIG,
    ...overrides,
  }
}

export function formatDateInputValue(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDateInputValue(reference = new Date()): string {
  return formatDateInputValue(reference)
}

export function isValidDateInputValue(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

export function getDateInputValueFromSelection(selectedDates: Date[]): string | null {
  const selected = Array.isArray(selectedDates) && selectedDates.length ? selectedDates[0] : null
  return selected ? formatDateInputValue(selected) : null
}

export function getLastCompletedSaturdayDateInputValue(reference = new Date()): string {
  const lastSaturday = new Date(reference)
  const day = lastSaturday.getDay()
  const daysToSubtract = day === 6 ? 0 : day + 1
  lastSaturday.setDate(lastSaturday.getDate() - daysToSubtract)
  return formatDateInputValue(lastSaturday)
}

export function toDateInputValue(input?: string | Date | null): string | undefined {
  if (!input) return undefined
  if (typeof input === 'string') {
    return isValidDateInputValue(input) ? input : undefined
  }
  return formatDateInputValue(input)
}
