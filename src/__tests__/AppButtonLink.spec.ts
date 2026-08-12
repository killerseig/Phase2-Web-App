import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppButtonLink from '@/components/common/AppButtonLink.vue'

const routerLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a><slot /></a>',
}

function mountLink(overrides = {}) {
  return mount(AppButtonLink, {
    props: {
      to: '/jobs',
      ...overrides,
    },
    global: {
      stubs: {
        RouterLink: routerLinkStub,
      },
    },
    slots: {
      default: 'Back to Jobs',
    },
  })
}

describe('AppButtonLink', () => {
  it('renders slot content as a button-styled router link', () => {
    const wrapper = mountLink()
    const link = wrapper.get('a')

    expect(link.text()).toBe('Back to Jobs')
    expect(link.classes()).toContain('app-button')
    expect(link.classes()).not.toContain('app-button--primary')
    expect(wrapper.getComponent(routerLinkStub).props('to')).toBe('/jobs')
  })

  it.each(['primary', 'success', 'danger', 'ghost'] as const)(
    'applies the %s variant class',
    (variant) => {
      const wrapper = mountLink({
        variant,
      })

      expect(wrapper.get('a').classes()).toEqual(
        expect.arrayContaining(['app-button', `app-button--${variant}`]),
      )
    },
  )

  it('passes route location objects through to RouterLink', () => {
    const to = {
      name: 'job-dashboard',
      params: {
        jobId: 'job-5229',
      },
      query: {
        tab: 'timecards',
      },
    }
    const wrapper = mountLink({
      to,
    })

    expect(wrapper.getComponent(routerLinkStub).props('to')).toEqual(to)
  })

  it('passes attrs through and merges custom classes with button classes', () => {
    const wrapper = mount(AppButtonLink, {
      props: {
        to: '/jobs',
        variant: 'primary',
      },
      attrs: {
        class: 'not-found-action',
        'aria-label': 'Return to jobs',
        'data-testid': 'back-to-jobs',
      },
      global: {
        stubs: {
          RouterLink: routerLinkStub,
        },
      },
      slots: {
        default: 'Back to Jobs',
      },
    })
    const link = wrapper.get('[data-testid="back-to-jobs"]')

    expect(link.classes()).toEqual(
      expect.arrayContaining(['app-button', 'app-button--primary', 'not-found-action']),
    )
    expect(link.attributes('aria-label')).toBe('Return to jobs')
  })
})
