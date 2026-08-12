import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardStatusBar from '@/components/timecards/JobTimecardStatusBar.vue'

function mountStatus(overrides = {}) {
  return mount(JobTimecardStatusBar, {
    props: {
      weekRangeLabel: 'Jun 14 - Jun 20',
      weekStatusLabel: 'Draft',
      selectedWeekSubmitted: false,
      cardCount: 2,
      saveError: '',
      saveStateLabel: 'Saved',
      ...overrides,
    },
  })
}

describe('JobTimecardStatusBar', () => {
  it('renders status panel copy and signal values', () => {
    const wrapper = mountStatus()

    expect(wrapper.get('legend').text()).toBe('Status')
    expect(wrapper.text()).toContain('Jun 14 - Jun 20')
    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.text()).toContain('2 Cards')
    expect(wrapper.text()).toContain('Saved')
  })

  it('marks submitted weeks with the success tone', () => {
    const wrapper = mountStatus({
      weekStatusLabel: 'Submitted',
      selectedWeekSubmitted: true,
    })

    const submittedSignal = wrapper.findAll('.timecard-toolbar-signal').find((signal) => signal.text() === 'Submitted')
    expect(submittedSignal?.classes()).toContain('timecard-toolbar-signal--success')
  })

  it('marks save errors with the error tone', () => {
    const wrapper = mountStatus({
      saveError: 'Unable to save',
      saveStateLabel: 'Save Error',
    })

    const saveSignal = wrapper.findAll('.timecard-toolbar-signal').find((signal) => signal.text() === 'Save Error')
    expect(saveSignal?.classes()).toContain('timecard-toolbar-signal--error')
  })
})
