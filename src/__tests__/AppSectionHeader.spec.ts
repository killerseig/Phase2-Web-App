import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppSectionHeader from '@/components/common/AppSectionHeader.vue'

describe('AppSectionHeader', () => {
  it('renders a compact span title by default', () => {
    const wrapper = mount(AppSectionHeader, {
      props: {
        title: 'Added Items',
      },
    })

    expect(wrapper.get('header').classes()).toContain('app-section-header')
    expect(wrapper.get('span.app-section-header__title').text()).toBe('Added Items')
    expect(wrapper.find('.app-section-header__actions').exists()).toBe(false)
  })

  it.each(['span', 'strong', 'h2', 'h3'] as const)('supports %s as the title tag', (titleTag) => {
    const wrapper = mount(AppSectionHeader, {
      props: {
        title: 'Order History',
        titleTag,
      },
    })

    expect(wrapper.get(`${titleTag}.app-section-header__title`).text()).toBe('Order History')
  })

  it('renders action slot content when provided', () => {
    const wrapper = mount(AppSectionHeader, {
      props: {
        title: 'Order History',
      },
      slots: {
        actions: '<span data-testid="summary">1 draft</span>',
      },
    })

    expect(wrapper.get('.app-section-header__actions').text()).toBe('1 draft')
    expect(wrapper.get('[data-testid="summary"]').text()).toBe('1 draft')
  })

  it('renders description prop and slot content under the title', () => {
    const propWrapper = mount(AppSectionHeader, {
      props: {
        title: 'Email Recipients',
        description: 'Added on top of All Jobs defaults for this job only',
      },
    })
    const slotWrapper = mount(AppSectionHeader, {
      props: {
        title: 'Email Recipients',
      },
      slots: {
        description: '<span data-testid="description">Sent when logs are submitted.</span>',
      },
    })

    expect(propWrapper.get('.app-section-header__description').text()).toBe(
      'Added on top of All Jobs defaults for this job only',
    )
    expect(slotWrapper.get('[data-testid="description"]').text()).toBe(
      'Sent when logs are submitted.',
    )
  })

  it('renders optional eyebrow copy above the title', () => {
    const wrapper = mount(AppSectionHeader, {
      props: {
        eyebrow: 'History',
        title: 'Logs for 2026-06-11',
      },
    })

    expect(wrapper.get('.app-section-header__eyebrow').text()).toBe('History')
    expect(wrapper.get('.app-section-header__title').text()).toBe('Logs for 2026-06-11')
  })

  it('passes root attrs through and merges custom classes', () => {
    const wrapper = mount(AppSectionHeader, {
      props: {
        title: 'Added Items',
      },
      attrs: {
        class: 'shop-orders-workspace-section__header',
        'data-testid': 'section-header',
        'aria-label': 'Added items summary',
      },
    })
    const header = wrapper.get('[data-testid="section-header"]')

    expect(header.classes()).toEqual(
      expect.arrayContaining(['app-section-header', 'shop-orders-workspace-section__header']),
    )
    expect(header.attributes('aria-label')).toBe('Added items summary')
  })
})
