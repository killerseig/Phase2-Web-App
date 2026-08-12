import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppLinkCard from '@/components/common/AppLinkCard.vue'

const routerLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a><slot /></a>',
}

function mountCard(overrides = {}) {
  return mount(AppLinkCard, {
    props: {
      to: '/jobs/job-5229/timecards',
      ...overrides,
    },
    global: {
      stubs: {
        RouterLink: routerLinkStub,
      },
    },
    slots: {
      default: '<strong>Timecards</strong><p>Create and review cards.</p>',
    },
  })
}

describe('AppLinkCard', () => {
  it('renders slot content through a card-styled router link', () => {
    const wrapper = mountCard()
    const link = wrapper.get('a')

    expect(link.classes()).toContain('app-link-card')
    expect(link.text()).toContain('Timecards')
    expect(link.text()).toContain('Create and review cards.')
    expect(wrapper.getComponent(routerLinkStub).props('to')).toBe('/jobs/job-5229/timecards')
  })

  it('passes route location objects through to RouterLink', () => {
    const to = {
      name: 'job-module',
      params: {
        jobId: 'job-5229',
        module: 'daily-logs',
      },
    }
    const wrapper = mountCard({ to })

    expect(wrapper.getComponent(routerLinkStub).props('to')).toEqual(to)
  })

  it('passes attrs through and merges custom classes', () => {
    const wrapper = mount(AppLinkCard, {
      props: {
        to: '/jobs/job-5229/shop-orders',
      },
      attrs: {
        class: 'module-launcher-card',
        'aria-label': 'Open shop orders',
        'data-testid': 'job-dashboard-module-shop-orders',
      },
      global: {
        stubs: {
          RouterLink: routerLinkStub,
        },
      },
      slots: {
        default: 'Shop Orders',
      },
    })
    const link = wrapper.get('[data-testid="job-dashboard-module-shop-orders"]')

    expect(link.classes()).toEqual(
      expect.arrayContaining(['app-link-card', 'module-launcher-card']),
    )
    expect(link.attributes('aria-label')).toBe('Open shop orders')
  })
})
