import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportEmployeePanel from '@/components/timecards/TimecardExportEmployeePanel.vue'
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
  props: ['search', 'employees', 'loading', 'searchDisabled', 'employeeDisabled'],
  emits: ['updateSearch', 'addEmployee'],
  template: `
    <div data-testid="employee-picker">
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
  return mount(TimecardExportEmployeePanel, {
    props: {
      search: 'cj',
      employees,
      loading: false,
      searchDisabled: false,
      employeeDisabled: false,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardEmployeePicker: EmployeePickerStub,
      },
    },
  })
}

describe('TimecardExportEmployeePanel', () => {
  it('renders employee-directory copy and forwards picker state', () => {
    const wrapper = mountPanel({
      searchDisabled: true,
      employeeDisabled: true,
    })

    expect(wrapper.get('legend').text()).toBe('Employee Directory')
    expect(wrapper.text()).toContain('Create From Employee')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('cj')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('emits picker search and employee add events', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input').setValue('vince')
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('updateSearch')?.[0]).toEqual(['vince'])
    expect(wrapper.emitted('addEmployee')?.[0]).toEqual([employees[0]])
  })

  it('passes loading state to the picker', () => {
    const wrapper = mountPanel({ loading: true })

    expect(wrapper.text()).toContain('Loading')
  })
})
