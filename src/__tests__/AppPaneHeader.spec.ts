import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppPaneHeader from '@/components/common/AppPaneHeader.vue'

describe('AppPaneHeader', () => {
  it('renders eyebrow and title with an h1 title by default', () => {
    const wrapper = mount(AppPaneHeader, {
      props: {
        eyebrow: 'Admin',
        title: 'Jobs',
      },
    })

    expect(wrapper.get('header').classes()).toContain('app-pane-header')
    expect(wrapper.get('.app-pane-header__eyebrow').text()).toBe('Admin')
    expect(wrapper.get('h1.app-pane-header__title').text()).toBe('Jobs')
    expect(wrapper.find('.app-pane-header__actions').exists()).toBe(false)
  })

  it.each(['h1', 'h2', 'h3'] as const)('supports %s as the heading tag', (titleTag) => {
    const wrapper = mount(AppPaneHeader, {
      props: {
        title: 'Shop Catalog',
        titleTag,
      },
    })

    expect(wrapper.get(`${titleTag}.app-pane-header__title`).text()).toBe('Shop Catalog')
  })

  it('omits the eyebrow when none is provided', () => {
    const wrapper = mount(AppPaneHeader, {
      props: {
        title: 'Employees',
      },
    })

    expect(wrapper.find('.app-pane-header__eyebrow').exists()).toBe(false)
    expect(wrapper.text()).toBe('Employees')
  })

  it('renders action slot content when provided', () => {
    const wrapper = mount(AppPaneHeader, {
      props: {
        eyebrow: 'Admin',
        title: 'Users',
      },
      slots: {
        actions: '<button data-testid="new-user">New User</button>',
      },
    })

    expect(wrapper.get('.app-pane-header__actions').text()).toBe('New User')
    expect(wrapper.get('[data-testid="new-user"]').text()).toBe('New User')
  })

  it('renders description prop and slot content under the title copy', () => {
    const propWrapper = mount(AppPaneHeader, {
      props: {
        eyebrow: 'Reference',
        title: 'Reference Lists',
        description: 'Use this page for shared lookup tables.',
      },
    })
    const slotWrapper = mount(AppPaneHeader, {
      props: {
        title: 'Job Dashboard',
      },
      slots: {
        description: '<span data-testid="description">Quick access to job modules.</span>',
      },
    })

    expect(propWrapper.get('.app-pane-header__description').text()).toBe(
      'Use this page for shared lookup tables.',
    )
    expect(slotWrapper.get('[data-testid="description"]').text()).toBe(
      'Quick access to job modules.',
    )
  })

  it('renders copy prefix slot content before the title copy', () => {
    const wrapper = mount(AppPaneHeader, {
      props: {
        eyebrow: 'Directory',
        title: 'Create Employee',
      },
      slots: {
        'copy-prefix': '<button data-testid="back-button">Back to Directory</button>',
      },
    })

    expect(wrapper.get('[data-testid="back-button"]').text()).toBe('Back to Directory')
    expect(wrapper.get('.app-pane-header__copy').text()).toContain('Back to Directory')
    expect(wrapper.get('.app-pane-header__title').text()).toBe('Create Employee')
  })

  it('passes root attrs through and merges custom classes', () => {
    const wrapper = mount(AppPaneHeader, {
      props: {
        title: 'Directory',
      },
      attrs: {
        class: 'users-browser__header',
        'data-testid': 'pane-header',
        'aria-label': 'Users directory header',
      },
    })
    const header = wrapper.get('[data-testid="pane-header"]')

    expect(header.classes()).toEqual(
      expect.arrayContaining(['app-pane-header', 'users-browser__header']),
    )
    expect(header.attributes('aria-label')).toBe('Users directory header')
  })
})
