import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardPrintCard from '@/components/timecards/TimecardPrintCard.vue'
import {
  createWorkbookLines,
  getWeekStartFromSaturday,
  recalculateCardTotals,
} from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  const weekEndDate = '2026-06-13'
  const weekStartDate = getWeekStartFromSaturday(weekEndDate)
  const lines = createWorkbookLines(weekStartDate)
  const firstLine = lines[0]!

  firstLine.jobNumber = '9411'
  firstLine.subsectionArea = 'Level 1'
  firstLine.account = '133/513'
  firstLine.difH = 'H-DIF'
  firstLine.difP = 'P-DIF'
  firstLine.difC = 'C-DIF'
  firstLine.days[1]!.hours = 8
  firstLine.days[2]!.hours = 8
  firstLine.days[3]!.hours = 8
  firstLine.days[4]!.hours = 8
  firstLine.days[5]!.hours = 4
  firstLine.days[1]!.production = 1
  firstLine.days[2]!.production = 1
  firstLine.days[3]!.production = 1
  firstLine.days[4]!.production = 1
  firstLine.offHours = 2
  firstLine.offProduction = 1
  firstLine.offCost = 11

  const card: TimecardCardRecord = {
    id: 'card-1',
    sourceType: 'employee',
    employeeId: 'employee-1',
    firstName: 'Chris',
    lastName: 'Larsen',
    fullName: 'Chris Larsen',
    employeeNumber: '5133',
    occupation: 'Foreman',
    wageRate: 42.5,
    isContractor: false,
    sortIndex: 0,
    lines,
    footerJobOrGl: '9411',
    footerAccount: '133/513',
    footerOffice: 'Field',
    footerAmount: '$123.45',
    footerSecondJobOrGl: '9500',
    footerSecondAccount: '600',
    footerSecondOffice: 'Office',
    footerSecondAmount: '$67.89',
    notes: 'Preview notes line',
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    totals: {
      hoursByDay: Array<number>(7).fill(0),
      productionByDay: Array<number>(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    ...overrides,
  }

  recalculateCardTotals(card, weekStartDate, 0.33)
  return card
}

describe('TimecardPrintCard', () => {
  it('renders exact-print employee header values and formatted week ending', () => {
    const wrapper = mount(TimecardPrintCard, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        burden: 0.33,
      },
    })

    expect(wrapper.text()).toContain('PHASE 2 COMPANY')
    expect(wrapper.text()).toContain('EMP. NAME:')
    expect(wrapper.text()).toContain('Larsen, Chris')
    expect(wrapper.text()).toContain('EMPLOYEE#')
    expect(wrapper.text()).toContain('5133')
    expect(wrapper.text()).toContain('OCCUPATION:')
    expect(wrapper.text()).toContain('Foreman')
    expect(wrapper.text()).toContain('WAGE')
    expect(wrapper.text()).toContain('$42.50')
    expect(wrapper.text()).toContain('WEEK ENDING')
    expect(wrapper.text()).toContain('6/13/2026')
  })

  it('renders the printable workbook grid headers, H/P/C rows, and calculated totals', () => {
    const wrapper = mount(TimecardPrintCard, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        burden: 0.33,
      },
    })
    const headerText = wrapper.findAll('thead th').map((cell) => cell.text())
    const rows = wrapper.findAll('tbody tr')
    const firstLineRows = rows.slice(0, 3).map((row) => row.text())
    const totalRow = wrapper.get('.timecard-print-grid__total-row')

    expect(headerText).toEqual([
      'JOB #',
      '1',
      '',
      'ACCT',
      'DIF',
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
      'SAT',
      'TOTAL',
      'PROD',
      'OFF',
    ])
    expect(firstLineRows[0]).toContain('9411')
    expect(firstLineRows[0]).toContain('Level 1')
    expect(firstLineRows[0]).toContain('H')
    expect(firstLineRows[0]).toContain('133/513')
    expect(firstLineRows[0]).toContain('H-DIF')
    expect(firstLineRows[0]).toContain('8.00')
    expect(firstLineRows[0]).toContain('4.00')
    expect(firstLineRows[0]).toContain('36.0')
    expect(firstLineRows[0]).toContain('2')
    expect(firstLineRows[1]).toContain('P')
    expect(firstLineRows[1]).toContain('P-DIF')
    expect(firstLineRows[1]).toContain('1.00')
    expect(firstLineRows[1]).toContain('4')
    expect(firstLineRows[1]).toContain('1')
    expect(firstLineRows[2]).toContain('C')
    expect(firstLineRows[2]).toContain('C-DIF')
    expect(firstLineRows[2]).toContain('11')
    expect(totalRow.text()).toContain('TOTAL HOURS')
    expect(totalRow.text()).toContain('36.0')
  })

  it('renders footer account rows, notes, and calculated regular/overtime values', () => {
    const wrapper = mount(TimecardPrintCard, {
      props: {
        card: makeCard({ regularHoursOverride: 32, overtimeHoursOverride: 4 }),
        weekEndDate: '2026-06-13',
        burden: 0.33,
      },
    })

    expect(wrapper.text()).toContain('JOB or GL')
    expect(wrapper.text()).toContain('ACCT')
    expect(wrapper.text()).toContain('OFFICE')
    expect(wrapper.text()).toContain('AMT')
    expect(wrapper.text()).toContain('9411')
    expect(wrapper.text()).toContain('133/513')
    expect(wrapper.text()).toContain('Field')
    expect(wrapper.text()).toContain('$123.45')
    expect(wrapper.text()).toContain('9500')
    expect(wrapper.text()).toContain('600')
    expect(wrapper.text()).toContain('Office')
    expect(wrapper.text()).toContain('$67.89')
    expect(wrapper.text()).toContain('OT')
    expect(wrapper.text()).toContain('REG')
    expect(wrapper.get('.timecard-print-card__footer-stat-line--ot').text()).toBe('4')
    expect(wrapper.get('.timecard-print-card__footer-stat-line--reg').text()).toBe('32')
    expect(wrapper.text()).toContain('NOTES:')
    expect(wrapper.text()).toContain('Preview notes line')
  })

  it('keeps zero-only production and off values blank on printable empty rows', () => {
    const wrapper = mount(TimecardPrintCard, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        burden: 0.33,
      },
    })
    const emptyLineRows = wrapper.findAll('tbody tr').slice(3, 6)

    expect(emptyLineRows[0]!.find('.timecard-print-grid__prod-cell').text()).toBe('')
    expect(emptyLineRows[0]!.find('.timecard-print-grid__off-cell').text()).toBe('')
    expect(emptyLineRows[1]!.find('.timecard-print-grid__prod-cell').text()).toBe('')
    expect(emptyLineRows[1]!.find('.timecard-print-grid__off-cell').text()).toBe('')
    expect(emptyLineRows[2]!.find('.timecard-print-grid__prod-cell').text()).toBe('')
    expect(emptyLineRows[2]!.find('.timecard-print-grid__off-cell').text()).toBe('')
  })
})
