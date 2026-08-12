import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppButton from '@/components/common/AppButton.vue'

describe('AppButton', () => {
  it('renders slot content with the base app button class and safe button type by default', () => {
    const wrapper = mount(AppButton, {
      slots: {
        default: 'Create Job',
      },
    })
    const button = wrapper.get('button')

    expect(button.text()).toBe('Create Job')
    expect(button.classes()).toContain('app-button')
    expect(button.classes()).not.toContain('app-button--primary')
    expect(button.attributes('type')).toBe('button')
  })

  it.each(['primary', 'success', 'danger', 'ghost'] as const)(
    'applies the %s variant class',
    (variant) => {
      const wrapper = mount(AppButton, {
        props: {
          variant,
        },
        slots: {
          default: `${variant} action`,
        },
      })

      expect(wrapper.get('button').classes()).toEqual(
        expect.arrayContaining(['app-button', `app-button--${variant}`]),
      )
    },
  )

  it('supports explicit submit and reset button types', () => {
    const submitWrapper = mount(AppButton, {
      props: {
        type: 'submit',
      },
    })
    const resetWrapper = mount(AppButton, {
      props: {
        type: 'reset',
      },
    })

    expect(submitWrapper.get('button').attributes('type')).toBe('submit')
    expect(resetWrapper.get('button').attributes('type')).toBe('reset')
  })

  it('passes through attrs, merges custom classes, and respects disabled buttons', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppButton, {
      attrs: {
        class: 'jobs-create-action',
        disabled: true,
        'aria-label': 'Create a job',
        'data-testid': 'create-job-button',
        onClick: handleClick,
      },
      slots: {
        default: 'Create',
      },
    })
    const button = wrapper.get<HTMLButtonElement>('[data-testid="create-job-button"]')

    expect(button.classes()).toEqual(expect.arrayContaining(['app-button', 'jobs-create-action']))
    expect(button.attributes('aria-label')).toBe('Create a job')
    expect(button.element.disabled).toBe(true)

    await button.trigger('click')
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('passes native click handlers through to the underlying button', async () => {
    const handleClick = vi.fn()
    const wrapper = mount(AppButton, {
      attrs: {
        onClick: handleClick,
      },
    })

    await wrapper.get('button').trigger('click')
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
