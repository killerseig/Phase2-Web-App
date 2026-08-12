import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppEntityHeader from '@/components/common/AppEntityHeader.vue'

describe('AppEntityHeader', () => {
  it('renders eyebrow and a strong title by default', () => {
    const wrapper = mount(AppEntityHeader, {
      props: {
        eyebrow: 'Order #123',
        title: 'Submitted / Due 2026-06-11',
      },
    })

    expect(wrapper.get('header').classes()).toContain('app-entity-header')
    expect(wrapper.get('.app-entity-header__eyebrow').text()).toBe('Order #123')
    expect(wrapper.get('strong.app-entity-header__title').text()).toBe('Submitted / Due 2026-06-11')
  })

  it.each(['strong', 'h2', 'h3'] as const)('supports %s as the title tag', (titleTag) => {
    const wrapper = mount(AppEntityHeader, {
      props: {
        title: 'Selected record',
        titleTag,
      },
    })

    expect(wrapper.get(`${titleTag}.app-entity-header__title`).text()).toBe('Selected record')
  })

  it('renders action slot content when provided', () => {
    const wrapper = mount(AppEntityHeader, {
      props: {
        title: 'Draft / Due 2026-06-11',
      },
      slots: {
        actions: '<span data-testid="status-pill">Draft</span>',
      },
    })

    expect(wrapper.get('.app-entity-header__actions').text()).toBe('Draft')
    expect(wrapper.get('[data-testid="status-pill"]').text()).toBe('Draft')
  })

  it('passes root attrs through and merges custom classes', () => {
    const wrapper = mount(AppEntityHeader, {
      props: {
        title: 'Record',
      },
      attrs: {
        class: 'shop-order-selected-panel__header',
        'data-testid': 'entity-header',
        'aria-label': 'Selected order',
      },
    })
    const header = wrapper.get('[data-testid="entity-header"]')

    expect(header.classes()).toEqual(
      expect.arrayContaining(['app-entity-header', 'shop-order-selected-panel__header']),
    )
    expect(header.attributes('aria-label')).toBe('Selected order')
  })

  it('passes a custom identity class to the identity wrapper', () => {
    const wrapper = mount(AppEntityHeader, {
      props: {
        identityClass: 'shop-orders-workspace-strip__identity',
        title: 'Submitted / Due 2026-06-11',
      },
    })

    expect(wrapper.get('.app-entity-header__identity').classes()).toContain(
      'shop-orders-workspace-strip__identity',
    )
  })
})
