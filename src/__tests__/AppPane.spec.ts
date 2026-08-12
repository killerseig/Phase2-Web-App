import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppPane from '@/components/common/AppPane.vue'

describe('AppPane', () => {
  it('renders pane content inside a section shell by default', () => {
    const wrapper = mount(AppPane, {
      slots: {
        default: '<p data-testid="pane-content">Pane body</p>',
      },
    })

    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.classes()).toContain('app-pane')
    expect(wrapper.get('[data-testid="pane-content"]').text()).toBe('Pane body')
  })

  it.each(['article', 'aside', 'div'] as const)('supports rendering as %s', (as) => {
    const wrapper = mount(AppPane, {
      props: { as },
    })

    expect(wrapper.element.tagName).toBe(as.toUpperCase())
  })

  it('passes attrs and custom classes through to the root pane', () => {
    const wrapper = mount(AppPane, {
      attrs: {
        class: 'jobs-browser',
        'data-testid': 'jobs-pane',
        'aria-label': 'Jobs browser',
      },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['app-pane', 'jobs-browser']))
    expect(wrapper.attributes('data-testid')).toBe('jobs-pane')
    expect(wrapper.attributes('aria-label')).toBe('Jobs browser')
  })

  it('exposes density, elevation, and tone as stable visual variant classes', () => {
    const wrapper = mount(AppPane, {
      props: {
        density: 'spacious',
        elevation: 'floating',
        tone: 'accent',
      },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'app-pane',
      'app-pane--density-spacious',
      'app-pane--elevation-floating',
      'app-pane--tone-accent',
    ]))
  })
})
