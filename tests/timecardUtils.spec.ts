import { describe, expect, it } from 'vitest'
import {
  calculateRegularAndOvertimeHours,
  calculateUnitCost,
  parseHoursOverride,
  recalcTotalsForTimecard,
  type TimecardModel,
} from '@/utils/timecardUtils'
import { calculateWorkbookSummaryCost } from '@/utils/timecardWorkbook'

describe('timecard utilities', () => {
  it('calculates workbook unit cost from wage, hours, production, and rate multiplier', () => {
    const unitCost = calculateUnitCost(32, 8, 4)
    expect(unitCost).toBeCloseTo(82.816, 6)
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

  it('recalculates workbook-style job day unit cost and totals from wage and day inputs', () => {
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
    expect(day?.unitCost ?? 0).toBeCloseTo(82.816, 6)
    expect(day?.lineTotal ?? 0).toBeCloseTo(331.264, 6)
    expect(timecard.totals.hoursTotal).toBe(8)
    expect(timecard.totals.productionTotal).toBe(4)
    expect(timecard.totals.lineTotal).toBeCloseTo(331.264, 6)
  })

  it('matches legacy workbook unit-cost math from the sample card values', () => {
    expect(calculateUnitCost(24, 1.5, 25)).toBeCloseTo(1.86336, 5)
    expect(calculateUnitCost(24, 1, 20)).toBeCloseTo(1.5528, 4)
    expect(calculateWorkbookSummaryCost(24, 2.5, 45)).toBeCloseTo(1.725333, 5)
    expect(calculateWorkbookSummaryCost(24, 6, 470)).toBeCloseTo(0.39645957, 6)
  })

  it('produces the visible workbook totals for the current screenshot values', () => {
    const timecard: TimecardModel = {
      id: 'tc-2',
      jobId: 'job-1',
      weekStartDate: '2026-04-05',
      weekEndingDate: '2026-04-11',
      status: 'draft',
      createdByUid: 'u1',
      employeeRosterId: 'er1',
      employeeNumber: '120',
      employeeName: 'Nicanor U Acevedo',
      firstName: 'Nicanor',
      lastName: 'Acevedo',
      occupation: 'Framer Rocker',
      employeeWage: 24,
      subcontractedEmployee: false,
      regularHoursOverride: null,
      overtimeHoursOverride: null,
      jobs: [
        {
          jobNumber: '4197',
          subsectionArea: '99',
          account: '9015',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 1, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 1, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '99',
          account: '9001',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 2.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 2.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 3, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 2, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 2, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '2083',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 1.5, production: 25, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 1, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '4001',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 3, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 3, production: 240, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '2622',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 2, production: 30, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 4, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '99',
          account: '9005',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 4, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '88',
          account: '7127',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 5.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 1.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '4200',
          days: [
            { date: '2026-04-05', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-06', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-07', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-08', dayOfWeek: 3, hours: 3, production: 14, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-09', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-10', dayOfWeek: 5, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-04-11', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
      days: Array.from({ length: 7 }, (_, idx) => ({
        date: `2026-04-${String(5 + idx).padStart(2, '0')}`,
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

    recalcTotalsForTimecard(timecard, '2026-04-05')

    expect(timecard.totals.hours).toEqual([0, 8, 8, 8, 8, 12, 0])
    expect(timecard.totals.hoursTotal).toBe(44)

    const breakdown = calculateRegularAndOvertimeHours(timecard.totals.hoursTotal, null, null)
    expect(breakdown.regularHours).toBe(40)
    expect(breakdown.overtimeHours).toBe(4)
  })

  it('matches the filled workbook sample values currently stored in customer files', () => {
    const timecard: TimecardModel = {
      id: 'tc-3',
      jobId: 'job-1',
      weekStartDate: '2025-12-07',
      weekEndingDate: '2025-12-13',
      status: 'draft',
      createdByUid: 'u1',
      employeeRosterId: 'er1',
      employeeNumber: '240',
      employeeName: 'Aguirre Marcelo',
      firstName: 'Aguirre',
      lastName: 'Marcelo',
      occupation: 'Framer/Rocker',
      employeeWage: 30,
      subcontractedEmployee: false,
      regularHoursOverride: null,
      overtimeHoursOverride: null,
      jobs: [
        {
          jobNumber: '4197',
          subsectionArea: '99',
          account: '9015',
          days: [
            { date: '2025-12-07', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-08', dayOfWeek: 1, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-09', dayOfWeek: 2, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-10', dayOfWeek: 3, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-11', dayOfWeek: 4, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-12', dayOfWeek: 5, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-13', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '99',
          account: '9001',
          days: [
            { date: '2025-12-07', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-08', dayOfWeek: 1, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-09', dayOfWeek: 2, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-10', dayOfWeek: 3, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-11', dayOfWeek: 4, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-12', dayOfWeek: 5, hours: 0.5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-13', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '1121',
          days: [
            { date: '2025-12-07', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-08', dayOfWeek: 1, hours: 7, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-09', dayOfWeek: 2, hours: 5.5, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-10', dayOfWeek: 3, hours: 6, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-11', dayOfWeek: 4, hours: 7, production: 30, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-12', dayOfWeek: 5, hours: 3.5, production: 10, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-13', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '1118',
          days: [
            { date: '2025-12-07', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-08', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-09', dayOfWeek: 2, hours: 1.5, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-10', dayOfWeek: 3, hours: 1, production: 20, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-11', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-12', dayOfWeek: 5, hours: 0.5, production: 8, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-13', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '1101',
          days: [
            { date: '2025-12-07', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-08', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-09', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-10', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-11', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-12', dayOfWeek: 5, hours: 2, production: 8, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-13', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '4197',
          subsectionArea: '1',
          account: '2089',
          days: [
            { date: '2025-12-07', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-08', dayOfWeek: 1, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-09', dayOfWeek: 2, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-10', dayOfWeek: 3, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-11', dayOfWeek: 4, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-12', dayOfWeek: 5, hours: 1, production: 15, unitCost: 0, lineTotal: 0 },
            { date: '2025-12-13', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
      days: Array.from({ length: 7 }, (_, idx) => ({
        date: `2025-12-${String(7 + idx).padStart(2, '0')}`,
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

    recalcTotalsForTimecard(timecard, '2025-12-07')

    expect(timecard.totals.hours).toEqual([0, 8, 8, 8, 8, 8, 0])
    expect(timecard.totals.hoursTotal).toBe(40)

    expect(timecard.jobs?.[2]?.days?.[1]?.unitCost).toBeCloseTo(13.587, 6)
    expect(timecard.jobs?.[2]?.days?.[2]?.unitCost).toBeCloseTo(10.6755, 6)
    expect(timecard.jobs?.[2]?.days?.[3]?.unitCost).toBeCloseTo(11.646, 6)
    expect(timecard.jobs?.[2]?.days?.[4]?.unitCost).toBeCloseTo(9.058, 3)
    expect(timecard.jobs?.[2]?.days?.[5]?.unitCost).toBeCloseTo(13.587, 6)

    expect(calculateWorkbookSummaryCost(30, 29, 100)).toBeCloseTo(11.2578, 6)
    expect(calculateWorkbookSummaryCost(30, 3, 48)).toBeCloseTo(2.42625, 6)
    expect(calculateWorkbookSummaryCost(30, 2, 8)).toBeCloseTo(9.705, 6)
    expect(calculateWorkbookSummaryCost(30, 1, 15)).toBeCloseTo(2.588, 6)

    const breakdown = calculateRegularAndOvertimeHours(timecard.totals.hoursTotal, null, null)
    expect(breakdown.regularHours).toBe(40)
    expect(breakdown.overtimeHours).toBe(0)
  })
})
