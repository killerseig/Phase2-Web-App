import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppBadge from '@/components/common/AppBadge.vue'

describe('AppBadge', () => {
  it('renders slot content with the default badge tone', () => {
    const wrapper = mount(AppBadge, {
      slots: {
        default: 'Active',
      },
    })
    const badge = wrapper.get('span')

    expect(badge.text()).toBe('Active')
    expect(badge.classes()).toEqual(expect.arrayContaining(['app-badge', 'app-badge--default']))
  })

  it.each(['accent', 'success', 'danger', 'warning'] as const)(
    'applies the %s tone class',
    (tone) => {
      const wrapper = mount(AppBadge, {
        props: {
          tone,
        },
        slots: {
          default: tone,
        },
      })

      expect(wrapper.get('span').classes()).toEqual(
        expect.arrayContaining(['app-badge', `app-badge--${tone}`]),
      )
    },
  )

  it('passes attrs through and merges custom classes', () => {
    const wrapper = mount(AppBadge, {
      attrs: {
        class: 'employee-status',
        'data-testid': 'status-badge',
        title: 'Employee status',
      },
      slots: {
        default: 'Inactive',
      },
    })
    const badge = wrapper.get('[data-testid="status-badge"]')

    expect(badge.classes()).toEqual(expect.arrayContaining(['app-badge', 'employee-status']))
    expect(badge.attributes('title')).toBe('Employee status')
  })
})
