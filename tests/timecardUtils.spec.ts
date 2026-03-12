import { describe, expect, it } from 'vitest'
import {
  calculateRegularAndOvertimeHours,
  calculateUnitCost,
  parseHoursOverride,
  recalcTotalsForTimecard,
  type TimecardModel,
} from '@/views/timecards/timecardUtils'

describe('timecard utilities', () => {
  it('calculates unit cost from wage, hours, production, and burden', () => {
    const unitCost = calculateUnitCost(32, 8, 4)
    expect(unitCost).toBeCloseTo(0.32, 6)
  })

  it('returns zero unit cost when inputs are missing or non-positive', () => {
    expect(calculateUnitCost(null, 8, 4)).toBe(0)
    expect(calculateUnitCost(32, 0, 4)).toBe(0)
    expect(calculateUnitCost(32, 8, 0)).toBe(0)
  })

  it('computes regular and overtime hours when no overrides are set', () => {
    const breakdown = calculateRegularAndOvertimeHours(46, null, null)
    expect(breakdown.regularHours).toBe(40)
    expect(breakdown.overtimeHours).toBe(6)
  })

  it('prefers admin overrides for regular and overtime hours', () => {
    const breakdown = calculateRegularAndOvertimeHours(46, 38, 2)
    expect(breakdown.regularHours).toBe(38)
    expect(breakdown.overtimeHours).toBe(2)
  })

  it('parses hour overrides and treats empty values as null', () => {
    expect(parseHoursOverride('')).toBeNull()
    expect(parseHoursOverride('  ')).toBeNull()
    expect(parseHoursOverride('2.5')).toBe(2.5)
    expect(parseHoursOverride('-1')).toBeNull()
  })

  it('recalculates job day unit cost and totals from wage and day inputs', () => {
    const timecard: TimecardModel = {
      id: 'tc-1',
      jobId: 'job-1',
      weekStartDate: '2024-02-04',
      weekEndingDate: '2024-02-10',
      status: 'draft',
      createdByUid: 'u1',
      employeeRosterId: 'er1',
      employeeNumber: '1234',
      employeeName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      occupation: 'Foreman',
      employeeWage: 32,
      subcontractedEmployee: false,
      regularHoursOverride: null,
      overtimeHoursOverride: null,
      jobs: [
        {
          jobNumber: '100',
          subsectionArea: 'A',
          account: '4000',
          days: [
            { date: '2024-02-04', dayOfWeek: 0, hours: 8, production: 4, unitCost: 0, lineTotal: 0 },
            { date: '2024-02-05', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2024-02-06', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2024-02-07', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2024-02-08', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2024-02-09', dayOfWeek: 5, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2024-02-10', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
      days: Array.from({ length: 7 }, (_, idx) => ({
        date: `2024-02-${String(idx + 4).padStart(2, '0')}`,
        dayOfWeek: idx,
        hours: 0,
        production: 0,
        unitCost: 0,
        lineTotal: 0,
      })),
      totals: {
        hours: Array(7).fill(0),
        production: Array(7).fill(0),
        hoursTotal: 0,
        productionTotal: 0,
        lineTotal: 0,
      },
      notes: '',
      archived: false,
    }

    recalcTotalsForTimecard(timecard, '2024-02-04')

    const day = timecard.jobs?.[0]?.days?.[0]
    expect(day?.unitCost ?? 0).toBeCloseTo(0.32, 6)
    expect(day?.lineTotal ?? 0).toBeCloseTo(1.28, 6)
    expect(timecard.totals.hoursTotal).toBe(8)
    expect(timecard.totals.productionTotal).toBe(4)
    expect(timecard.totals.lineTotal).toBeCloseTo(1.28, 6)
  })
})
