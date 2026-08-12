import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardWorkbookFooter from '@/components/timecards/TimecardWorkbookFooter.vue'
import TimecardWorkbookHeader from '@/components/timecards/TimecardWorkbookHeader.vue'
import type { TimecardCardRecord } from '@/types/domain'

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
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
    lines: [],
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
      hoursByDay: [],
      productionByDay: [],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    ...overrides,
  }
}

describe('TimecardWorkbookHeader', () => {
  it('renders locked employee header values, wage display, and formatted week ending', () => {
    const wrapper = mount(TimecardWorkbookHeader, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        readOnly: true,
        employeeHeaderLocked: true,
        showEmployeeWage: true,
        wageInputValue: '$42.50',
      },
    })

    expect(wrapper.text()).toContain('PHASE 2 COMPANY')
    expect(wrapper.text()).toContain('EMP. NAME:')
    expect(wrapper.text()).toContain('Larsen, Chris')
    expect(wrapper.text()).toContain('EMPLOYEE#')
    expect(wrapper.text()).toContain('5133')
    expect(wrapper.text()).toContain('OCCUPATION:')
    expect(wrapper.text()).toContain('Foreman')
    expect(wrapper.get('[data-testid="timecard-wage-display"]').text()).toBe('$42.50')
    expect(wrapper.text()).toContain('WEEK ENDING')
    expect(wrapper.text()).toContain('6/13/2026')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('renders editable employee fields and forwards header update events', async () => {
    const wrapper = mount(TimecardWorkbookHeader, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        readOnly: false,
        employeeHeaderLocked: false,
        showEmployeeWage: false,
        wageInputValue: '$42.50',
      },
    })
    const inputs = wrapper.findAll('input')

    expect(wrapper.text()).toContain('----')
    expect(inputs).toHaveLength(4)
    expect((inputs[0]!.element as HTMLInputElement).placeholder).toBe('Last Name')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Larsen')
    expect((inputs[1]!.element as HTMLInputElement).placeholder).toBe('First Name')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('Chris')
    expect((inputs[2]!.element as HTMLInputElement).value).toBe('5133')
    expect((inputs[3]!.element as HTMLInputElement).value).toBe('Foreman')

    await inputs[0]!.setValue('Blanchard')
    await inputs[1]!.setValue('CJ')
    await inputs[2]!.setValue('9001')
    await inputs[3]!.setValue('Shop Foreman')

    expect(wrapper.emitted('update-field')).toEqual([
      ['lastName', 'Blanchard'],
      ['firstName', 'CJ'],
      ['employeeNumber', '9001'],
      ['occupation', 'Shop Foreman'],
    ])
  })

  it('renders editable wage input and forwards wage filter/update/commit events', async () => {
    const wrapper = mount(TimecardWorkbookHeader, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        readOnly: false,
        employeeHeaderLocked: true,
        showEmployeeWage: true,
        wageInputValue: '42.50',
      },
    })
    const wageInput = wrapper.get<HTMLInputElement>('[data-testid="timecard-wage-input"]')

    expect(wageInput.element.value).toBe('42.50')

    await wageInput.trigger('keydown', { key: 'a' })
    await wageInput.setValue('55.25')
    await wageInput.trigger('blur')

    expect(wrapper.emitted('filter-wage-key')).toHaveLength(1)
    expect(wrapper.emitted('update-wage')).toEqual([['55.25']])
    expect(wrapper.emitted('commit-wage')).toHaveLength(1)
  })

  it('disables editable fields when the card is read-only', () => {
    const wrapper = mount(TimecardWorkbookHeader, {
      props: {
        card: makeCard(),
        weekEndDate: '2026-06-13',
        readOnly: true,
        employeeHeaderLocked: false,
        showEmployeeWage: true,
        wageInputValue: '42.50',
      },
    })

    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
  })
})

describe('TimecardWorkbookFooter', () => {
  it('renders footer labels, field values, notes, and OT/REG totals', () => {
    const wrapper = mount(TimecardWorkbookFooter, {
      props: {
        card: makeCard(),
        readOnly: false,
        overtimeHours: 4,
        regularHours: 36,
      },
    })

    expect(wrapper.text()).toContain('JOB or GL')
    expect(wrapper.text()).toContain('ACCT')
    expect(wrapper.text()).toContain('OFFICE')
    expect(wrapper.text()).toContain('AMT')
    expect(wrapper.text()).toContain('OT')
    expect(wrapper.text()).toContain('REG')
    expect(wrapper.get('[data-testid="timecard-overtime-hours"]').text()).toBe('4')
    expect(wrapper.get('[data-testid="timecard-regular-hours"]').text()).toBe('36')
    expect(wrapper.get<HTMLInputElement>('[data-testid="timecard-notes-input"]').element.value).toBe('Preview notes line')
    expect(wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).value)).toEqual([
      '9411',
      '133/513',
      'Field',
      '$123.45',
      '9500',
      '600',
      'Office',
      '$67.89',
      'Preview notes line',
    ])
  })

  it('forwards footer field updates for all editable footer inputs', async () => {
    const wrapper = mount(TimecardWorkbookFooter, {
      props: {
        card: makeCard(),
        readOnly: false,
        overtimeHours: 0,
        regularHours: 0,
      },
    })
    const inputs = wrapper.findAll('input')

    await inputs[0]!.setValue('9412')
    await inputs[1]!.setValue('200')
    await inputs[2]!.setValue('Shop')
    await inputs[3]!.setValue('$10.00')
    await inputs[4]!.setValue('9413')
    await inputs[5]!.setValue('300')
    await inputs[6]!.setValue('Office')
    await inputs[7]!.setValue('$20.00')
    await inputs[8]!.setValue('Updated note')

    expect(wrapper.emitted('update-field')).toEqual([
      ['footerJobOrGl', '9412'],
      ['footerAccount', '200'],
      ['footerOffice', 'Shop'],
      ['footerAmount', '$10.00'],
      ['footerSecondJobOrGl', '9413'],
      ['footerSecondAccount', '300'],
      ['footerSecondOffice', 'Office'],
      ['footerSecondAmount', '$20.00'],
      ['notes', 'Updated note'],
    ])
  })

  it('disables every footer input when read-only', () => {
    const wrapper = mount(TimecardWorkbookFooter, {
      props: {
        card: makeCard(),
        readOnly: true,
        overtimeHours: 0,
        regularHours: 0,
      },
    })

    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
  })
})
