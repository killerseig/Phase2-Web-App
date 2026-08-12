import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppLoadingButton from '@/components/common/AppLoadingButton.vue'

describe('AppLoadingButton', () => {
  it('renders the normal label with the base button class and safe button type by default', () => {
    const wrapper = mount(AppLoadingButton, {
      props: {
        label: 'Create Job',
      },
    })
    const button = wrapper.get<HTMLButtonElement>('button')

    expect(button.text()).toBe('Create Job')
    expect(button.classes()).toContain('app-button')
    expect(button.classes()).not.toContain('app-loading-button--loading')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-busy')).toBe('false')
    expect(button.element.disabled).toBe(false)
  })

  it('renders loading copy, aria-busy, loading class, and disables the button while loading', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppLoadingButton, {
      props: {
        label: 'Login',
        loadingLabel: 'Signing In...',
        loading: true,
      },
      attrs: {
        onClick: handleClick,
      },
    })
    const button = wrapper.get<HTMLButtonElement>('button')

    expect(button.text()).toBe('Signing In...')
    expect(button.classes()).toEqual(
      expect.arrayContaining(['app-button', 'app-loading-button--loading']),
    )
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.element.disabled).toBe(true)

    await button.trigger('click')
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('falls back to the normal label when no loading label is provided', () => {
    const wrapper = mount(AppLoadingButton, {
      props: {
        label: 'Save',
        loading: true,
      },
    })

    expect(wrapper.get('button').text()).toBe('Save')
  })

  it.each(['primary', 'success', 'danger', 'ghost'] as const)('applies the %s variant class', (variant) => {
    const wrapper = mount(AppLoadingButton, {
      props: {
        label: `${variant} action`,
        variant,
      },
    })

    expect(wrapper.get('button').classes()).toEqual(
      expect.arrayContaining(['app-button', `app-button--${variant}`]),
    )
  })

  it('supports disabled state, explicit button type, attrs, custom classes, and click passthrough', async () => {
    const disabledClick = vi.fn()
    const disabledWrapper = mount(AppLoadingButton, {
      props: {
        label: 'Create Job',
        disabled: true,
        type: 'submit',
        variant: 'primary',
      },
      attrs: {
        class: 'jobs-create-action',
        'data-testid': 'jobs-create-button',
        'aria-label': 'Create job',
        onClick: disabledClick,
      },
    })
    const disabledButton = disabledWrapper.get<HTMLButtonElement>('[data-testid="jobs-create-button"]')

    expect(disabledButton.classes()).toEqual(
      expect.arrayContaining(['app-button', 'app-button--primary', 'jobs-create-action']),
    )
    expect(disabledButton.attributes('type')).toBe('submit')
    expect(disabledButton.attributes('aria-label')).toBe('Create job')
    expect(disabledButton.element.disabled).toBe(true)

    await disabledButton.trigger('click')
    expect(disabledClick).not.toHaveBeenCalled()

    const enabledClick = vi.fn()
    const enabledWrapper = mount(AppLoadingButton, {
      props: {
        label: 'Archive',
        type: 'reset',
      },
      attrs: {
        onClick: enabledClick,
      },
    })

    expect(enabledWrapper.get('button').attributes('type')).toBe('reset')
    await enabledWrapper.get('button').trigger('click')
    expect(enabledClick).toHaveBeenCalledTimes(1)
  })

  it('allows slot content to override label text while preserving loading state behavior', () => {
    const wrapper = mount(AppLoadingButton, {
      props: {
        label: 'Ignored label',
        loadingLabel: 'Ignored loading label',
        loading: true,
      },
      slots: {
        default: '<span>Custom Button Content</span>',
      },
    })
    const button = wrapper.get<HTMLButtonElement>('button')

    expect(button.text()).toBe('Custom Button Content')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.element.disabled).toBe(true)
    expect(button.classes()).toContain('app-loading-button--loading')
  })
})
