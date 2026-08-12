import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppSearchInput from '@/components/common/AppSearchInput.vue'

describe('AppSearchInput', () => {
  it('renders a search input with the current value and default accessible label', () => {
    const wrapper = mount(AppSearchInput, {
      props: {
        modelValue: 'li',
        placeholder: 'Find catalog entries',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    expect(input.classes()).toContain('app-search-input')
    expect(input.attributes('type')).toBe('search')
    expect(input.element.value).toBe('li')
    expect(input.attributes('placeholder')).toBe('Find catalog entries')
    expect(input.attributes('aria-label')).toBe('Find catalog entries')
  })

  it('uses an explicit aria label when provided', () => {
    const wrapper = mount(AppSearchInput, {
      props: {
        modelValue: '',
        placeholder: 'Search',
        ariaLabel: 'Search active employees',
      },
    })

    expect(wrapper.get('input').attributes('aria-label')).toBe('Search active employees')
  })

  it('emits model updates from native input changes', async () => {
    const wrapper = mount(AppSearchInput, {
      props: {
        modelValue: '',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    await input.setValue('foreman')

    expect(wrapper.emitted('update:modelValue')).toEqual([['foreman']])
  })

  it('passes attrs through and merges custom classes on the underlying input', () => {
    const wrapper = mount(AppSearchInput, {
      props: {
        modelValue: 'shop',
      },
      attrs: {
        class: 'shop-catalog-search',
        disabled: true,
        'data-testid': 'catalog-search',
        autocomplete: 'off',
      },
    })
    const input = wrapper.get<HTMLInputElement>('[data-testid="catalog-search"]')

    expect(input.classes()).toEqual(
      expect.arrayContaining(['app-search-input', 'shop-catalog-search']),
    )
    expect(input.element.disabled).toBe(true)
    expect(input.attributes('autocomplete')).toBe('off')
  })
})
