import { describe, expect, it } from 'vitest'
import type { Timecard } from '@/types/models'
import { buildTimecardOfficeCsv } from '@/utils/timecardOfficeExport'

function buildBaseTimecard(): Timecard {
  return {
    id: 'tc-1',
    jobId: 'job-1',
    weekStartDate: '2026-02-22',
    weekEndingDate: '2026-02-28',
    status: 'submitted',
    createdByUid: 'u1',
    employeeRosterId: 'er-1',
    employeeNumber: '8060',
    employeeName: 'Anselmo Gutierrez',
    firstName: 'Anselmo',
    lastName: 'Gutierrez',
    occupation: 'Framer',
    employeeWage: 30,
    subcontractedEmployee: false,
    jobs: [],
    days: Array.from({ length: 7 }, (_, idx) => ({
      date: `2026-02-${String(22 + idx).padStart(2, '0')}`,
      dayOfWeek: idx,
      hours: 0,
      production: 0,
      unitCost: 0,
      lineTotal: 0,
      notes: '',
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
}

describe('timecardOfficeExport', () => {
  it('builds the office CSV shape from workbook-like line entries', () => {
    const timecard: Timecard = {
      ...buildBaseTimecard(),
      jobs: [
        {
          jobNumber: '6428',
          subsectionArea: '2',
          account: '1101',
          days: [
            { date: '2026-02-22', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-02-23', dayOfWeek: 1, hours: 8, production: 19, unitCost: 0, lineTotal: 0 },
            { date: '2026-02-24', dayOfWeek: 2, hours: 8, production: 20, unitCost: 0, lineTotal: 0 },
          ],
        },
        {
          jobNumber: '6428',
          subsectionArea: '7131',
          account: '7000-WO',
          costCode: '7000-WO',
          days: [
              { date: '2026-02-23', dayOfWeek: 1, hours: 8, production: 0, unitCost: 0, lineTotal: 0 },
            ],
        } as NonNullable<Timecard['jobs']>[number],
        {
          jobNumber: '6428',
          subsectionArea: '99',
          account: '9015',
          days: [
            { date: '2026-02-23', dayOfWeek: 1, hours: 1, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
    }

    const csv = buildTimecardOfficeCsv([timecard])
    const rows = csv.split('\r\n')

    expect(rows[0]).toBe('Employee Name,Employee Code,Job Code,DETAIL_DATE,Sub-Section,Activity Code,Cost Code,H_Hours,P_HOURS,,')
    expect(rows[1]).toBe(',,,,,,,,,,')
    expect(rows[2]).toBe('"Gutierrez, Anselmo",8060,6428,2/28/2026,2,1101,,16,39,,')
    expect(rows[3]).toBe('"Gutierrez, Anselmo",8060,6428,2/28/2026,7131,7000-WO,7000-WO,8,,,')
    expect(rows[4]).toBe('"Gutierrez, Anselmo",8060,6428,2/28/2026,99,9015,,1,,,')
    expect(rows).toHaveLength(109)
  })

  it('ignores sunday hours in the form total and strips leaked activity codes', () => {
    const timecard: Timecard = {
      ...buildBaseTimecard(),
      jobs: [
        {
          jobNumber: '6428',
          subsectionArea: '10',
          account: '6428',
          days: [
            { date: '2026-02-22', dayOfWeek: 0, hours: 5, production: 0, unitCost: 0, lineTotal: 0 },
            { date: '2026-02-23', dayOfWeek: 1, hours: 8, production: 0, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
    }

    const csv = buildTimecardOfficeCsv([timecard], { fixedDataRowCount: 5 })
    const rows = csv.split('\r\n')

    expect(rows[2]).toBe('"Gutierrez, Anselmo",8060,6428,2/28/2026,10,,,8,,,')
  })
})
