import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppMobilePanelTabs from '@/components/common/AppMobilePanelTabs.vue'

function mountTabs(activePanel = 'browser') {
  return mount(AppMobilePanelTabs, {
    props: {
      activePanel,
      label: 'Admin panels',
      panels: [
        { key: 'browser', label: 'Browse' },
        { key: 'details', label: 'Details' },
      ],
    },
  })
}

describe('AppMobilePanelTabs', () => {
  it('renders accessible tab buttons with the current active state', () => {
    const wrapper = mountTabs('details')
    const tablist = wrapper.get('[role="tablist"]')
    const tabs = wrapper.findAll('[role="tab"]')
    const browseTab = tabs[0]
    const detailsTab = tabs[1]

    expect(tablist.attributes('aria-label')).toBe('Admin panels')
    expect(tabs).toHaveLength(2)
    expect(browseTab).toBeDefined()
    expect(detailsTab).toBeDefined()

    if (!browseTab || !detailsTab) throw new Error('Expected mobile panel tabs to render')

    expect(browseTab.text()).toBe('Browse')
    expect(browseTab.attributes('aria-selected')).toBe('false')
    expect(browseTab.classes()).not.toContain('app-mobile-panel-tabs__button--active')
    expect(detailsTab.text()).toBe('Details')
    expect(detailsTab.attributes('aria-selected')).toBe('true')
    expect(detailsTab.classes()).toContain('app-mobile-panel-tabs__button--active')
  })

  it('emits the panel key when a tab is selected', async () => {
    const wrapper = mountTabs()
    const detailsTab = wrapper.findAll('[role="tab"]')[1]

    expect(detailsTab).toBeDefined()
    if (!detailsTab) throw new Error('Expected details tab to render')

    await detailsTab.trigger('click')

    expect(wrapper.emitted('show')).toEqual([['details']])
  })
})
