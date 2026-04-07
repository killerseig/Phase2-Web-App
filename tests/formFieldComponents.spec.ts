import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDetailField from '@/components/common/AppDetailField.vue'
import BaseCheckboxField from '@/components/common/BaseCheckboxField.vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BasePasswordField from '@/components/common/BasePasswordField.vue'
import BaseSearchField from '@/components/common/BaseSearchField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import BaseTableCellInput from '@/components/common/BaseTableCellInput.vue'
import BaseTextareaField from '@/components/common/BaseTextareaField.vue'

describe('form field components', () => {
  it('keeps the same detail field shell in read and edit modes', async () => {
    const wrapper = mount(AppDetailField, {
      props: {
        editing: false,
        label: 'First Name',
        modelValue: 'Casey',
      },
    })

    expect(wrapper.find('.app-detail-field__label').text()).toBe('First Name')
    expect(wrapper.find('.app-detail-field__value').text()).toBe('Casey')

    await wrapper.setProps({ editing: true })
    await wrapper.get('input').setValue('Jordan')

    expect(wrapper.find('.app-detail-field__label').text()).toBe('First Name')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Jordan']])
  })

  it('renders field shell labels and helper text', () => {
    const wrapper = mount(BaseFieldShell, {
      props: {
        id: 'field-1',
        label: 'Project Name',
        required: true,
        helperText: 'Used for display only',
      },
      slots: {
        default: '<input id="field-1" />',
      },
    })

    expect(wrapper.find('label').text()).toContain('Project Name')
    expect(wrapper.find('.text-danger').text()).toContain('*')
    expect(wrapper.find('.form-text').text()).toContain('Used for display only')
  })

  it('emits updates from shared checkbox fields', async () => {
    const wrapper = mount(BaseCheckboxField, {
      props: {
        id: 'week-range',
        modelValue: false,
        label: 'Use week range',
        variant: 'switch',
      },
    })

    await wrapper.get('#week-range').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('emits updates from shared input fields', async () => {
    const wrapper = mount(BaseInputField, {
      props: {
        id: 'employee-number',
        modelValue: '',
        label: 'Employee Number',
      },
    })

    await wrapper.get('#employee-number').setValue('1234')

    expect(wrapper.emitted('update:modelValue')).toEqual([['1234']])
    expect(wrapper.emitted('input')).toHaveLength(1)
  })

  it('emits updates from shared textarea fields', async () => {
    const wrapper = mount(BaseTextareaField, {
      props: {
        id: 'notes',
        modelValue: '',
        label: 'Notes',
      },
    })

    await wrapper.get('#notes').setValue('Looks good')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Looks good']])
    expect(wrapper.emitted('input')).toHaveLength(1)
  })

  it('emits typed option values from shared select fields', async () => {
    const wrapper = mount(BaseSelectField, {
      props: {
        id: 'subcontracted',
        modelValue: 'no',
        label: 'Subcontracted Employee',
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ],
      },
    })

    await wrapper.get('#subcontracted').setValue('yes')

    expect(wrapper.emitted('update:modelValue')).toEqual([['yes']])
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('renders clearable shared search fields', async () => {
    const wrapper = mount(BaseSearchField, {
      props: {
        id: 'catalog-search',
        modelValue: 'gloves',
        placeholder: 'Search catalog',
        clearable: true,
      },
    })

    expect(wrapper.get('#catalog-search').element).toBeTruthy()
    expect(wrapper.find('.input-group-text .bi.bi-search').exists()).toBe(true)

    await wrapper.get('button.btn.btn-outline-secondary').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('toggles visibility in shared password fields', async () => {
    const wrapper = mount(BasePasswordField, {
      props: {
        id: 'password-field',
        modelValue: '',
        label: 'Password',
      },
    })

    expect(wrapper.get('#password-field').attributes('type')).toBe('password')

    await wrapper.get('button.app-password-field__toggle').trigger('click')

    expect(wrapper.get('#password-field').attributes('type')).toBe('text')
    expect(wrapper.emitted('toggle-visibility')).toEqual([[true]])
  })

  it('emits updates and focus events from dense table cell inputs', async () => {
    const wrapper = mount(BaseTableCellInput, {
      props: {
        modelValue: '8',
        type: 'number',
        selectOnFocus: true,
      },
      attrs: {
        placeholder: '0',
        'aria-label': 'Hours',
      },
    })

    const input = wrapper.get('input')
    await input.setValue('12')
    await input.trigger('focus')

    expect(input.attributes('placeholder')).toBe('0')
    expect(input.attributes('aria-label')).toBe('Hours')
    expect(wrapper.emitted('update:modelValue')).toEqual([['12']])
    expect(wrapper.emitted('focus')).toHaveLength(1)
  })
})
