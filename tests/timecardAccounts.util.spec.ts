import { describe, expect, it } from 'vitest'
import { buildTimecardAccountsSummary } from '@/utils/timecardAccounts'
import type { TimecardModel } from '@/utils/timecardUtils'

function createTimecard(overrides: Partial<TimecardModel> = {}): TimecardModel {
  return {
    id: 'tc-1',
    jobId: 'job-1',
    weekStartDate: '2026-03-08',
    weekEndingDate: '2026-03-14',
    status: 'draft',
    createdByUid: 'user-1',
    employeeRosterId: 'roster-1',
    employeeNumber: '100',
    employeeName: 'Casey Stone',
    firstName: 'Casey',
    lastName: 'Stone',
    occupation: 'Carpenter',
    employeeWage: 30,
    subcontractedEmployee: false,
    jobs: [],
    days: [],
    totals: {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    notes: '',
    archived: false,
    ...overrides,
  }
}

describe('buildTimecardAccountsSummary', () => {
  it('aggregates job lines by job number, area, and account', () => {
    const summary = buildTimecardAccountsSummary([
      createTimecard({
        id: 'tc-1',
        jobs: [
          {
            jobNumber: '1000',
            subsectionArea: 'Frame',
            account: '5000',
            days: [
              { date: '2026-03-09', dayOfWeek: 1, hours: 4, production: 8, unitCost: 0, lineTotal: 0 },
              { date: '2026-03-10', dayOfWeek: 2, hours: 4, production: 10, unitCost: 0, lineTotal: 0 },
            ],
          },
        ],
      }),
      createTimecard({
        id: 'tc-2',
        jobs: [
          {
            jobNumber: '1000',
            subsectionArea: 'Frame',
            account: '5000',
            days: [
              { date: '2026-03-11', dayOfWeek: 3, hours: 2, production: 3, unitCost: 0, lineTotal: 0 },
            ],
          },
          {
            jobNumber: '2000',
            subsectionArea: 'Rock',
            account: '7000',
            days: [
              { date: '2026-03-12', dayOfWeek: 4, hours: 6, production: 12, unitCost: 0, lineTotal: 0 },
            ],
          },
        ],
      }),
    ])

    expect(summary).toEqual([
      {
        key: '1000|frame|5000',
        jobNumber: '1000',
        subsectionArea: 'Frame',
        account: '5000',
        hoursTotal: 10,
        productionTotal: 21,
      },
      {
        key: '2000|rock|7000',
        jobNumber: '2000',
        subsectionArea: 'Rock',
        account: '7000',
        hoursTotal: 6,
        productionTotal: 12,
      },
    ])
  })
})
