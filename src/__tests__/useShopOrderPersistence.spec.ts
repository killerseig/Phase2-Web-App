import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderPersistence } from '@/features/shopOrders/useShopOrderPersistence'
import { updateShopOrderRecord } from '@/services/shopOrders'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

vi.mock('@/services/shopOrders', () => ({
  updateShopOrderRecord: vi.fn(),
}))

const updateShopOrderRecordMock = vi.mocked(updateShopOrderRecord)

function makeDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'AHA Book',
    quantity: 1,
    price: null,
    note: '',
    categoryId: 'category-1',
    sku: null,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<ShopOrderRecord> = {}): ShopOrderRecord {
  return {
    id: 'order-1',
    jobId: 'job-1',
    jobCode: '736',
    jobName: 'Shop',
    orderNumber: '202607150001',
    deliveryDate: '2026-07-16',
    status: 'draft',
    comments: '',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [makeItem()],
    ...overrides,
  }
}

function mountPersistence(options: {
  selectedOrder?: ShopOrderRecord | null
} = {}) {
  const selectedOrder = ref<ShopOrderRecord | null>(
    options.selectedOrder === undefined ? makeOrder() : options.selectedOrder,
  )
  const itemActionLoading = ref(false)
  const actionErrors: string[] = []
  const actionInfos: string[] = []
  const replacedOrders: ShopOrderRecord[] = []

  const persistence = useShopOrderPersistence({
    getActor: () => ({ userId: 'user-1', displayName: 'CJ Blanchard' }),
    itemActionLoading,
    replaceOrderLocally: (order) => {
      replacedOrders.push(order)
      selectedOrder.value = order
    },
    selectedOrder: computed(() => selectedOrder.value),
    setActionError: (message) => {
      actionErrors.push(message)
    },
    setActionInfo: (message) => {
      actionInfos.push(message)
    },
  })

  return {
    actionErrors,
    actionInfos,
    itemActionLoading,
    persistence,
    replacedOrders,
    selectedOrder,
  }
}

