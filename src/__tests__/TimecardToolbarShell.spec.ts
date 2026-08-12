import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardToolbarShell from '@/components/timecards/TimecardToolbarShell.vue'

describe('TimecardToolbarShell', () => {
  it('renders toolbar content in the requested semantic root', () => {
    const wrapper = mount(TimecardToolbarShell, {
      props: {
        as: 'header',
      },
      attrs: {
        class: 'custom-toolbar-shell',
      },
      slots: {
        default: '<button type="button">Create Card</button>',
      },
    })

    const shell = wrapper.get('header')

    expect(shell.classes()).toEqual(
      expect.arrayContaining([
        'timecards-toolbar',
        'timecard-toolbar-shell',
        'timecard-toolbar-shell--stretch-900',
        'custom-toolbar-shell',
      ]),
    )
    expect(wrapper.text()).toContain('Create Card')
  })

  it('supports the export toolbar stretch breakpoint', () => {
    const wrapper = mount(TimecardToolbarShell, {
      props: {
        as: 'section',
        stretchAt: '960',
      },
      slots: {
        default: '<p>Export controls</p>',
      },
    })

    expect(wrapper.get('section').classes()).toContain('timecard-toolbar-shell--stretch-960')
    expect(wrapper.text()).toContain('Export controls')
  })
})
