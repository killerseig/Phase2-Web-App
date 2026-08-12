import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppCard from '@/components/common/AppCard.vue'

describe('AppCard', () => {
  it('renders an article card by default', () => {
    const wrapper = mount(AppCard, {
      slots: {
        default: '<p>Card content</p>',
      },
    })

    expect(wrapper.get('article').classes()).toContain('app-card')
    expect(wrapper.text()).toBe('Card content')
  })

  it.each(['article', 'section', 'div'] as const)('supports %s as the root element', (as) => {
    const wrapper = mount(AppCard, {
      props: { as },
      slots: {
        default: '<span>Surface</span>',
      },
    })

    expect(wrapper.get(as).classes()).toContain('app-card')
    expect(wrapper.text()).toBe('Surface')
  })

  it('passes root attrs through and merges custom classes', () => {
    const wrapper = mount(AppCard, {
      attrs: {
        class: 'daily-logs-card',
        'data-testid': 'daily-log-card',
        'aria-label': 'Daily log card',
      },
    })
    const card = wrapper.get('[data-testid="daily-log-card"]')

    expect(card.classes()).toEqual(expect.arrayContaining(['app-card', 'daily-logs-card']))
    expect(card.attributes('aria-label')).toBe('Daily log card')
  })

  it('exposes density, elevation, and tone as stable visual variant classes', () => {
    const wrapper = mount(AppCard, {
      props: {
        density: 'compact',
        elevation: 'flat',
        tone: 'muted',
      },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'app-card',
      'app-card--density-compact',
      'app-card--elevation-flat',
      'app-card--tone-muted',
    ]))
  })
})
