import { describe, expect, it } from 'vitest'

import { buildTimecardCsvExport } from '@/features/timecards/csv-export'
import { buildEmployeeCard } from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

describe('buildTimecardCsvExport', () => {
  it('preserves a three-digit numeric account code as the activity code', () => {
    const card: TimecardCardRecord = {
      id: 'card-1',
      ...buildEmployeeCard(
        {
          employeeId: 'employee-1',
          firstName: 'Chris',
          lastName: 'Larsen',
          employeeNumber: '5133',
          occupation: 'Foreman',
          wageRate: 42.5,
          isContractor: false,
        },
        '2026-06-13',
        0,
        '7539',
      ),
    }
    const line = card.lines[0]!
    line.subsectionArea = '99'
    line.account = '716'
    line.days[1]!.hours = 8

    const result = buildTimecardCsvExport([card])

    expect(result.detailRowCount).toBe(1)
    expect(result.csvText).toContain(',99,716,,8,,,')
  })
})
