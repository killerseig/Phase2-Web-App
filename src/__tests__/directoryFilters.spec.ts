import { describe, expect, it } from 'vitest'

import {
  filterDirectoryRecords,
  matchesDirectoryQuery,
  matchesDirectoryStatus,
} from '@/utils/directoryFilters'

describe('directoryFilters', () => {
  const records = [
    { id: 'active-foreman', active: true, name: 'CJ Blanchard', role: 'Foreman' },
    { id: 'inactive-admin', active: false, name: 'Dan Larsen', role: 'Admin' },
    { id: 'active-payroll', active: true, name: 'Mackensie Dannels', role: 'Payroll' },
  ]

  it('matches active, inactive, and both status filters', () => {
    expect(matchesDirectoryStatus(records[0]!, 'active')).toBe(true)
    expect(matchesDirectoryStatus(records[0]!, 'inactive')).toBe(false)
    expect(matchesDirectoryStatus(records[1]!, 'inactive')).toBe(true)
    expect(matchesDirectoryStatus(records[1]!, 'both')).toBe(true)
  })

  it('matches normalized text across multiple searchable values', () => {
    expect(matchesDirectoryQuery('  fore  ', ['CJ Blanchard', 'Foreman'])).toBe(true)
    expect(matchesDirectoryQuery('payroll', ['Mackensie Dannels', 'Payroll'])).toBe(true)
    expect(matchesDirectoryQuery('shop', ['CJ Blanchard', 'Foreman'])).toBe(false)
  })

  it('filters a directory by status and query together', () => {
    const filtered = filterDirectoryRecords(records, 'active', 'pay', (record) => [
      record.name,
      record.role,
    ])

    expect(filtered).toEqual([records[2]])
  })
})
