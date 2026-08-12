import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardPageMessages from '@/components/timecards/TimecardPageMessages.vue'

describe('TimecardPageMessages', () => {
  it('renders an error alert before informational copy', () => {
    const wrapper = mount(TimecardPageMessages, {
      props: {
        error: 'Could not save timecards.',
        info: 'Timecards saved.',
      },
    })

    const message = wrapper.get('.timecard-page-message')

    expect(message.text()).toBe('Could not save timecards.')
    expect(message.attributes('role')).toBe('alert')
    expect(message.classes()).toContain('timecard-page-message--error')
  })

  it('renders informational copy when no error is present', () => {
    const wrapper = mount(TimecardPageMessages, {
      props: {
        info: 'Timecards saved.',
      },
    })

    const message = wrapper.get('.timecard-page-message')

    expect(message.text()).toBe('Timecards saved.')
    expect(message.attributes('role')).toBe('status')
    expect(message.classes()).not.toContain('timecard-page-message--error')
  })

  it('renders nothing when there are no messages', () => {
    const wrapper = mount(TimecardPageMessages)

    expect(wrapper.find('.timecard-page-message').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})
