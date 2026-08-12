import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardCustomCardFields from '@/components/timecards/TimecardCustomCardFields.vue'

function mountFields(disabled = false) {
  return mount(TimecardCustomCardFields, {
    props: {
      firstName: 'Chris',
      lastName: 'Larsen',
      employeeNumber: 'A1',
      occupation: 'Foreman',
      wageRate: '42.50',
      isContractor: false,
      disabled,
    },
  })
}

describe('TimecardCustomCardFields', () => {
  it('renders the shared custom-card field values', () => {
    const wrapper = mountFields()
    const inputs = wrapper.findAll('input')

    expect(inputs).toHaveLength(6)
    expect(inputs[0]!.element.value).toBe('Chris')
    expect(inputs[1]!.element.value).toBe('Larsen')
    expect(inputs[2]!.element.value).toBe('A1')
    expect(inputs[3]!.element.value).toBe('Foreman')
    expect(inputs[4]!.element.value).toBe('42.50')
    expect(inputs[4]!.attributes('type')).toBe('number')
    expect((inputs[5]!.element as HTMLInputElement).checked).toBe(false)
  })

  it('emits typed field updates', async () => {
    const wrapper = mountFields()
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

  it('disables every field when parent actions are unavailable', () => {
    const wrapper = mountFields(true)

    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })
})
