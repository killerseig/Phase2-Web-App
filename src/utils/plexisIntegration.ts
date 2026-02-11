/**
 * Plexis Integration Utilities (Phase 3F)
 * 
 * Handles CSV import/export with Plexis payroll system
 * - Export timecards to Plexis CSV format
 * - Import employees from Plexis CSV
 * - Import shop orders for Plexis processing
 */

import type { Timecard, JobRosterEmployee } from '@/types/models'

/**
 * Plexis CSV export format for timecards
 * Expected columns: EmployeeID, EmployeeName, JobCode, Week, SunHours, MonHours, ..., SatHours, TotalHours
 */
interface PlexisTimecardRow {
  EmployeeID: string
  EmployeeName: string
  JobCode: string
  WeekEndingDate: string
  SundayHours: number
  MondayHours: number
  TuesdayHours: number
  WednesdayHours: number
  ThursdayHours: number
  FridayHours: number
  SaturdayHours: number
  TotalHours: number
}

/**
 * Plexis CSV import format for employees
 * Expected columns: EmployeeID, FirstName, LastName, SSN, Classification, HireDate, Status
 */
interface PlexisEmployeeRow {
  EmployeeID: string
  FirstName: string
  LastName: string
  SSN?: string
  Classification: string
  HireDate?: string
  Status: 'Active' | 'Inactive'
}

/**
 * Convert timecard to Plexis CSV row format
 * @param timecard - Timecard to export
 * @param jobCode - Job account/project code
 * @returns Plexis CSV row
 */
export function convertTimecardToPlexisRow(
  timecard: Timecard,
  jobCode: string
): PlexisTimecardRow {
  if (!Array.isArray(timecard.days) || timecard.days.length !== 7) {
    throw new Error(
      `Invalid timecard: expected 7 days, got ${timecard.days?.length ?? 0}`
    )
  }

  const dayLabels = [
    'SundayHours',
    'MondayHours',
    'TuesdayHours',
    'WednesdayHours',
    'ThursdayHours',
    'FridayHours',
    'SaturdayHours',
  ] as const

  const hours = timecard.days.map((day) => day.hours || 0)
  const totalHours = hours.reduce((sum, h) => sum + h, 0)

  return {
    EmployeeID: timecard.employeeNumber,
    EmployeeName: timecard.employeeName,
    JobCode: jobCode,
    WeekEndingDate: timecard.weekEndingDate,
    SundayHours: hours[0],
    MondayHours: hours[1],
    TuesdayHours: hours[2],
    WednesdayHours: hours[3],
    ThursdayHours: hours[4],
    FridayHours: hours[5],
    SaturdayHours: hours[6],
    TotalHours: totalHours,
  }
}

/**
 * Export timecards to Plexis CSV format
 * @param timecards - Array of timecards to export
 * @param jobCode - Job account/project code
 * @returns CSV string ready for download
 */
export function exportTimecardsToCsv(
  timecards: Timecard[],
  jobCode: string
): string {
  if (timecards.length === 0) {
    return ''
  }

  // CSV headers
  const headers = [
    'EmployeeID',
    'EmployeeName',
    'JobCode',
    'WeekEndingDate',
    'SundayHours',
    'MondayHours',
    'TuesdayHours',
    'WednesdayHours',
    'ThursdayHours',
    'FridayHours',
    'SaturdayHours',
    'TotalHours',
  ]

  // Convert timecards to rows
  const rows = timecards.map((tc) => convertTimecardToPlexisRow(tc, jobCode))

  // Build CSV content
  const csvLines: string[] = [headers.join(',')]

  for (const row of rows) {
    const values = [
      escapeCsvValue(row.EmployeeID),
      escapeCsvValue(row.EmployeeName),
      escapeCsvValue(row.JobCode),
      row.WeekEndingDate,
      row.SundayHours,
      row.MondayHours,
      row.TuesdayHours,
      row.WednesdayHours,
      row.ThursdayHours,
      row.FridayHours,
      row.SaturdayHours,
      row.TotalHours,
    ]
    csvLines.push(values.join(','))
  }

  return csvLines.join('\n')
}

