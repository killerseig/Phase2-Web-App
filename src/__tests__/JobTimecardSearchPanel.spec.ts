import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardSearchPanel from '@/components/timecards/JobTimecardSearchPanel.vue'

const SearchInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: `
    <input
      type="search"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
}

function mountPanel(overrides = {}) {
  return mount(JobTimecardSearchPanel, {
    props: {
      cardSearchTerm: 'cj',
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        AppSearchInput: SearchInputStub,
      },
    },
  })
}

describe('JobTimecardSearchPanel', () => {
  it('renders card filter copy and forwards the search value to the input', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Card Filters')
    expect(wrapper.text()).toContain('Employee Search')
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('cj')
    expect(wrapper.get('input[type="search"]').attributes('placeholder')).toBe('Search all cards')
  })

  it('emits search term updates', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input[type="search"]').setValue('vince')

    expect(wrapper.emitted('updateCardSearchTerm')?.[0]).toEqual(['vince'])
  })
})
