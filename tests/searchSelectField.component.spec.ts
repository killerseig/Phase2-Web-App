import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchSelectField from '@/components/common/SearchSelectField.vue'

const options = [
  { id: 'job-1', label: '001 - Alpha' },
  { id: 'job-2', label: '002 - Bravo' },
]

describe('search select field', () => {
  it('shows the selected option label in the input', () => {
    const wrapper = mount(SearchSelectField, {
      props: {
        modelValue: 'job-2',
        options,
        label: 'Job',
      },
    })

    expect(wrapper.find('input').element.value).toBe('002 - Bravo')
  })

  it('emits the first filtered option when enter is pressed', async () => {
    const wrapper = mount(SearchSelectField, {
      props: {
        modelValue: '',
        options,
        label: 'Job',
      },
    })

    const input = wrapper.find('input')
    await input.setValue('alp')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['job-1']])
  })

  it('emits an empty value when clearing the current selection', async () => {
    const wrapper = mount(SearchSelectField, {
      props: {
        modelValue: 'job-1',
        options,
        label: 'Job',
      },
    })

    await wrapper.find('button[aria-label="Clear selection"]').trigger('mousedown')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
  })
})
