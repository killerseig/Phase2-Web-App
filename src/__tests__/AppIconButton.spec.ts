import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppIconButton from '@/components/common/AppIconButton.vue'

describe('AppIconButton', () => {
  it('renders slot content with an accessible label, title fallback, and safe button type', () => {
    const wrapper = mount(AppIconButton, {
      props: {
        label: 'Remove row',
      },
      slots: {
        default: 'X',
      },
    })
    const button = wrapper.get('button')

    expect(button.text()).toBe('X')
    expect(button.classes()).toContain('app-icon-button')
    expect(button.classes()).not.toContain('app-icon-button--danger')
    expect(button.attributes('aria-label')).toBe('Remove row')
    expect(button.attributes('title')).toBe('Remove row')
    expect(button.attributes('type')).toBe('button')
  })

  it.each(['success', 'danger'] as const)('applies the %s variant class', (variant) => {
    const wrapper = mount(AppIconButton, {
      props: {
        label: `${variant} row action`,
        variant,
      },
      slots: {
        default: variant === 'success' ? '+' : 'X',
      },
    })

    expect(wrapper.get('button').classes()).toEqual(
      expect.arrayContaining(['app-icon-button', `app-icon-button--${variant}`]),
    )
  })

  it('uses an explicit title when provided and supports submit/reset types', () => {
    const submitWrapper = mount(AppIconButton, {
      props: {
        label: 'Add manpower row',
        title: 'Add another manpower row',
        type: 'submit',
      },
    })
    const resetWrapper = mount(AppIconButton, {
      props: {
        label: 'Reset rows',
        type: 'reset',
      },
    })

    expect(submitWrapper.get('button').attributes('title')).toBe('Add another manpower row')
    expect(submitWrapper.get('button').attributes('type')).toBe('submit')
    expect(resetWrapper.get('button').attributes('type')).toBe('reset')
  })

  it('passes attrs through, merges custom classes, and respects disabled buttons', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppIconButton, {
      props: {
        label: 'Remove recipient',
        variant: 'danger',
      },
      attrs: {
        class: 'recipient-editor__remove',
        disabled: true,
        'data-testid': 'remove-recipient',
        onClick: handleClick,
      },
      slots: {
        default: 'X',
      },
    })
    const button = wrapper.get<HTMLButtonElement>('[data-testid="remove-recipient"]')

    expect(button.classes()).toEqual(
      expect.arrayContaining([
        'app-icon-button',
        'app-icon-button--danger',
        'recipient-editor__remove',
      ]),
    )
    expect(button.element.disabled).toBe(true)

    await button.trigger('click')
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('passes native click handlers through when enabled', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppIconButton, {
      props: {
        label: 'Add row',
        variant: 'success',
      },
      attrs: {
        onClick: handleClick,
      },
      slots: {
        default: '+',
      },
    })

    await wrapper.get('button').trigger('click')
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
