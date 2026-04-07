import { describe, expect, it, vi } from 'vitest'
import {
  buildWorkbookTimecardLines,
  buildTimecardInputFromRosterEmployee,
  createWorkbookTimecardLines,
  ensureWorkbookTimecardLines,
  matchesRosterEmployeeTimecard,
  TIMECARD_WORKBOOK_LINE_COUNT,
} from '@/utils/timecardWorkbook'

vi.mock('@/utils/modelValidation', () => ({
  calculateWeekStartDate: vi.fn(() => '2026-02-22'),
}))

describe('timecardWorkbook utilities', () => {
  it('creates the fixed workbook line template', () => {
    const lines = createWorkbookTimecardLines('2026-02-22')

    expect(lines).toHaveLength(TIMECARD_WORKBOOK_LINE_COUNT)
    expect(lines[0]).toMatchObject({
      jobNumber: '',
      subsectionArea: '',
      account: '',
      costCode: '',
      difH: '',
      difP: '',
      difC: '',
      offHours: 0,
      offProduction: 0,
      offCost: 0,
    })
    expect(lines[0]?.days).toHaveLength(7)
    expect(lines[1]).not.toBe(lines[0])
    expect(lines[1]?.days).not.toBe(lines[0]?.days)
  })

  it('builds a roster-backed timecard input with workbook defaults', () => {
    const input = buildTimecardInputFromRosterEmployee(
      {
        id: 'roster-1',
        jobId: 'job-1',
        employeeNumber: '8060',
        firstName: 'Anselmo',
        lastName: 'Gutierrez',
        occupation: 'Framer',
        wageRate: 30,
        contractor: { name: 'TERM', category: 'Labor' },
        active: true,
      },
      '2026-02-28',
    )

    expect(input).toMatchObject({
      weekEndingDate: '2026-02-28',
      employeeRosterId: 'roster-1',
      employeeNumber: '8060',
      employeeName: 'Anselmo Gutierrez',
      firstName: 'Anselmo',
      lastName: 'Gutierrez',
      occupation: 'Framer',
      employeeWage: 30,
      subcontractedEmployee: true,
      notes: '',
    })
    expect(input.jobs).toHaveLength(TIMECARD_WORKBOOK_LINE_COUNT)
    expect(input.days).toHaveLength(7)
  })

  it('normalizes sparse day arrays by dayOfWeek into workbook positions', () => {
    const jobs = ensureWorkbookTimecardLines({
      weekStartDate: '2026-02-22',
      jobs: [
        {
          jobNumber: '1000',
          days: [
            { date: '2026-02-23', dayOfWeek: 1, hours: 4, production: 8, unitCost: 0, lineTotal: 0 },
            { date: '2026-02-28', dayOfWeek: 6, hours: 6, production: 12, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
    })

    expect(jobs[0]?.days?.[0]).toMatchObject({ dayOfWeek: 0, hours: 0, production: 0 })
    expect(jobs[0]?.days?.[1]).toMatchObject({ dayOfWeek: 1, hours: 4, production: 8 })
    expect(jobs[0]?.days?.[6]).toMatchObject({ dayOfWeek: 6, hours: 6, production: 12 })
  })

  it('builds workbook lines without mutating the source timecard', () => {
    const source = {
      weekStartDate: '2026-02-22',
      jobs: [
        {
          jobNumber: '1000',
          days: [
            { date: '2026-02-23', dayOfWeek: 1, hours: 4, production: 8, unitCost: 0, lineTotal: 0 },
          ],
        },
      ],
    }

    const lines = buildWorkbookTimecardLines(source)

    expect(lines[0]?.days?.[1]).toMatchObject({ dayOfWeek: 1, hours: 4, production: 8 })
    expect(source.jobs).toHaveLength(1)
    expect(source.jobs?.[0]?.days).toHaveLength(1)
  })

  it('matches existing timecards by roster id or legacy employee number', () => {
    expect(matchesRosterEmployeeTimecard(
      { id: 'roster-1', employeeNumber: '8060' },
      { employeeRosterId: 'roster-1', employeeNumber: '1111' },
    )).toBe(true)

    expect(matchesRosterEmployeeTimecard(
      { id: 'roster-1', employeeNumber: '8060' },
      { employeeRosterId: '', employeeNumber: '8060' },
    )).toBe(true)

    expect(matchesRosterEmployeeTimecard(
      { id: 'roster-1', employeeNumber: '8060' },
      { employeeRosterId: 'other', employeeNumber: '9999' },
    )).toBe(false)
  })
})
