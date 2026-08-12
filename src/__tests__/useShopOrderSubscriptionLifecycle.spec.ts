import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderSubscriptionLifecycle } from '@/features/shopOrders/useShopOrderSubscriptionLifecycle'

let activeWrapper: VueWrapper | null = null

function mountLifecycle(jobId: Ref<string | null>) {
  activeWrapper?.unmount()

  const clearOrderItemNoteDrafts = vi.fn()
  const clearOrderMetaSaveTimer = vi.fn()
  const startOrdersSubscription = vi.fn()
  const stopCatalogRecords = vi.fn()
  const stopOrdersSubscription = vi.fn()
  const stopRouteJobSubscription = vi.fn()
  const subscribeCatalogRecords = vi.fn()
  const subscribeRouteJob = vi.fn()

  const Harness = defineComponent({
    name: 'ShopOrderLifecycleHarness',
    setup() {
      useShopOrderSubscriptionLifecycle({
        clearOrderItemNoteDrafts,
        clearOrderMetaSaveTimer,
        jobId,
        startOrdersSubscription,
        stopCatalogRecords,
        stopOrdersSubscription,
        stopRouteJobSubscription,
        subscribeCatalogRecords,
        subscribeRouteJob,
      })

      return () => null
    },
  })

  activeWrapper = mount(Harness)

  return {
    clearOrderItemNoteDrafts,
    clearOrderMetaSaveTimer,
    startOrdersSubscription,
    stopCatalogRecords,
    stopOrdersSubscription,
    stopRouteJobSubscription,
    subscribeCatalogRecords,
    subscribeRouteJob,
    wrapper: activeWrapper,
  }
}

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
})

describe('useShopOrderSubscriptionLifecycle', () => {
  it('starts route job, catalog, and order subscriptions on mount when a job is selected', () => {
    const jobId = ref<string | null>('job-1')
    const lifecycle = mountLifecycle(jobId)

    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeCatalogRecords).toHaveBeenCalledTimes(1)
    expect(lifecycle.startOrdersSubscription).toHaveBeenCalledTimes(1)
  })

  it('does not start the order subscription on mount until a job id exists', () => {
    const jobId = ref<string | null>(null)
    const lifecycle = mountLifecycle(jobId)

    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeCatalogRecords).toHaveBeenCalledTimes(1)
    expect(lifecycle.startOrdersSubscription).not.toHaveBeenCalled()
  })

  it('clears local save state and resubscribes when the route job id changes', async () => {
    const jobId = ref<string | null>('job-1')
    const lifecycle = mountLifecycle(jobId)
    vi.clearAllMocks()

    jobId.value = 'job-2'
    await nextTick()

    expect(lifecycle.clearOrderMetaSaveTimer).toHaveBeenCalledTimes(1)
    expect(lifecycle.clearOrderItemNoteDrafts).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.subscribeCatalogRecords).toHaveBeenCalledTimes(1)
    expect(lifecycle.startOrdersSubscription).toHaveBeenCalledTimes(1)
  })

  it('ignores empty route job ids during route changes', async () => {
    const jobId = ref<string | null>('job-1')
    const lifecycle = mountLifecycle(jobId)
    vi.clearAllMocks()

    jobId.value = null
    await nextTick()

    expect(lifecycle.clearOrderMetaSaveTimer).not.toHaveBeenCalled()
    expect(lifecycle.clearOrderItemNoteDrafts).not.toHaveBeenCalled()
    expect(lifecycle.subscribeRouteJob).not.toHaveBeenCalled()
    expect(lifecycle.subscribeCatalogRecords).not.toHaveBeenCalled()
    expect(lifecycle.startOrdersSubscription).not.toHaveBeenCalled()
  })

  it('clears local state and stops subscriptions on unmount', () => {
    const jobId = ref<string | null>('job-1')
    const lifecycle = mountLifecycle(jobId)

    lifecycle.wrapper.unmount()

    expect(lifecycle.clearOrderMetaSaveTimer).toHaveBeenCalledTimes(1)
    expect(lifecycle.clearOrderItemNoteDrafts).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopCatalogRecords).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopOrdersSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopRouteJobSubscription).toHaveBeenCalledTimes(1)
  })
})
