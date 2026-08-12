import { defineComponent, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDailyLogSubscriptionLifecycle } from '@/features/dailyLogs/useDailyLogSubscriptionLifecycle'

let activeWrapper: VueWrapper | null = null

function mountLifecycle(jobId: Ref<string | null>) {
  activeWrapper?.unmount()

  const startRecipientDefaultsSubscription = vi.fn()
  const stopLogsSubscription = vi.fn()
  const stopRecipientDefaultsSubscription = vi.fn()
  const stopRouteJobSubscription = vi.fn()
  const subscribeLogsForSelectedDate = vi.fn()
  const subscribeRouteJob = vi.fn()

  const Harness = defineComponent({
    name: 'DailyLogSubscriptionLifecycleHarness',
    setup() {
      useDailyLogSubscriptionLifecycle({
        jobId,
        startRecipientDefaultsSubscription,
        stopLogsSubscription,
        stopRecipientDefaultsSubscription,
        stopRouteJobSubscription,
        subscribeLogsForSelectedDate,
        subscribeRouteJob,
      })

      return () => null
    },
  })

  activeWrapper = mount(Harness)

  return {
    startRecipientDefaultsSubscription,
    stopLogsSubscription,
    stopRecipientDefaultsSubscription,
    stopRouteJobSubscription,
    subscribeLogsForSelectedDate,
    subscribeRouteJob,
    wrapper: activeWrapper,
  }
}

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
})

describe('useDailyLogSubscriptionLifecycle', () => {
  it('starts recipient defaults, route job, and selected-date logs on mount when a job is selected', () => {
    const jobId = ref<string | null>('job-1')
    const lifecycle = mountLifecycle(jobId)

    expect(lifecycle.startRecipientDefaultsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeLogsForSelectedDate).toHaveBeenCalledTimes(1)
  })

  it('starts recipient defaults but skips route-job and log subscriptions when no job id exists', () => {
    const jobId = ref<string | null>(null)
    const lifecycle = mountLifecycle(jobId)

    expect(lifecycle.startRecipientDefaultsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeRouteJob).not.toHaveBeenCalled()
    expect(lifecycle.subscribeLogsForSelectedDate).not.toHaveBeenCalled()
  })

  it('does not watch later job-id changes because date navigation owns job-change resubscription', async () => {
    const jobId = ref<string | null>(null)
    const lifecycle = mountLifecycle(jobId)

    jobId.value = 'job-1'
    await lifecycle.wrapper.vm.$nextTick()

    expect(lifecycle.startRecipientDefaultsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeRouteJob).not.toHaveBeenCalled()
    expect(lifecycle.subscribeLogsForSelectedDate).not.toHaveBeenCalled()
  })

  it('stops log, recipient-default, and route-job subscriptions on unmount', () => {
    const jobId = ref<string | null>('job-1')
    const lifecycle = mountLifecycle(jobId)

    lifecycle.wrapper.unmount()

    expect(lifecycle.stopLogsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopRecipientDefaultsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopRouteJobSubscription).toHaveBeenCalledTimes(1)
  })
})
