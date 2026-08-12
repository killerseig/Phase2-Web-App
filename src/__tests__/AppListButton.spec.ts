import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppListButton from '@/components/common/AppListButton.vue'

describe('AppListButton', () => {
  it('renders slot content with the base row button class and safe button type by default', () => {
    const wrapper = mount(AppListButton, {
      slots: {
        default: '<strong>Shop</strong><span>Job #736</span>',
      },
    })
    const button = wrapper.get('button')

    expect(button.text()).toContain('Shop')
    expect(button.text()).toContain('Job #736')
    expect(button.classes()).toContain('app-list-button')
    expect(button.classes()).not.toContain('app-list-button--active')
    expect(button.classes()).not.toContain('app-list-button--dashed')
    expect(button.attributes('type')).toBe('button')
  })

  it('applies active and dashed state classes', () => {
    const wrapper = mount(AppListButton, {
      props: {
        active: true,
        variant: 'dashed',
      },
    })

    expect(wrapper.get('button').classes()).toEqual(
      expect.arrayContaining([
        'app-list-button',
        'app-list-button--active',
        'app-list-button--dashed',
      ]),
    )
  })

  it('supports explicit submit and reset button types', () => {
    const submitWrapper = mount(AppListButton, {
      props: {
        type: 'submit',
      },
    })
    const resetWrapper = mount(AppListButton, {
      props: {
        type: 'reset',
      },
    })

    expect(submitWrapper.get('button').attributes('type')).toBe('submit')
    expect(resetWrapper.get('button').attributes('type')).toBe('reset')
  })

  it('passes through attrs, merges custom classes, and respects disabled buttons', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppListButton, {
      props: {
        active: true,
      },
      attrs: {
        class: 'jobs-browser__row',
        disabled: true,
        'data-testid': 'job-row',
        'aria-label': 'Select Shop job',
        onClick: handleClick,
      },
      slots: {
        default: 'Shop',
      },
    })
    const button = wrapper.get<HTMLButtonElement>('[data-testid="job-row"]')

    expect(button.classes()).toEqual(
      expect.arrayContaining(['app-list-button', 'app-list-button--active', 'jobs-browser__row']),
    )
    expect(button.attributes('aria-label')).toBe('Select Shop job')
    expect(button.element.disabled).toBe(true)

    await button.trigger('click')
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('passes native click handlers through when enabled', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppListButton, {
      attrs: {
        onClick: handleClick,
      },
      slots: {
        default: 'Select row',
      },
    })

    await wrapper.get('button').trigger('click')
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
