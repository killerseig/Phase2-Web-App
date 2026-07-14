import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppEmptyState from '@/components/common/AppEmptyState.vue'

describe('AppEmptyState', () => {
  it('renders optional title and message props', () => {
    const wrapper = mount(AppEmptyState, {
      props: {
        message: 'No records match this view.',
        title: 'Nothing here yet',
      },
    })

    expect(wrapper.text()).toContain('Nothing here yet')
    expect(wrapper.text()).toContain('No records match this view.')
  })

  it('renders slot content when no message is provided', () => {
    const wrapper = mount(AppEmptyState, {
      slots: {
        default: '<button type="button">Create one</button>',
      },
    })

    expect(wrapper.get('button').text()).toBe('Create one')
  })
})
