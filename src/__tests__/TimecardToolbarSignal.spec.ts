import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimecardToolbarSignal from '@/components/timecards/TimecardToolbarSignal.vue'

describe('TimecardToolbarSignal', () => {
  it('renders the default toolbar signal with slot content', () => {
    const wrapper = mount(TimecardToolbarSignal, {
      attrs: {
        class: 'custom-signal',
      },
      slots: {
        default: '4 Cards',
      },
    })

    const signal = wrapper.get('span')

    expect(signal.text()).toBe('4 Cards')
    expect(signal.classes()).toEqual(
      expect.arrayContaining(['timecard-toolbar-signal', 'timecards-signal', 'custom-signal']),
    )
    expect(signal.classes()).not.toContain('timecard-toolbar-signal--success')
    expect(signal.classes()).not.toContain('timecard-toolbar-signal--error')
  })

  it('supports success and error tones', () => {
    const successWrapper = mount(TimecardToolbarSignal, {
      props: {
        tone: 'success',
      },
      slots: {
        default: 'Submitted',
      },
    })

    const errorWrapper = mount(TimecardToolbarSignal, {
      props: {
        tone: 'error',
      },
      slots: {
        default: 'Save failed',
      },
    })

    expect(successWrapper.get('span').classes()).toContain('timecard-toolbar-signal--success')
    expect(successWrapper.get('span').text()).toBe('Submitted')
    expect(errorWrapper.get('span').classes()).toContain('timecard-toolbar-signal--error')
    expect(errorWrapper.get('span').text()).toBe('Save failed')
  })
})
