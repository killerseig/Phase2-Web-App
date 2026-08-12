import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderItemNotes } from '@/features/shopOrders/useShopOrderItemNotes'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    catalogItemId: 'catalog-1',
    categoryId: 'category-tools',
    description: 'AHA Book',
    id: 'item-1',
    note: '',
    price: null,
    quantity: 1,
    sku: null,
    sourceType: 'catalog',
    ...overrides,
  }
}

function makeOrder(overrides: Partial<ShopOrderRecord> = {}): ShopOrderRecord {
  return {
    comments: '',
    deliveryDate: '2026-06-11',
    foremanName: 'CJ Blanchard',
    foremanUserId: 'user-cj',
    id: 'order-1',
    items: [makeItem()],
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    status: 'draft',
    ...overrides,
  }
}

function cloneItems(order?: ShopOrderRecord | null) {
  return (order?.items ?? []).map((item) => ({ ...item }))
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    reject,
    resolve,
  }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('useShopOrderItemNotes', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncs note drafts from the selected order and clears them when no order is selected', () => {
    const selectedOrder = ref<ShopOrderRecord | null>(makeOrder({
      items: [
        makeItem({ id: 'item-1', note: 'box' }),
        makeItem({ description: 'Foreman Book', id: 'item-2', note: 'shelf' }),
      ],
    }))
    const notes = useShopOrderItemNotes({
      cloneOrderItems: cloneItems,
      persistOrderItems: vi.fn(),
      selectedOrder: computed(() => selectedOrder.value),
    })

    notes.syncOrderItemNoteDrafts(selectedOrder.value)

    expect({ ...notes.orderItemNoteDrafts }).toEqual({
      'item-1': 'box',
      'item-2': 'shelf',
    })

    notes.orderItemNoteDrafts['stale-item'] = 'remove me'
    selectedOrder.value = null
    notes.syncOrderItemNoteDrafts(selectedOrder.value)

    expect({ ...notes.orderItemNoteDrafts }).toEqual({})
  })

  it('debounces draft note saves while the user is typing', async () => {
    vi.useFakeTimers()

    const selectedOrder = ref<ShopOrderRecord | null>(makeOrder())
    const persistOrderItems = vi.fn().mockResolvedValue(true)
    const notes = useShopOrderItemNotes({
      cloneOrderItems: cloneItems,
      persistOrderItems,
      selectedOrder: computed(() => selectedOrder.value),
    })

    notes.handleOrderItemNoteInput('item-1', '100 blades total')

    expect(notes.orderItemNoteDrafts['item-1']).toBe('100 blades total')
    expect(persistOrderItems).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(699)
    expect(persistOrderItems).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(persistOrderItems).toHaveBeenCalledTimes(1)
    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [makeItem({ note: '100 blades total' })],
      'Order note updated.',
    )
  })

  it('flushes the current note on blur and prevents the old debounce from saving twice', async () => {
    vi.useFakeTimers()

    const selectedOrder = ref<ShopOrderRecord | null>(makeOrder())
    const persistOrderItems = vi.fn().mockResolvedValue(true)
    const notes = useShopOrderItemNotes({
      cloneOrderItems: cloneItems,
      persistOrderItems,
      selectedOrder: computed(() => selectedOrder.value),
    })

    notes.handleOrderItemNoteInput('item-1', 'deliver upstairs')
    await notes.handleOrderItemNoteBlur('item-1')
    await vi.runOnlyPendingTimersAsync()

    expect(persistOrderItems).toHaveBeenCalledTimes(1)
    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [makeItem({ note: 'deliver upstairs' })],
      'Order note updated.',
    )
  })

  it('does not persist unchanged notes or submitted-order note edits', async () => {
    vi.useFakeTimers()

    const selectedOrder = ref<ShopOrderRecord | null>(makeOrder({
      items: [makeItem({ note: 'same note' })],
    }))
    const persistOrderItems = vi.fn().mockResolvedValue(true)
    const notes = useShopOrderItemNotes({
      cloneOrderItems: cloneItems,
      persistOrderItems,
      selectedOrder: computed(() => selectedOrder.value),
    })

    notes.handleOrderItemNoteInput('item-1', '  same note  ')
    await vi.advanceTimersByTimeAsync(700)

    expect(persistOrderItems).not.toHaveBeenCalled()

    selectedOrder.value = makeOrder({
      items: [makeItem({ id: 'submitted-item', note: 'locked' })],
      status: 'submitted',
    })
    notes.handleOrderItemNoteInput('submitted-item', 'should not save')
    await vi.advanceTimersByTimeAsync(700)

    expect(notes.orderItemNoteDrafts['submitted-item']).toBeUndefined()
    expect(persistOrderItems).not.toHaveBeenCalled()
  })

  it('queues another save when the note changes while an earlier save is still pending', async () => {
    vi.useFakeTimers()

    const selectedOrder = ref<ShopOrderRecord | null>(makeOrder())
    const firstSave = createDeferred<boolean>()
    const persistOrderItems = vi.fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue(true)
    const notes = useShopOrderItemNotes({
      cloneOrderItems: cloneItems,
      persistOrderItems,
      selectedOrder: computed(() => selectedOrder.value),
    })

    notes.handleOrderItemNoteInput('item-1', 'first note')
    await vi.advanceTimersByTimeAsync(700)

    expect(persistOrderItems).toHaveBeenCalledTimes(1)
    expect(persistOrderItems).toHaveBeenLastCalledWith(
      'order-1',
      [makeItem({ note: 'first note' })],
      'Order note updated.',
    )

    notes.handleOrderItemNoteInput('item-1', 'second note')
    await vi.advanceTimersByTimeAsync(700)

    expect(persistOrderItems).toHaveBeenCalledTimes(1)

    firstSave.resolve(true)
    await flushPromises()

    expect(persistOrderItems).toHaveBeenCalledTimes(2)
    expect(persistOrderItems).toHaveBeenLastCalledWith(
      'order-1',
      [makeItem({ note: 'second note' })],
      'Order note updated.',
    )
  })
})
