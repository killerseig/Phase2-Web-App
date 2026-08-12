import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EmployeeDirectoryPanel from '@/components/employees/EmployeeDirectoryPanel.vue'
import type { EmployeeRecord } from '@/types/domain'

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    employeeNumber: '5133',
    firstName: 'Chris',
    lastName: 'Larsen',
    occupation: 'Foreman',
    active: true,
    isContractor: false,
    jobId: null,
    ...overrides,
  }
}

function mountDirectory(overrides: Partial<InstanceType<typeof EmployeeDirectoryPanel>['$props']> = {}) {
  return mount(EmployeeDirectoryPanel, {
    props: {
      employees: [
        makeEmployee({
          id: 'employee-1',
          employeeNumber: '5133',
          firstName: 'Chris',
          lastName: 'Larsen',
          occupation: 'Foreman',
        }),
        makeEmployee({
          id: 'employee-2',
          employeeNumber: '',
          firstName: '',
          lastName: '',
          occupation: '',
          active: false,
          isContractor: true,
        }),
      ],
      employeesLoading: false,
      selectedEmployeeId: 'employee-1',
      isCreateMode: false,
      searchTerm: 'chris',
      statusFilter: 'active',
      ...overrides,
    },
  })
}

describe('EmployeeDirectoryPanel', () => {
  it('renders employee rows, status/type badges, fallbacks, filters, and active selection', () => {
    const wrapper = mountDirectory()

    expect(wrapper.text()).toContain('Employees')
    expect(wrapper.text()).toContain('New Employee')
    expect(wrapper.text()).toContain('Create Employee')
    expect(wrapper.text()).toContain('Chris Larsen')
    expect(wrapper.text()).toContain('Foreman')
    expect(wrapper.text()).toContain('Employee #5133')
    expect(wrapper.text()).toContain('Employee')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Unnamed Employee')
    expect(wrapper.text()).toContain('No occupation')
    expect(wrapper.text()).toContain('Employee #No Number')
    expect(wrapper.text()).toContain('Contractor')
    expect(wrapper.text()).toContain('Inactive')
    expect(wrapper.get('[data-testid="employee-row-employee-1"]').classes()).toContain('app-list-button--active')
    expect(wrapper.get<HTMLInputElement>('[data-testid="employees-search"]').element.value).toBe('chris')
    expect(wrapper.get<HTMLSelectElement>('[data-testid="employees-status-filter"]').element.value).toBe('active')
  })

  it('marks create mode active and emits create, search, status, and row-selection events', async () => {
    const wrapper = mountDirectory({
      isCreateMode: true,
      selectedEmployeeId: null,
    })

    expect(wrapper.findAll('.app-list-button--active')[0]!.text()).toContain('Create Employee')

    await wrapper.get('button.app-button--primary').trigger('click')
    await wrapper.findAll('button.app-list-button')[0]!.trigger('click')
    await wrapper.get('[data-testid="employees-search"]').setValue('cj')
    await wrapper.get('[data-testid="employees-status-filter"]').setValue('both')
    await wrapper.get('[data-testid="employee-row-employee-2"]').trigger('click')

    expect(wrapper.emitted('createEmployee')).toHaveLength(2)
    expect(wrapper.emitted('update:searchTerm')).toEqual([['cj']])
    expect(wrapper.emitted('update:statusFilter')).toEqual([['both']])
    expect(wrapper.emitted('selectEmployee')).toEqual([['employee-2']])
  })

  it('shows loading and empty states without rendering stale employee rows', () => {
    const loadingWrapper = mountDirectory({
      employees: [],
      employeesLoading: true,
    })
    const emptyWrapper = mountDirectory({
      employees: [],
      employeesLoading: false,
    })

    expect(loadingWrapper.text()).toContain('Loading employees...')
    expect(loadingWrapper.find('[data-testid="employee-row-employee-1"]').exists()).toBe(false)
    expect(emptyWrapper.text()).toContain('No employees match your search.')
  })
})
