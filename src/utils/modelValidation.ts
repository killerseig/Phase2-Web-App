/**
 * Validation Utilities for Phase 3 Models
 * Validation rules for account numbers, employee numbers, timecards, and job data
 */

import { ACCOUNT_VALIDATION, DAY_NAMES_SHORT } from '@/config/constants'
import type { Job, Timecard, TimecardDay } from '@/types/models'

// ============================================================================
// ACCOUNT NUMBER & JOB VALIDATION
// ============================================================================

/**
 * Validate account number format (4 digits only)
 */
export function validateAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null // Optional field
  
  if (!ACCOUNT_VALIDATION.ACCOUNT_NUMBER_PATTERN.test(value)) {
    return `Account number must be exactly ${ACCOUNT_VALIDATION.ACCOUNT_NUMBER_LENGTH} digits`
  }
  
  return null // Valid
}

/**
 * Validate GL code format (3 digits)
 */
export function validateGLCode(value: string | null | undefined): string | null {
  if (!value) return null // Optional field
  
  if (!/^\d{3}$/.test(value)) {
    return `GL code must be exactly ${ACCOUNT_VALIDATION.GL_CODE_LENGTH} digits`
  }
  
  return null // Valid
}

/**
 * Validate job account number and GL code relationship
 * - If GL code is 3-digit, account number must be null/empty
 * - If account number is provided, GL code must not be 3-digit
 */
export function validateJobAccountLogic(job: Partial<Job>): string | null {
  const code = job.code?.trim()
  const account = job.accountNumber?.trim()
  
  const isGLCode = code && /^\d{3}$/.test(code)
  
  // If GL code: account must be blank
  if (isGLCode && account) {
    return 'Account number must be blank when using a 3-digit GL code'
  }
  
  // If account provided: must be 4 digits
  if (account && !isGLCode) {
    const accountError = validateAccountNumber(account)
    if (accountError) return accountError
  }
  
  return null // Valid
}

// ============================================================================
// EMPLOYEE NUMBER VALIDATION
// ============================================================================

/**
 * Validate employee number format (4-5 digits)
 */
export function validateEmployeeNumber(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return 'Employee number is required'
  }
  
  if (!ACCOUNT_VALIDATION.EMPLOYEE_NUMBER_PATTERN.test(value.trim())) {
    return `Employee number must be ${ACCOUNT_VALIDATION.EMPLOYEE_NUMBER_MIN}-${ACCOUNT_VALIDATION.EMPLOYEE_NUMBER_MAX} digits`
  }
  
  return null // Valid
}

/**
 * Validate employee number is unique within a job roster
 * Note: This requires async check against Firestore
 */
export function validateEmployeeNumberUnique(
  employeeNumber: string,
  existingNumbers: string[],
  excludeId?: string
): string | null {
  const normalized = employeeNumber.trim()
  
  // Check if already exists (excluding current employee if updating)
  const isDuplicate = existingNumbers.some(num => num === normalized)
  
  if (isDuplicate) {
    return `Employee number ${normalized} already exists in this job`
  }
  
  return null // Valid
}

// ============================================================================
// TIMECARD VALIDATION
// ============================================================================

/**
 * Validate that weekEndingDate is a Saturday (day 6)
 */
export function validateWeekEndingDate(dateStr: string): string | null {
  if (!dateStr) return 'Week ending date is required'
  
  try {
    const date = new Date(dateStr + 'T00:00:00Z')
    const dayOfWeek = date.getUTCDay()
    
    if (dayOfWeek !== 6) { // 6 = Saturday
      return `Week must end on a Saturday (selected: ${DAY_NAMES_SHORT[dayOfWeek]})`
    }
    
    return null // Valid
  } catch {
    return 'Invalid date format'
  }
}

/**
 * Calculate and validate weekStartDate (should be Sunday, 6 days before weekEnding)
 */
