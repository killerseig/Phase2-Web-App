import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useTimecardExportLifecycle } from '@/features/timecards/useTimecardExportLifecycle'

function mountLifecycle() {
  const calls: string[] = []
  const options = {
    disconnectCardMeasurements: vi.fn(() => {
      calls.push('disconnect-measurements')
    }),
    disposeSaveQueue: vi.fn(() => {
      calls.push('dispose-save-queue')
    }),
    startEmployeesSubscription: vi.fn(() => {
      calls.push('start-employees')
    }),
    startJobsSubscription: vi.fn(() => {
      calls.push('start-jobs')
    }),
    startUsersSubscription: vi.fn(() => {
      calls.push('start-users')
    }),
    startWeeksSubscription: vi.fn(() => {
      calls.push('start-weeks')
    }),
    stopCardsSubscription: vi.fn(() => {
      calls.push('stop-cards')
    }),
    stopEmployeesSubscription: vi.fn(() => {
      calls.push('stop-employees')
    }),
    stopUsersSubscription: vi.fn(() => {
      calls.push('stop-users')
    }),
    stopWeeksSubscription: vi.fn(() => {
      calls.push('stop-weeks')
    }),
  }
  const Harness = defineComponent({
    name: 'TimecardExportLifecycleHarness',
    setup() {
      useTimecardExportLifecycle(options)
      return {}
    },
    template: '<div />',
  })
  const wrapper = mount(Harness)

  return {
    calls,
    options,
    wrapper,
  }
}

describe('useTimecardExportLifecycle', () => {
  it('starts export subscriptions in route-load order on mount', () => {
    const { calls, options, wrapper } = mountLifecycle()

    expect(options.startJobsSubscription).toHaveBeenCalledTimes(1)
    expect(options.startWeeksSubscription).toHaveBeenCalledTimes(1)
    expect(options.startEmployeesSubscription).toHaveBeenCalledTimes(1)
    expect(options.startUsersSubscription).toHaveBeenCalledTimes(1)
    expect(options.disposeSaveQueue).not.toHaveBeenCalled()
    expect(options.disconnectCardMeasurements).not.toHaveBeenCalled()
    expect(calls).toEqual([
      'start-jobs',
      'start-weeks',
      'start-employees',
      'start-users',
    ])

    wrapper.unmount()
  })

  it('cleans up save queue, measurements, and subscriptions in unmount order', () => {
    const { calls, options, wrapper } = mountLifecycle()

    calls.length = 0
    wrapper.unmount()

    expect(options.disposeSaveQueue).toHaveBeenCalledTimes(1)
    expect(options.disconnectCardMeasurements).toHaveBeenCalledTimes(1)
    expect(options.stopWeeksSubscription).toHaveBeenCalledTimes(1)
    expect(options.stopCardsSubscription).toHaveBeenCalledTimes(1)
    expect(options.stopEmployeesSubscription).toHaveBeenCalledTimes(1)
    expect(options.stopUsersSubscription).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      'dispose-save-queue',
      'disconnect-measurements',
      'stop-weeks',
      'stop-cards',
      'stop-employees',
      'stop-users',
    ])
  })
})
