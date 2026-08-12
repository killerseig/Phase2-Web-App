import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardToolbarTabs from '@/components/timecards/TimecardToolbarTabs.vue'

const tabs = [
  { key: 'week', label: 'Week Filters' },
  { key: 'actions', label: 'Actions' },
  { key: 'history', label: 'History' },
]

function mountTabs(overrides = {}) {
  return mount(TimecardToolbarTabs, {
    props: {
      tabs,
      activeKey: 'actions',
      toolbarLabel: 'Timecard toolbar sections',
      tabIdPrefix: 'timecards-tab',
      panelIdPrefix: 'timecards-panel',
      ...overrides,
    },
  })
}

describe('TimecardToolbarTabs', () => {
  it('renders an accessible tablist with generated tab and panel ids', () => {
    const wrapper = mountTabs()
    const tablist = wrapper.get('[role="tablist"]')
    const buttons = wrapper.findAll<HTMLButtonElement>('[role="tab"]')
    const weekTab = wrapper.get<HTMLButtonElement>('#timecards-tab-week')
    const actionsTab = wrapper.get<HTMLButtonElement>('#timecards-tab-actions')
    const historyTab = wrapper.get<HTMLButtonElement>('#timecards-tab-history')

    expect(tablist.attributes('aria-label')).toBe('Timecard toolbar sections')
    expect(tablist.classes()).toContain('timecard-toolbar-tabs--at-960')
    expect(buttons).toHaveLength(3)
    expect(weekTab.attributes('aria-controls')).toBe('timecards-panel-week')
    expect(weekTab.attributes('aria-selected')).toBe('false')
    expect(actionsTab.attributes('aria-controls')).toBe('timecards-panel-actions')
    expect(actionsTab.attributes('aria-selected')).toBe('true')
    expect(actionsTab.classes()).toContain('timecard-toolbar-tabs__tab--active')
    expect(historyTab.text()).toBe('History')
  })

  it('supports the alternate collapse breakpoint class', () => {
    const wrapper = mountTabs({ collapseAt: '900' })

    expect(wrapper.get('[role="tablist"]').classes()).toContain('timecard-toolbar-tabs--at-900')
  })

  it('emits selected tab keys when tabs are clicked', async () => {
    const wrapper = mountTabs()

    await wrapper.get('#timecards-tab-week').trigger('click')
    await wrapper.get('#timecards-tab-history').trigger('click')

    expect(wrapper.emitted('selectTab')).toEqual([['week'], ['history']])
  })
})
