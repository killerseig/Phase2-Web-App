import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
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
  const secondLine = lines[1]!
  const thirdLine = lines[2]!

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

  secondLine.jobNumber = '9411'
  thirdLine.jobNumber = '9500'

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
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
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

describe('TimecardWorkbookCard', () => {
  it('renders the editable workbook header, grid, totals, and footer values', () => {
    const wrapper = mount(TimecardWorkbookCard, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        burden: 0.33,
      },
    })

    expect(wrapper.text()).toContain('PHASE 2 COMPANY')
    expect(wrapper.text()).toContain('Larsen, Chris')
    expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual([
      'JOB #',
      'AREA',
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
    expect(wrapper.get('[data-testid="timecard-row-label-0-hours"]').text()).toBe('H')
    expect(wrapper.get('[data-testid="timecard-row-label-0-production"]').text()).toBe('P')
    expect(wrapper.get('[data-testid="timecard-row-label-0-cost"]').text()).toBe('C')
    expect(wrapper.get<HTMLInputElement>('[data-testid="timecard-job-number-0"]').element.value).toBe('9411')
    expect(wrapper.get<HTMLInputElement>('[data-testid="timecard-account-0"]').element.value).toBe('133/513')
    expect(wrapper.get('[data-testid="timecard-total-hours-day-0"]').text()).toBe('8.0')
    expect(wrapper.get('[data-testid="timecard-total-hours"]').text()).toBe('36.0')
    expect(wrapper.get<HTMLInputElement>('[data-testid="timecard-notes-input"]').element.value).toBe('Preview notes line')
    expect(wrapper.get('[data-testid="timecard-regular-hours"]').text()).toBe('36')
  })

  it('mutates line fields, cascades job number changes to matching blank-following rows, and emits changed', async () => {
    const card = makeCard()
    const wrapper = mount(TimecardWorkbookCard, {
      props: {
        card,
        weekEndDate: '2026-06-13',
      },
    })

    await wrapper.get<HTMLInputElement>('[data-testid="timecard-job-number-0"]').setValue('7777')
    await wrapper.get<HTMLInputElement>('[data-testid="timecard-account-0"]').setValue('200/300')

    expect(card.lines[0]!.jobNumber).toBe('7777')
    expect(card.lines[1]!.jobNumber).toBe('7777')
    expect(card.lines[2]!.jobNumber).toBe('9500')
    expect(card.lines[0]!.account).toBe('200/300')
    expect(wrapper.emitted('changed')).toHaveLength(2)
  })

  it('keeps numeric drafts editable until blur while updating card values', async () => {
    const card = makeCard()
    const wrapper = mount(TimecardWorkbookCard, {
      props: {
        card,
        weekEndDate: '2026-06-13',
      },
    })
    const mondayHours = wrapper.get<HTMLInputElement>('input[data-nav-row-start="0"][data-nav-col="4"]')
    const offProduction = wrapper.get<HTMLInputElement>('input[data-nav-row-start="1"][data-nav-col="11"]')

    await mondayHours.setValue('6.5')
    expect(card.lines[0]!.days[1]!.hours).toBe(6.5)
    expect(mondayHours.element.value).toBe('6.5')

    await mondayHours.trigger('blur')
    expect(mondayHours.element.value).toBe('6.50')

    await offProduction.setValue('3')
    await offProduction.trigger('blur')

    expect(card.lines[0]!.offProduction).toBe(3)
    expect(wrapper.emitted('changed')).toHaveLength(2)
  })

  it('locks every workbook input when read-only', () => {
    const wrapper = mount(TimecardWorkbookCard, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        readOnly: true,
      },
    })

    expect(wrapper.findAll('input')).not.toHaveLength(0)
    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
  })

  it('renders only the employee header when compact mode is enabled', () => {
    const wrapper = mount(TimecardWorkbookCard, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        compact: true,
      },
    })

    expect(wrapper.text()).toContain('PHASE 2 COMPANY')
    expect(wrapper.find('.timecard-grid').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'TimecardWorkbookFooter' }).exists()).toBe(false)
  })
})
