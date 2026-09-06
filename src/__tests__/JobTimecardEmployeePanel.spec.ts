import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardEmployeePanel from '@/components/timecards/JobTimecardEmployeePanel.vue'
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
]

const EmployeePickerStub = {
  props: ['search', 'employees', 'loading', 'searchDisabled', 'employeeDisabled', 'testIdPrefix'],
  emits: ['updateSearch', 'addEmployee'],
  template: `
    <div data-testid="employee-picker" :data-prefix="testIdPrefix">
      <input
        :value="search"
        :disabled="searchDisabled"
        @input="$emit('updateSearch', $event.target.value)"
      />
      <button
        type="button"
        :disabled="employeeDisabled"
        @click="$emit('addEmployee', employees[0])"
      >
        Add {{ employees[0]?.firstName }}
      </button>
      <span v-if="loading">Loading</span>
    </div>
  `,
}

function mountPanel(overrides = {}) {
  return mount(JobTimecardEmployeePanel, {
    props: {
      search: 'cj',
      employees,
      loading: false,
      disabled: false,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardEmployeePicker: EmployeePickerStub,
      },
    },
  })
}

describe('JobTimecardEmployeePanel', () => {
  it('renders job employee-directory copy and forwards picker state', () => {
    const wrapper = mountPanel({ disabled: true })

    expect(wrapper.text()).toContain('Employee Directory')
    expect(wrapper.text()).toContain('Create From Employee')
    expect(wrapper.get('[data-testid="employee-picker"]').attributes('data-prefix')).toBe('timecards-add-employee-')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('cj')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="employee-picker"] button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="timecards-show-one-off-card"]').attributes('disabled')).toBeDefined()
  })

  it('emits picker actions and the one-off request', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input').setValue('vince')
    await wrapper.get('[data-testid="employee-picker"] button').trigger('click')
    await wrapper.get('[data-testid="timecards-show-one-off-card"]').trigger('click')

    expect(wrapper.emitted('updateSearch')?.[0]).toEqual(['vince'])
    expect(wrapper.emitted('addEmployee')?.[0]).toEqual([employees[0]])
    expect(wrapper.emitted('createOneOffCard')).toHaveLength(1)
  })

  it('passes loading state to the picker', () => {
    const wrapper = mountPanel({ loading: true })

    expect(wrapper.text()).toContain('Loading')
  })
})
