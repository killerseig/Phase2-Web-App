import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardSourceBadge from '@/components/timecards/TimecardSourceBadge.vue'

describe('TimecardSourceBadge', () => {
  it('labels employee-list cards', () => {
    const wrapper = mount(TimecardSourceBadge, {
      props: {
        sourceType: 'employee',
        testId: 'employee-source',
      },
    })

    expect(wrapper.text()).toBe('EMPLOYEE')
    expect(wrapper.classes()).toContain('timecard-source-badge--employee')
    expect(wrapper.attributes('aria-label')).toBe('Card type: EMPLOYEE')
    expect(wrapper.attributes('data-testid')).toBe('employee-source')
  })

  it('labels custom records as one-off cards', () => {
    const wrapper = mount(TimecardSourceBadge, {
      props: {
        sourceType: 'custom',
      },
    })

    expect(wrapper.text()).toBe('ONE-OFF')
    expect(wrapper.classes()).toContain('timecard-source-badge--one-off')
    expect(wrapper.attributes('aria-label')).toBe('Card type: ONE-OFF')
  })
})