/**
 * Import employees from Plexis CSV format
 * @param csvContent - CSV content string
 * @returns Array of imported employees
 */
export function importEmployeesFromCsv(csvContent: string): JobRosterEmployee[] {
  const lines = csvContent.trim().split('\n')

  if (lines.length < 2) {
    throw new Error('CSV must contain headers and at least one data row')
  }

  // Parse headers (case-insensitive)
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())

  const expectedFields = [
    'employeeid',
    'firstname',
    'lastname',
    'classification',
    'status',
  ]
  const missingFields = expectedFields.filter((f) => !headers.includes(f))

  if (missingFields.length > 0) {
    throw new Error(
      `CSV missing required fields: ${missingFields.join(', ')}`
    )
  }

  // Parse data rows
  const employees: JobRosterEmployee[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines

    const values = parseCSVLine(line)
    const row = zipRowWithHeaders(headers, values)

    // Parse Plexis row
    const empId = row['employeeid']?.trim()
    const firstName = row['firstname']?.trim() ?? ''
    const lastName = row['lastname']?.trim() ?? ''
    const classification = row['classification']?.trim() ?? 'Laborer'
    const status = row['status']?.trim()?.toLowerCase() ?? 'active'

    if (!empId) {
      console.warn(`[Plexis] Skipping row with missing EmployeeID`)
      continue
    }

    // Create roster employee
    const employee: JobRosterEmployee = {
      id: `emp-${empId}`,
      jobId: '', // Will be set when importing to specific job
      employeeNumber: empId,
      firstName,
      lastName,
      occupation: classification,
      wageRate: 0, // Must be set manually or from Plexis rate table
      active: status === 'active',
    }

    employees.push(employee)
  }

  if (employees.length === 0) {
    throw new Error('No valid employees found in CSV')
  }

  return employees
}

/**
 * Download CSV as file (browser environment)
 * @param csvContent - CSV content string
 * @param filename - Filename for download
 */
export function downloadCsv(csvContent: string, filename: string): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadCsv() requires browser environment')
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Helper: Escape CSV value (quote if contains comma, quote, or newline)
 */
function escapeCsvValue(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"` // Double quotes inside are escaped
  }
  return str
}

/**
 * Helper: Parse CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      // Field delimiter
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current) // Add last field
  return result
}

/**
 * Helper: Zip row values with headers
 */
function zipRowWithHeaders(
  headers: string[],
  values: string[]
): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    result[headers[i]] = values[i] ?? ''
  }
  return result
}

/**
 * Validate Plexis CSV format
 * @param csvContent - CSV content to validate
 * @returns Validation result with error messages
 */
export function validatePlexisCsv(csvContent: string): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const result = { valid: true, errors: [] as string[], warnings: [] as string[] }

  try {
    const lines = csvContent.trim().split('\n')

    if (lines.length < 2) {
      result.errors.push('CSV must contain headers and at least one data row')
      result.valid = false
      return result
    }

    // Validate headers
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const expectedFields = [
      'employeeid',
      'firstname',
      'lastname',
      'classification',
      'status',
    ]

    const missingFields = expectedFields.filter((f) => !headers.includes(f))
    if (missingFields.length > 0) {
      result.errors.push(
        `Missing required fields: ${missingFields.join(', ')}`
      )
      result.valid = false
    }

    // Validate data rows
    let validRows = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = parseCSVLine(line)
      if (values.length !== headers.length) {
        result.warnings.push(
          `Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`
        )
      } else {
        validRows++
      }
    }

    if (validRows === 0) {
      result.errors.push('No valid data rows found')
      result.valid = false
    }

    return result
  } catch (error) {
    result.errors.push(`CSV parsing failed: ${error}`)
    result.valid = false
    return result
  }
}
