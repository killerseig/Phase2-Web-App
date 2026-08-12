import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'

describe('TimecardToolbarPanel', () => {
  it('renders an accessible tab panel with toolbar modifier and mobile classes', () => {
    const wrapper = mount(TimecardToolbarPanel, {
      props: {
        title: 'Week Filters',
        panelId: 'timecards-toolbar-panel-week',
        labelledBy: 'timecards-toolbar-tab-week',
        mobileActive: true,
        collapseAt: '960',
        modifiers: ['filters', 'weeks'],
      },
      attrs: {
        class: 'custom-toolbar-panel',
      },
      slots: {
        default: '<button type="button">Create Week</button>',
      },
    })

    const panel = wrapper.get('fieldset')

    expect(panel.attributes('id')).toBe('timecards-toolbar-panel-week')
    expect(panel.attributes('role')).toBe('tabpanel')
    expect(panel.attributes('aria-labelledby')).toBe('timecards-toolbar-tab-week')
    expect(panel.classes()).toEqual(
      expect.arrayContaining([
        'timecards-toolbar__group',
        'timecard-toolbar-panel',
        'timecards-toolbar__group--filters',
        'timecards-toolbar__group--weeks',
        'timecards-toolbar__group--mobile-active',
        'timecard-toolbar-panel--mobile-active',
        'timecard-toolbar-panel--collapse-960',
        'custom-toolbar-panel',
      ]),
    )
    expect(wrapper.get('legend').text()).toBe('Week Filters')
    expect(wrapper.text()).toContain('Create Week')
  })

  it('supports non-tab status panels that remain visible on mobile', () => {
    const wrapper = mount(TimecardToolbarPanel, {
      props: {
        title: 'Status',
        mobileAlwaysVisible: true,
        modifiers: ['status-bar'],
      },
      slots: {
        default: '<span>Ready</span>',
      },
    })

    const panel = wrapper.get('fieldset')

    expect(panel.attributes('role')).toBeUndefined()
    expect(panel.attributes('aria-labelledby')).toBeUndefined()
    expect(panel.classes()).toEqual(
      expect.arrayContaining([
        'timecards-toolbar__group--status-bar',
        'timecard-toolbar-panel--mobile-always-visible',
        'timecard-toolbar-panel--collapse-900',
      ]),
    )
    expect(wrapper.get('legend').text()).toBe('Status')
    expect(wrapper.text()).toContain('Ready')
  })
})
