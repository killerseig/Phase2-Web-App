import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportStatusBar, {
  type TimecardExportStatusSignal,
} from '@/components/timecards/TimecardExportStatusBar.vue'

const signals: TimecardExportStatusSignal[] = [
  { key: 'week', text: 'Jun 14 - Jun 20', tone: 'default' },
  { key: 'status', text: 'Submitted', tone: 'success' },
  { key: 'save', text: 'Save Error', tone: 'error' },
]

function mountStatus(overrides: Partial<{ signals: TimecardExportStatusSignal[] }> = {}) {
  return mount(TimecardExportStatusBar, {
    props: {
      signals,
      ...overrides,
    },
  })
}

describe('TimecardExportStatusBar', () => {
  it('renders the status panel and each signal in desktop and mobile layouts', () => {
    const wrapper = mountStatus()

    expect(wrapper.get('legend').text()).toBe('Status')
    expect(
      wrapper
        .findAll('.timecard-toolbar-signal')
        .filter((signal) => signal.text() === 'Jun 14 - Jun 20'),
    ).toHaveLength(2)
    expect(
      wrapper.findAll('.timecard-toolbar-signal').filter((signal) => signal.text() === 'Submitted'),
    ).toHaveLength(2)
    expect(
      wrapper.findAll('.timecard-toolbar-signal').filter((signal) => signal.text() === 'Save Error'),
    ).toHaveLength(2)
  })

  it('passes success and error tones to matching status signals', () => {
    const wrapper = mountStatus()

    const submittedSignals = wrapper
      .findAll('.timecard-toolbar-signal')
      .filter((signal) => signal.text() === 'Submitted')
    const errorSignals = wrapper
      .findAll('.timecard-toolbar-signal')
      .filter((signal) => signal.text() === 'Save Error')

    expect(
      submittedSignals.every((signal) =>
        signal.classes().includes('timecard-toolbar-signal--success'),
      ),
    ).toBe(true)
    expect(
      errorSignals.every((signal) => signal.classes().includes('timecard-toolbar-signal--error')),
    ).toBe(true)
  })

  it('renders carousel controls with the expected initial disabled state', () => {
    const wrapper = mountStatus()
    const buttons = wrapper.findAll<HTMLButtonElement>('.timecard-export-status-bar__scroll-button')
    const previousButton = buttons[0]
    const nextButton = buttons[1]

    expect(buttons).toHaveLength(2)
    expect(previousButton).toBeDefined()
    expect(nextButton).toBeDefined()
    expect(previousButton!.element.disabled).toBe(true)
    expect(nextButton!.element.disabled).toBe(false)
  })

  it('disables both carousel controls when there are not enough signals to scroll', () => {
    const wrapper = mountStatus({
      signals: [
        { key: 'week', text: 'Jun 14 - Jun 20', tone: 'default' },
        { key: 'status', text: 'Draft', tone: 'default' },
      ],
    })
    const buttons = wrapper.findAll<HTMLButtonElement>('.timecard-export-status-bar__scroll-button')
    const previousButton = buttons[0]
    const nextButton = buttons[1]

    expect(buttons).toHaveLength(2)
    expect(previousButton).toBeDefined()
    expect(nextButton).toBeDefined()
    expect(previousButton!.element.disabled).toBe(true)
    expect(nextButton!.element.disabled).toBe(true)
  })
})