export function calculateWeekStartDate(weekEndingDate: string): string {
  const endDate = new Date(weekEndingDate + 'T00:00:00Z')
  const startDate = new Date(endDate)
  startDate.setUTCDate(startDate.getUTCDate() - 6) // 6 days back from Saturday = Sunday
  
  const year = startDate.getUTCFullYear()
  const month = String(startDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(startDate.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Snap a date to the previous Sunday (or the Sunday itself if already Sunday)
 * Used for calendar week selection - ensures consistency
 * @param dateStr Date string in YYYY-MM-DD format or Date object
 * @returns Sunday date in YYYY-MM-DD format
 */
export function snapToSunday(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' 
    ? new Date(dateStr + 'T00:00:00Z')
    : dateStr
  
  const dayOfWeek = date.getUTCDay()
  const daysToSubtract = dayOfWeek // 0=Sun (subtract 0), 1=Mon (subtract 1), etc.
  
  const sunday = new Date(date)
  sunday.setUTCDate(sunday.getUTCDate() - daysToSubtract)
  
  const year = sunday.getUTCFullYear()
  const month = String(sunday.getUTCMonth() + 1).padStart(2, '0')
  const day = String(sunday.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Get the Saturday that ends the week for a given Sunday
 * @param sundayStr Sunday date in YYYY-MM-DD format
 * @returns Saturday date in YYYY-MM-DD format
 */
export function getSaturdayFromSunday(sundayStr: string): string {
  const sunday = new Date(sundayStr + 'T00:00:00Z')
  const saturday = new Date(sunday)
  saturday.setUTCDate(saturday.getUTCDate() + 6)
  
  const year = saturday.getUTCFullYear()
  const month = String(saturday.getUTCMonth() + 1).padStart(2, '0')
  const day = String(saturday.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Validate a single timecard day entry
 */
export function validateTimecardDay(day: Partial<TimecardDay>, dayIndex: number): string | null {
  if (!day) return `Day ${dayIndex} data is required`
  
  // Check hours
  if (typeof day.hours !== 'number' || day.hours < 0) {
    return `${DAY_NAMES_SHORT[dayIndex]}: Hours must be a non-negative number`
  }
  
  // Check production
  if (typeof day.production !== 'number' || day.production < 0) {
    return `${DAY_NAMES_SHORT[dayIndex]}: Production must be a non-negative number`
  }
  
  // Check unit cost
  if (typeof day.unitCost !== 'number' || day.unitCost < 0) {
    return `${DAY_NAMES_SHORT[dayIndex]}: Unit cost must be a non-negative number`
  }
  
  return null // Valid
}

/**
 * Validate all 7 days of a timecard and calculate totals
 */
export function validateTimecardDays(days: Partial<TimecardDay>[]): {
  valid: boolean
  error: string | null
  totals?: { hours: number; production: number; lineTotal: number }
} {
  if (!Array.isArray(days) || days.length !== 7) {
    return {
      valid: false,
      error: 'Timecard must have exactly 7 days',
    }
  }
  
  let totalHours = 0
  let totalProduction = 0
  let totalLineTotal = 0
  
  for (let i = 0; i < 7; i++) {
    const error = validateTimecardDay(days[i], i)
    if (error) {
      return { valid: false, error }
    }
    
    const day = days[i] as TimecardDay
    totalHours += day.hours
    totalProduction += day.production
    totalLineTotal += day.lineTotal
  }
  
  return {
    valid: true,
    error: null,
    totals: {
      hours: totalHours,
      production: totalProduction,
      lineTotal: totalLineTotal,
    },
  }
}

/**
 * Validate complete timecard
 */
export function validateTimecard(timecard: Partial<Timecard>): string | null {
  // Check required fields
  if (!timecard.weekEndingDate) return 'Week ending date is required'
  if (!timecard.employeeRosterId) return 'Employee is required'
  if (!Array.isArray(timecard.days)) return 'Timecard days are required'
  
  // Validate week ending date
  const dateError = validateWeekEndingDate(timecard.weekEndingDate)
  if (dateError) return dateError
  
  // Validate all days
  const daysValidation = validateTimecardDays(timecard.days)
  if (!daysValidation.valid) return daysValidation.error
  
  return null // Valid
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Check if a date string is a Saturday
 */
export function isSaturday(dateStr: string): boolean {
  try {
    const date = new Date(dateStr + 'T00:00:00Z')
    return date.getUTCDay() === 6
  } catch {
    return false
  }
}

/**
 * Get the date range for display (Sun - Sat)
 */
export function formatWeekRange(weekStartDate: string, weekEndingDate: string): string {
  try {
    const start = new Date(weekStartDate + 'T00:00:00Z')
    const end = new Date(weekEndingDate + 'T00:00:00Z')
    
    const startMonth = (start.getUTCMonth() + 1).toString().padStart(2, '0')
    const startDay = start.getUTCDate().toString().padStart(2, '0')
    const endMonth = (end.getUTCMonth() + 1).toString().padStart(2, '0')
    const endDay = end.getUTCDate().toString().padStart(2, '0')
    
    return `${startMonth}/${startDay} - ${endMonth}/${endDay}`
  } catch {
    return 'Invalid dates'
  }
}

/**
 * Get all Saturdays in the last N weeks (for week selector)
 */
export function getSaturdayDates(numWeeks: number): string[] {
  const dates: string[] = []
  const today = new Date()
  
  // Find the most recent Saturday
  const dayOfWeek = today.getUTCDay()
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7
  const recentSaturday = new Date(today)
  recentSaturday.setUTCDate(today.getUTCDate() + daysUntilSaturday)
  
  // Go back numWeeks and collect Saturdays
  for (let i = 0; i < numWeeks; i++) {
    const saturday = new Date(recentSaturday)
    saturday.setUTCDate(recentSaturday.getUTCDate() - i * 7)
    
    const year = saturday.getUTCFullYear()
    const month = String(saturday.getUTCMonth() + 1).padStart(2, '0')
    const day = String(saturday.getUTCDate()).padStart(2, '0')
    
    dates.push(`${year}-${month}-${day}`)
  }
  
  return dates
}

// ============================================================================
// TIMECARD CSV EXPORT VALIDATION
// ============================================================================

/**
 * Validate timecard is ready for CSV export (Plexis format)
 */
export function validateForCsvExport(timecard: Partial<Timecard>): string | null {
  if (!timecard.id) return 'Timecard ID is required'
  if (!timecard.jobId) return 'Job ID is required'
  if (timecard.status !== 'submitted') return 'Only submitted timecards can be exported'
  if (!Array.isArray(timecard.days) || timecard.days.length !== 7) {
    return 'Timecard must have all 7 days filled'
  }
  
  return null // Valid
}
