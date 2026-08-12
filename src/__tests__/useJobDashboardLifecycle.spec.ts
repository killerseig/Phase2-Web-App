import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useJobDashboardLifecycle } from '@/features/jobs/useJobDashboardLifecycle'

function mountDashboardLifecycle(initialJobId = 'job-100') {
  const calls: string[] = []
  const routeJobId = ref(initialJobId)
  const subscribeRouteJob = vi.fn(() => calls.push(`subscribe:${routeJobId.value}`))
  const stopRouteJobSubscription = vi.fn(() => calls.push('stop'))

  const Component = defineComponent({
    setup() {
      useJobDashboardLifecycle({
        jobId: computed(() => routeJobId.value),
        subscribeRouteJob,
        stopRouteJobSubscription,
      })

      return () => null
    },
  })

  return {
    calls,
    routeJobId,
    stopRouteJobSubscription,
    subscribeRouteJob,
    wrapper: mount(Component),
  }
}

describe('useJobDashboardLifecycle', () => {
  it('subscribes to the current route job on mount', () => {
    const { calls, subscribeRouteJob, wrapper } = mountDashboardLifecycle('job-alpha')

    expect(subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['subscribe:job-alpha'])

    wrapper.unmount()
  })

  it('resubscribes when the route job id changes', async () => {
    const { calls, routeJobId, subscribeRouteJob, wrapper } = mountDashboardLifecycle('job-alpha')

    routeJobId.value = 'job-beta'
    await nextTick()

    expect(subscribeRouteJob).toHaveBeenCalledTimes(2)
    expect(calls).toEqual(['subscribe:job-alpha', 'subscribe:job-beta'])

    routeJobId.value = 'job-beta'
    await nextTick()

    expect(subscribeRouteJob).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('stops the route-job subscription on unmount', () => {
    const { calls, stopRouteJobSubscription, wrapper } = mountDashboardLifecycle('job-alpha')

    expect(stopRouteJobSubscription).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(stopRouteJobSubscription).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['subscribe:job-alpha', 'stop'])
  })
})
