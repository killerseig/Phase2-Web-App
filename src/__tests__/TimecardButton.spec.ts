import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardButton from '@/components/timecards/TimecardButton.vue'

describe('TimecardButton', () => {
  it('renders a button with default type, slot content, and forwarded attributes', () => {
    const wrapper = mount(TimecardButton, {
      attrs: {
        disabled: true,
        'data-testid': 'timecard-action',
        class: 'custom-action',
      },
      slots: {
        default: 'Create Week',
      },
    })
    const button = wrapper.get<HTMLButtonElement>('button')

    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toBe('Create Week')
    expect(button.attributes('data-testid')).toBe('timecard-action')
    expect(button.element.disabled).toBe(true)
    expect(button.classes()).toEqual(
      expect.arrayContaining(['timecards-button', 'custom-action']),
    )
    expect(button.classes()).not.toContain('timecards-button--primary')
  })

  it('supports submit/reset types and the primary variant', () => {
    const submitWrapper = mount(TimecardButton, {
      props: {
        type: 'submit',
        variant: 'primary',
      },
      slots: {
        default: 'Submit Week',
      },
    })
    const resetWrapper = mount(TimecardButton, {
      props: {
        type: 'reset',
      },
    })

    expect(submitWrapper.get('button').attributes('type')).toBe('submit')
    expect(submitWrapper.get('button').classes()).toContain('timecards-button--primary')
    expect(resetWrapper.get('button').attributes('type')).toBe('reset')
  })
})
