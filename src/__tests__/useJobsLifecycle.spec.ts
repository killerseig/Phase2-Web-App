import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useJobsLifecycle } from '@/features/jobs/useJobsLifecycle'

function mountLifecycle() {
  const calls: string[] = []
  const clearDetailAutosaveTimer = vi.fn(() => calls.push('clearDetailAutosaveTimer'))
  const startAdminSubscriptions = vi.fn(() => calls.push('startAdminSubscriptions'))
  const startJobsSubscription = vi.fn(() => calls.push('startJobsSubscription'))
  const stopAdminSubscriptions = vi.fn(() => calls.push('stopAdminSubscriptions'))
  const stopJobsSubscription = vi.fn(() => calls.push('stopJobsSubscription'))

  const Component = defineComponent({
    setup() {
      useJobsLifecycle({
        clearDetailAutosaveTimer,
        startAdminSubscriptions,
        startJobsSubscription,
        stopAdminSubscriptions,
        stopJobsSubscription,
      })

      return () => null
    },
  })

  return {
    calls,
    clearDetailAutosaveTimer,
    startAdminSubscriptions,
    startJobsSubscription,
    stopAdminSubscriptions,
    stopJobsSubscription,
    wrapper: mount(Component),
  }
}

describe('useJobsLifecycle', () => {
  it('starts job subscriptions before admin-only subscriptions on mount', () => {
    const { calls, startAdminSubscriptions, startJobsSubscription, wrapper } = mountLifecycle()

    expect(startJobsSubscription).toHaveBeenCalledTimes(1)
    expect(startAdminSubscriptions).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['startJobsSubscription', 'startAdminSubscriptions'])

    wrapper.unmount()
  })

  it('does not run cleanup callbacks before unmount', () => {
    const { clearDetailAutosaveTimer, stopAdminSubscriptions, stopJobsSubscription, wrapper } = mountLifecycle()

    expect(clearDetailAutosaveTimer).not.toHaveBeenCalled()
    expect(stopJobsSubscription).not.toHaveBeenCalled()
    expect(stopAdminSubscriptions).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('clears autosave before stopping job and admin subscriptions on unmount', () => {
    const {
      calls,
      clearDetailAutosaveTimer,
      stopAdminSubscriptions,
      stopJobsSubscription,
      wrapper,
    } = mountLifecycle()

    wrapper.unmount()

    expect(clearDetailAutosaveTimer).toHaveBeenCalledTimes(1)
    expect(stopJobsSubscription).toHaveBeenCalledTimes(1)
    expect(stopAdminSubscriptions).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      'startJobsSubscription',
      'startAdminSubscriptions',
      'clearDetailAutosaveTimer',
      'stopJobsSubscription',
      'stopAdminSubscriptions',
    ])
  })
})
