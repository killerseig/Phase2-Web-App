import { describe, expect, it } from 'vitest'

import {
  findTimecardSubmissionValidationIssues,
  formatTimecardSubmissionValidationMessage,
} from '@/features/timecards/submissionValidation'
import { createEmptyWorkbookLine } from '@/features/timecards/workbook'
import type { TimecardCardRecord, TimecardWorkbookLineRecord } from '@/types/domain'

function makeLine(
  overrides: Partial<TimecardWorkbookLineRecord> = {},
): TimecardWorkbookLineRecord {
  return {
    ...createEmptyWorkbookLine('2026-06-14'),
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
    id: 'card-vince',
    employeeId: 'employee-vince',
    employeeNumber: '5133',
    firstName: 'Vince',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Vince Hintz',
    isContractor: false,
    lastName: 'Hintz',
    lines: [],
    notes: '',
    occupation: 'Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: null,
    ...overrides,
  }
}

describe('timecard submission validation', () => {
  it('allows blank draft lines and lines whose Job #, Area, and Acct are complete', () => {
    const blankLine = makeLine()
    const completeLine = makeLine({
      account: '716',
      jobNumber: '7539',
      subsectionArea: '2',
    })
    completeLine.days[1]!.hours = 8

    expect(findTimecardSubmissionValidationIssues([
      makeCard({ lines: [blankLine, completeLine] }),
    ])).toEqual([])
  })

  it('requires all three fields when any daily H hours are positive', () => {
    const line = makeLine({
      account: '  ',
      jobNumber: '7539',
      subsectionArea: '',
    })
    line.days[4]!.hours = 2.5

    expect(findTimecardSubmissionValidationIssues([
      makeCard({ lines: [makeLine(), line] }),
    ])).toEqual([{
      cardId: 'card-vince',
      cardLabel: 'Vince Hintz',
      lineIndex: 1,
      missingFields: ['subsectionArea', 'account'],
    }])
  })

  it('treats positive OFF hours as hours but ignores production without hours', () => {
    const productionOnlyLine = makeLine()
    productionOnlyLine.days[2]!.production = 20
    const offHoursLine = makeLine({ offHours: 4 })

    expect(findTimecardSubmissionValidationIssues([
      makeCard({ lines: [productionOnlyLine, offHoursLine] }),
    ])).toEqual([{
      cardId: 'card-vince',
      cardLabel: 'Vince Hintz',
      lineIndex: 1,
      missingFields: ['jobNumber', 'subsectionArea', 'account'],
    }])
  })

  it('formats an actionable message for the first issue and reports remaining lines', () => {
    const message = formatTimecardSubmissionValidationMessage([
      {
        cardId: 'card-vince',
        cardLabel: 'Vince Hintz',
        lineIndex: 2,
        missingFields: ['subsectionArea', 'account'],
      },
      {
        cardId: 'card-cj',
        cardLabel: 'CJ Blanchard',
        lineIndex: 0,
        missingFields: ['jobNumber'],
      },
    ])

    expect(message).toBe(
      'Vince Hintz, line 3 has hours but is missing Area and Acct. Complete Job #, Area, and Acct on every line with hours before submitting. 1 other incomplete line also needs attention.',
    )
  })
})
