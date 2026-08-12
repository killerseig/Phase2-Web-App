import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardWeekPanel from '@/components/timecards/JobTimecardWeekPanel.vue'

const DateInputStub = {
  props: ['modelValue'],
  emits: ['change', 'click'],
  template: `
    <input
      data-testid="timecards-week-ending"
      type="date"
      :value="modelValue"
      @change="$emit('change', $event)"
      @click="$emit('click', $event)"
    />
  `,
}

function mountPanel(overrides = {}) {
  return mount(JobTimecardWeekPanel, {
    props: {
      displayJobCode: '736',
      displayJobName: 'Shop',
      selectedWeekEndDate: '2026-06-20',
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        AppDateInput: DateInputStub,
      },
    },
  })
}

describe('JobTimecardWeekPanel', () => {
  it('renders job number, job name, and selected week ending', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Week Filters')
    expect(wrapper.text()).toContain('Job Number')
    expect(wrapper.text()).toContain('736')
    expect(wrapper.text()).toContain('Job Name')
    expect(wrapper.text()).toContain('Shop')
    expect((wrapper.get('[data-testid="timecards-week-ending"]').element as HTMLInputElement).value)
      .toBe('2026-06-20')
  })

  it('emits date input and picker-open events from the date field', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('[data-testid="timecards-week-ending"]')

    await input.setValue('2026-06-27')
    await input.trigger('click')

    expect(wrapper.emitted('weekEndingInput')).toHaveLength(1)
    expect(wrapper.emitted('weekEndingPickerOpen')).toHaveLength(1)
  })
})
