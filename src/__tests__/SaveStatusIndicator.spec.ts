import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SaveStatusIndicator from '@/components/common/SaveStatusIndicator.vue'

describe('SaveStatusIndicator', () => {
  it('does not render when idle without a message', () => {
    const wrapper = mount(SaveStatusIndicator)

    expect(wrapper.find('.save-status-indicator').exists()).toBe(false)
  })

  it('renders the saving message with default status tone', () => {
    const wrapper = mount(SaveStatusIndicator, {
      props: {
        saving: true,
      },
    })

    expect(wrapper.text()).toBe('Saving changes...')
    expect(wrapper.get('.save-status-indicator').attributes('role')).toBe('status')
    expect(wrapper.get('.save-status-indicator').classes()).toContain('app-status-message--default')
  })

  it('renders the saved message with success tone', () => {
    const wrapper = mount(SaveStatusIndicator, {
      props: {
        message: 'All changes saved.',
      },
    })

    expect(wrapper.text()).toBe('All changes saved.')
    expect(wrapper.get('.save-status-indicator').classes()).toContain('app-status-message--success')
  })

  it('supports custom idle and saving messages while preserving slot overrides', () => {
    const wrapper = mount(SaveStatusIndicator, {
      props: {
        idleMessage: 'Changes save automatically.',
        saving: true,
        savingMessage: 'Saving...',
      },
      slots: {
        default: ({ message, saving }: { message: string; saving: boolean }) => (
          saving ? 'Busy' : message
        ),
      },
    })

    expect(wrapper.text()).toBe('Busy')
    expect(wrapper.get('.save-status-indicator').classes()).toContain('app-status-message--default')
  })
})
