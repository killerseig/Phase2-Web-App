import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderRecords } from '@/features/shopOrders/useShopOrderRecords'
import { subscribeShopOrders } from '@/services/shopOrders'
import type { ShopOrderRecord } from '@/types/domain'

vi.mock('@/services/shopOrders', () => ({
  subscribeShopOrders: vi.fn(),
}))

const subscribeShopOrdersMock = vi.mocked(subscribeShopOrders)

type OrderUpdate = (orders: ShopOrderRecord[]) => void
type OrderError = (error: unknown) => void

function makeOrder(overrides: Partial<ShopOrderRecord> = {}): ShopOrderRecord {
  return {
    comments: '',
    deliveryDate: '2026-06-11',
    foremanName: 'CJ Blanchard',
    foremanUserId: 'user-cj',
    id: 'order-1',
    items: [],
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    status: 'draft',
    ...overrides,
  }
}

function installOrderSubscriptionMock() {
  const errors: OrderError[] = []
  const jobIds: string[] = []
  const unsubscribes: ReturnType<typeof vi.fn>[] = []
  const updates: OrderUpdate[] = []

  subscribeShopOrdersMock.mockImplementation((jobId, onUpdate, onError) => {
    jobIds.push(jobId)
    updates.push(onUpdate)
    errors.push(onError ?? (() => undefined))

    const unsubscribe = vi.fn()
    unsubscribes.push(unsubscribe)
    return unsubscribe
  })

  return {
    errors,
    jobIds,
    unsubscribes,
    updates,
  }
}

describe('useShopOrderRecords', () => {
  beforeEach(() => {
    subscribeShopOrdersMock.mockReset()
  })

  it('subscribes to the current job shop orders and accepts listener updates', () => {
    const mock = installOrderSubscriptionMock()
    const jobId = ref('job-shop')
    const records = useShopOrderRecords({
      jobId: computed(() => jobId.value),
    })

    records.startOrdersSubscription()

    expect(records.ordersLoading.value).toBe(true)
    expect(records.ordersError.value).toBe('')
    expect(subscribeShopOrdersMock).toHaveBeenCalledTimes(1)
    expect(mock.jobIds).toEqual(['job-shop'])

    mock.updates[0]!([makeOrder()])

    expect(records.orders.value).toEqual([makeOrder()])
    expect(records.ordersLoading.value).toBe(false)
    expect(records.ordersError.value).toBe('')
  })

  it('stops the previous listener before restarting for a changed job id', () => {
    const mock = installOrderSubscriptionMock()
    const jobId = ref('job-shop')
    const records = useShopOrderRecords({
      jobId: computed(() => jobId.value),
    })

    records.startOrdersSubscription()
    jobId.value = 'job-field'
    records.startOrdersSubscription()

    expect(mock.unsubscribes[0]).toHaveBeenCalledTimes(1)
    expect(mock.jobIds).toEqual(['job-shop', 'job-field'])

    records.stopOrdersSubscription()
    records.stopOrdersSubscription()

    expect(mock.unsubscribes[1]).toHaveBeenCalledTimes(1)
  })

  it('normalizes listener and startup failures with shop-order fallback copy', () => {
    const mock = installOrderSubscriptionMock()
    const jobId = ref('job-shop')
    const records = useShopOrderRecords({
      jobId: computed(() => jobId.value),
    })

    records.startOrdersSubscription()
    mock.errors[0]!({})

    expect(records.ordersError.value).toBe('Failed to load shop orders.')
    expect(records.ordersLoading.value).toBe(false)

    subscribeShopOrdersMock.mockImplementationOnce(() => {
      throw new Error('Shop order listener failed')
    })

    records.startOrdersSubscription()

    expect(records.ordersError.value).toBe('Shop order listener failed')
    expect(records.ordersLoading.value).toBe(false)
  })

  it('replaces matching local orders without appending missing records', () => {
    const mock = installOrderSubscriptionMock()
    const jobId = ref('job-shop')
    const records = useShopOrderRecords({
      jobId: computed(() => jobId.value),
    })

    records.startOrdersSubscription()
    mock.updates[0]!([
      makeOrder({ comments: 'old note', id: 'order-1' }),
      makeOrder({ id: 'order-2', orderNumber: '202606110002' }),
    ])

    records.replaceOrderLocally(makeOrder({ comments: 'new note', id: 'order-1' }))

    expect(records.orders.value).toEqual([
      makeOrder({ comments: 'new note', id: 'order-1' }),
      makeOrder({ id: 'order-2', orderNumber: '202606110002' }),
    ])

    records.replaceOrderLocally(makeOrder({ id: 'order-missing' }))

    expect(records.orders.value).toEqual([
      makeOrder({ comments: 'new note', id: 'order-1' }),
      makeOrder({ id: 'order-2', orderNumber: '202606110002' }),
    ])
  })
})
