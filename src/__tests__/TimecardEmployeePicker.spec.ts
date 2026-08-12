import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardEmployeePicker from '@/components/timecards/TimecardEmployeePicker.vue'
import type { EmployeeRecord } from '@/types/domain'

const employees: EmployeeRecord[] = [
  {
    id: 'emp-1',
    employeeNumber: '5133',
    firstName: 'CJ',
    lastName: 'Blanchard',
    occupation: 'Shop Foreman',
    active: true,
    isContractor: false,
    jobId: null,
  },
  {
    id: 'emp-2',
    employeeNumber: '5229',
    firstName: 'Vince',
    lastName: 'Hintz',
    occupation: 'Foreman',
    active: true,
    isContractor: false,
    jobId: null,
  },
]

describe('TimecardEmployeePicker', () => {
  it('renders search and employee rows with optional row test ids', () => {
    const wrapper = mount(TimecardEmployeePicker, {
      props: {
        search: 'cj',
        employees,
        loading: false,
        testIdPrefix: 'timecards-add-employee-',
      },
    })

    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('cj')
    expect(wrapper.get('[data-testid="timecards-add-employee-emp-1"]').text()).toContain('CJ Blanchard')
    expect(wrapper.get('[data-testid="timecards-add-employee-emp-1"]').text()).toContain('#5133')
    expect(wrapper.get('[data-testid="timecards-add-employee-emp-2"]').text()).toContain('Vince Hintz')
  })

  it('emits search updates and selected employees', async () => {
    const wrapper = mount(TimecardEmployeePicker, {
      props: {
        search: '',
        employees,
        loading: false,
      },
    })

    await wrapper.get('input[type="search"]').setValue('vin')
    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('updateSearch')?.[0]).toEqual(['vin'])
    expect(wrapper.emitted('addEmployee')?.[0]).toEqual([employees[1]])
  })

  it('shows loading and empty copy when no rows are available', () => {
    const loadingWrapper = mount(TimecardEmployeePicker, {
      props: {
        search: '',
        employees: [],
        loading: true,
      },
    })
    const emptyWrapper = mount(TimecardEmployeePicker, {
      props: {
        search: '',
        employees: [],
        loading: false,
      },
    })

    expect(loadingWrapper.text()).toContain('Loading employees...')
    expect(emptyWrapper.text()).toContain('No employees available to add.')
  })

  it('propagates disabled states separately for search and employee rows', () => {
    const wrapper = mount(TimecardEmployeePicker, {
      props: {
        search: '',
        employees,
        loading: false,
        searchDisabled: true,
        employeeDisabled: true,
      },
    })

    expect(wrapper.get('input[type="search"]').attributes('disabled')).toBeDefined()

    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })
})
