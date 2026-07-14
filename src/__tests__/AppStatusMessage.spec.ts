import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppStatusMessage from '@/components/common/AppStatusMessage.vue'

describe('AppStatusMessage', () => {
  it('renders message props as a status by default', () => {
    const wrapper = mount(AppStatusMessage, {
      props: {
        message: 'Saved successfully.',
      },
    })

    expect(wrapper.text()).toBe('Saved successfully.')
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.classes()).toContain('app-status-message--default')
  })

  it('renders slotted error content as an alert', () => {
    const wrapper = mount(AppStatusMessage, {
      props: {
        tone: 'error',
      },
      slots: {
        default: 'Something went wrong.',
      },
    })

    expect(wrapper.text()).toBe('Something went wrong.')
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.classes()).toContain('app-status-message--error')
  })

  it('does not render when empty', () => {
    const wrapper = mount(AppStatusMessage)

    expect(wrapper.find('.app-status-message').exists()).toBe(false)
  })
})
