import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardPageMessage from '@/components/timecards/TimecardPageMessage.vue'

describe('TimecardPageMessage', () => {
  it('renders a default status message', () => {
    const wrapper = mount(TimecardPageMessage, {
      props: {
        message: 'Timecards saved.',
      },
    })
    const message = wrapper.get('.timecard-page-message')

    expect(message.text()).toBe('Timecards saved.')
    expect(message.attributes('role')).toBe('status')
    expect(message.classes()).not.toContain('timecard-page-message--error')
  })

  it('renders error messages as alerts with the error tone class', () => {
    const wrapper = mount(TimecardPageMessage, {
      props: {
        message: 'Could not save timecards.',
        tone: 'error',
      },
    })
    const message = wrapper.get('.timecard-page-message')

    expect(message.text()).toBe('Could not save timecards.')
    expect(message.attributes('role')).toBe('alert')
    expect(message.classes()).toContain('timecard-page-message--error')
  })

  it('renders nothing for an empty message', () => {
    const wrapper = mount(TimecardPageMessage, {
      props: {
        message: '',
      },
    })

    expect(wrapper.find('.timecard-page-message').exists()).toBe(false)
  })
})
