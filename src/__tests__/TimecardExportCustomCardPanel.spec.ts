import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportCustomCardPanel from '@/components/timecards/TimecardExportCustomCardPanel.vue'

const CustomCardFieldsStub = {
  props: [
    'firstName',
    'lastName',
    'employeeNumber',
    'occupation',
    'wageRate',
    'isContractor',
    'disabled',
  ],
  emits: [
    'updateFirstName',
    'updateLastName',
    'updateEmployeeNumber',
    'updateOccupation',
    'updateWageRate',
    'updateIsContractor',
  ],
  template: `
    <div data-testid="custom-fields">
      <input :value="firstName" :disabled="disabled" @input="$emit('updateFirstName', $event.target.value)" />
      <input :value="lastName" @input="$emit('updateLastName', $event.target.value)" />
      <input :value="employeeNumber" @input="$emit('updateEmployeeNumber', $event.target.value)" />
      <input :value="occupation" @input="$emit('updateOccupation', $event.target.value)" />
      <input :value="wageRate" @input="$emit('updateWageRate', $event.target.value)" />
      <input type="checkbox" :checked="isContractor" @change="$emit('updateIsContractor', $event.target.checked)" />
    </div>
  `,
}

const TimecardButtonStub = {
  props: ['disabled', 'variant'],
  emits: ['click'],
  template: `
    <button
      type="button"
      :disabled="disabled"
      :data-variant="variant"
      @click="$emit('click')"
    >
      <slot />
    </button>
  `,
}

function mountPanel(overrides = {}) {
  return mount(TimecardExportCustomCardPanel, {
    props: {
      firstName: 'Chris',
      lastName: 'Larsen',
      employeeNumber: 'A1',
      occupation: 'Foreman',
      wageRate: '42.50',
      isContractor: false,
      disabled: false,
      addDisabled: false,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardCustomCardFields: CustomCardFieldsStub,
        TimecardButton: TimecardButtonStub,
      },
    },
  })
}

describe('TimecardExportCustomCardPanel', () => {
  it('renders custom-card copy and forwards field state', () => {
    const wrapper = mountPanel({ disabled: true, addDisabled: true })
    const inputs = wrapper.findAll('input')
    const addButton = wrapper.get('[data-testid="timecards-add-one-off-card"]')

    expect(wrapper.get('legend').text()).toBe('One-Off Card')
    expect(wrapper.text()).toContain('Create a One-Off Card')
    expect(wrapper.text()).toContain('Use a one-off card only when the worker is not available in the employee list.')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Chris')
    expect(inputs[0]!.attributes('disabled')).toBeDefined()
    expect(addButton.text()).toBe('Add One-Off Card')
    expect(addButton.attributes('disabled')).toBeDefined()
    expect(addButton.attributes('data-variant')).toBe('primary')
  })

  it('emits custom-card field updates', async () => {
    const wrapper = mountPanel()
    const inputs = wrapper.findAll('input')

    await inputs[0]!.setValue('CJ')
    await inputs[1]!.setValue('Blanchard')
    await inputs[2]!.setValue('5133')
    await inputs[3]!.setValue('Shop Foreman')
    await inputs[4]!.setValue('50.25')
    await inputs[5]!.setValue(true)

    expect(wrapper.emitted('updateFirstName')?.[0]).toEqual(['CJ'])
    expect(wrapper.emitted('updateLastName')?.[0]).toEqual(['Blanchard'])
    expect(wrapper.emitted('updateEmployeeNumber')?.[0]).toEqual(['5133'])
    expect(wrapper.emitted('updateOccupation')?.[0]).toEqual(['Shop Foreman'])
    expect(wrapper.emitted('updateWageRate')?.[0]).toEqual(['50.25'])
    expect(wrapper.emitted('updateIsContractor')?.[0]).toEqual([true])
  })

  it('emits the add custom card action', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="timecards-add-one-off-card"]').trigger('click')

    expect(wrapper.emitted('addCustomCard')).toHaveLength(1)
  })

  it('provides a route back to employee search', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="timecards-back-to-employee-search"]').trigger('click')

    expect(wrapper.emitted('backToEmployeeSearch')).toHaveLength(1)
  })
})