describe('useShopOrderPersistence', () => {
  beforeEach(() => {
    updateShopOrderRecordMock.mockReset()
    updateShopOrderRecordMock.mockResolvedValue(undefined)
  })

  it('persists metadata with the current actor and reports success', async () => {
    const { actionErrors, actionInfos, persistence } = mountPersistence()

    await expect(persistence.persistOrderMeta('order-1', {
      comments: 'Updated delivery note',
      deliveryDate: '2026-07-23',
    })).resolves.toBe(true)

    expect(updateShopOrderRecordMock).toHaveBeenCalledWith(
      'order-1',
      {
        comments: 'Updated delivery note',
        deliveryDate: '2026-07-23',
      },
      { userId: 'user-1', displayName: 'CJ Blanchard' },
    )
    expect(actionErrors).toContain('')
    expect(actionInfos).toContain('Order details saved.')
  })

  it('reports metadata save failures without leaving the loading state stuck', async () => {
    updateShopOrderRecordMock.mockRejectedValueOnce(new Error('No write access'))
    const { actionErrors, actionInfos, itemActionLoading, persistence } = mountPersistence()

    await expect(persistence.persistOrderMeta('order-1', {
      comments: 'Updated delivery note',
      deliveryDate: '2026-07-23',
    })).resolves.toBe(false)

    expect(actionErrors).toContain('No write access')
    expect(actionInfos).toContain('')
    expect(itemActionLoading.value).toBe(false)
  })

  it('clones selected-order items in display order without mutating the selected order', () => {
    const selectedOrder = makeOrder({
      items: [
        makeItem({ id: 'item-z', description: 'Zebra Tape', quantity: 2 }),
        makeItem({ id: 'item-a', description: './ *Start Up / AHA Book', quantity: 1 }),
      ],
    })
    const { persistence } = mountPersistence({ selectedOrder })

    const clonedItems = persistence.cloneOrderItems()

    expect(clonedItems.map((item) => item.id)).toEqual(['item-a', 'item-z'])
    expect(clonedItems[0]).not.toBe(selectedOrder.items[1])
  })

  it('optimistically replaces selected order items in sorted order before persisting', async () => {
    const { actionInfos, persistence, replacedOrders } = mountPersistence()
    const nextItems = [
      makeItem({ id: 'item-z', description: 'Zebra Tape', quantity: 2 }),
      makeItem({ id: 'item-a', description: 'AHA Book', quantity: 1 }),
    ]

    await expect(persistence.persistOrderItems('order-1', nextItems, 'Items saved.')).resolves.toBe(true)

    expect(replacedOrders).toHaveLength(1)
    const optimisticOrder = replacedOrders[0]
    expect(optimisticOrder).toBeDefined()
    expect(optimisticOrder!.items.map((item) => item.id)).toEqual(['item-a', 'item-z'])
    expect(updateShopOrderRecordMock).toHaveBeenCalledWith(
      'order-1',
      { items: expect.arrayContaining([expect.objectContaining({ id: 'item-a' })]) },
      { userId: 'user-1', displayName: 'CJ Blanchard' },
    )
    expect(actionInfos).toContain('Items saved.')
  })

  it('rolls back the optimistic selected-order item update when persistence fails', async () => {
    updateShopOrderRecordMock.mockRejectedValueOnce(new Error('Network down'))
    const originalOrder = makeOrder({
      items: [makeItem({ id: 'original-item', description: 'Original Item' })],
    })
    const { actionErrors, actionInfos, persistence, replacedOrders, selectedOrder } = mountPersistence({
      selectedOrder: originalOrder,
    })

    await expect(persistence.persistOrderItems(
      'order-1',
      [makeItem({ id: 'next-item', description: 'Next Item' })],
      'Items saved.',
    )).resolves.toBe(false)

    expect(replacedOrders.map((order) => order.items.map((item) => item.id))).toEqual([
      ['next-item'],
      ['original-item'],
    ])
    expect(selectedOrder.value?.items.map((item) => item.id)).toEqual(['original-item'])
    expect(actionErrors).toContain('Network down')
    expect(actionInfos).toContain('')
  })

  it('serializes item persistence calls so later saves wait for earlier saves', async () => {
    const firstSave = makeDeferred()
    const secondSave = makeDeferred()
    updateShopOrderRecordMock
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise)

    const { itemActionLoading, persistence } = mountPersistence()
    const firstPromise = persistence.persistOrderItems(
      'order-1',
      [makeItem({ id: 'first-item', description: 'First Item' })],
      'First saved.',
    )
    await flushPromises()

    expect(updateShopOrderRecordMock).toHaveBeenCalledTimes(1)
    expect(itemActionLoading.value).toBe(true)

    const secondPromise = persistence.persistOrderItems(
      'order-1',
      [makeItem({ id: 'second-item', description: 'Second Item' })],
      'Second saved.',
    )
    await flushPromises()

    expect(updateShopOrderRecordMock).toHaveBeenCalledTimes(1)

    firstSave.resolve()
    await flushPromises()

    expect(updateShopOrderRecordMock).toHaveBeenCalledTimes(2)
    expect(itemActionLoading.value).toBe(true)

    secondSave.resolve()

    await expect(firstPromise).resolves.toBe(true)
    await expect(secondPromise).resolves.toBe(true)
    expect(itemActionLoading.value).toBe(false)
  })

  it('blocks item persistence when no order id is available', async () => {
    const { actionErrors, actionInfos, persistence } = mountPersistence()

    await expect(persistence.persistOrderItems('', [makeItem()], 'Items saved.')).resolves.toBe(false)

    expect(updateShopOrderRecordMock).not.toHaveBeenCalled()
    expect(actionErrors).toContain('Start an order before changing items.')
    expect(actionInfos).toContain('')
  })
})
