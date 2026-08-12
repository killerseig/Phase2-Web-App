import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardSortModePicker from '@/components/timecards/TimecardSortModePicker.vue'

function mountPicker(overrides = {}) {
  return mount(TimecardSortModePicker, {
    props: {
      modelValue: 'name',
      name: 'job-card-sort',
      ...overrides,
    },
  })
}

describe('TimecardSortModePicker', () => {
  it('renders Employee# and Name radio options with the provided name', () => {
    const wrapper = mountPicker()
    const inputs = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    const numberInput = wrapper.get<HTMLInputElement>('input[value="number"]')
    const nameInput = wrapper.get<HTMLInputElement>('input[value="name"]')

    expect(wrapper.text()).toContain('Employee#')
    expect(wrapper.text()).toContain('Name')
    expect(inputs).toHaveLength(2)
    expect(numberInput.attributes('name')).toBe('job-card-sort')
    expect(numberInput.element.checked).toBe(false)
    expect(nameInput.attributes('name')).toBe('job-card-sort')
    expect(nameInput.element.checked).toBe(true)
  })

  it('checks Employee# when number sorting is selected', () => {
    const wrapper = mountPicker({ modelValue: 'number' })
    const numberInput = wrapper.get<HTMLInputElement>('input[value="number"]')
    const nameInput = wrapper.get<HTMLInputElement>('input[value="name"]')

    expect(numberInput.element.checked).toBe(true)
    expect(nameInput.element.checked).toBe(false)
  })

  it('emits model updates when radio options change', async () => {
    const wrapper = mountPicker()
    const numberInput = wrapper.get<HTMLInputElement>('input[value="number"]')
    const nameInput = wrapper.get<HTMLInputElement>('input[value="name"]')

    await numberInput.trigger('change')
    await nameInput.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([['number'], ['name']])
  })
})
