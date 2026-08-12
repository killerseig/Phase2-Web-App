import { computed, effectScope, nextTick, reactive, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderSelectionSync } from '@/features/shopOrders/useShopOrderSelectionSync'
import { getNextShopOrderSelectionId, type OrderMetaFormState } from '@/features/shopOrders/viewHelpers'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

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
    comments: 'Initial comments',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [makeItem()],
    ...overrides,
  }
}

let activeScope: EffectScope | null = null

function mountSelectionSync(options: {
  ensureFreshDraftDeliveryDate?: (order: ShopOrderRecord | null) => boolean
  hasSelectedOrderChanged?: (
    order: ShopOrderRecord,
    previousOrder: ShopOrderRecord | null,
  ) => boolean
  orders?: ShopOrderRecord[]
  selectedOrderId?: string | null
  shouldHydrateSelectedOrder?: (
    order: ShopOrderRecord,
    previousOrder: ShopOrderRecord | null,
  ) => boolean
} = {}) {
  activeScope?.stop()
  activeScope = effectScope()

  const orders = ref<ShopOrderRecord[]>(options.orders ?? [])
  const selectedOrderId = ref<string | null>(options.selectedOrderId ?? null)
  const selectedOrder = computed(() => orders.value.find((order) => order.id === selectedOrderId.value) ?? null)
  const orderMetaForm = reactive<OrderMetaFormState>({
    comments: '',
    deliveryDate: '2026-07-16',
  })

  const applySelectedOrderToForm = vi.fn()
  const clearOrderItemNoteDrafts = vi.fn()
  const clearOrderMetaSaveTimer = vi.fn()
  const ensureFreshDraftDeliveryDate = vi.fn(options.ensureFreshDraftDeliveryDate ?? (() => false))
  const hasSelectedOrderChanged = vi.fn(options.hasSelectedOrderChanged ?? (
    (order: ShopOrderRecord, previousOrder: ShopOrderRecord | null) => order.id !== previousOrder?.id
  ))
  const queueOrderMetaSave = vi.fn()
  const shouldHydrateSelectedOrder = vi.fn(options.shouldHydrateSelectedOrder ?? (() => true))
  const syncOrderItemNoteDrafts = vi.fn()
  let selectOrder: (orderId: string) => void = () => {}

  activeScope.run(() => {
    const actions = useShopOrderSelectionSync({
      applySelectedOrderToForm,
      clearOrderItemNoteDrafts,
      clearOrderMetaSaveTimer,
      ensureFreshDraftDeliveryDate,
      hasSelectedOrderChanged,
      orderMetaForm,
      orders,
      queueOrderMetaSave,
      selectedOrder,
      selectedOrderId,
      shouldHydrateSelectedOrder,
      syncOrderItemNoteDrafts,
    })

    selectOrder = actions.selectOrder
  })

  return {
    applySelectedOrderToForm,
    clearOrderItemNoteDrafts,
    clearOrderMetaSaveTimer,
    ensureFreshDraftDeliveryDate,
    hasSelectedOrderChanged,
    orderMetaForm,
    orders,
    queueOrderMetaSave,
    selectedOrder,
    selectedOrderId,
    selectOrder,
    shouldHydrateSelectedOrder,
    syncOrderItemNoteDrafts,
  }
}

afterEach(() => {
  activeScope?.stop()
  activeScope = null
})

describe('useShopOrderSelectionSync', () => {
  it('resolves the next selected order id without creating or mutating orders', () => {
    const firstOrder = makeOrder({ id: 'order-a' })
    const selected = makeOrder({ id: 'order-b' })

    expect(getNextShopOrderSelectionId([firstOrder, selected], 'order-b')).toBe('order-b')
    expect(getNextShopOrderSelectionId([firstOrder], 'order-b')).toBe('order-a')
    expect(getNextShopOrderSelectionId([], 'order-b')).toBeNull()
    expect(getNextShopOrderSelectionId([firstOrder], null)).toBe('order-a')
    expect(getNextShopOrderSelectionId([
      makeOrder({ id: 'submitted-order', status: 'submitted' }),
    ], null)).toBeNull()
  })

  it('selects the first draft order when no current selection exists', async () => {
    const firstOrder = makeOrder({ id: 'order-a', status: 'submitted' })
    const secondOrder = makeOrder({ id: 'order-b', status: 'draft' })
    const { selectedOrderId } = mountSelectionSync({
      orders: [firstOrder, secondOrder],
    })

    await nextTick()

    expect(selectedOrderId.value).toBe('order-b')
  })

  it('leaves the workspace blank when only submitted orders exist and nothing is selected', async () => {
    const submittedOrder = makeOrder({ id: 'order-a', status: 'submitted' })
    const { selectedOrderId } = mountSelectionSync({
      orders: [submittedOrder],
    })

    await nextTick()

    expect(selectedOrderId.value).toBeNull()
  })

  it('preserves the current selection while it still exists and falls back when it disappears', async () => {
    const firstOrder = makeOrder({ id: 'order-a' })
    const selected = makeOrder({ id: 'order-b' })
    const { orders, selectedOrderId } = mountSelectionSync({
      orders: [firstOrder, selected],
      selectedOrderId: 'order-b',
    })

    await nextTick()

    expect(selectedOrderId.value).toBe('order-b')

    orders.value = [firstOrder]
    await nextTick()

    expect(selectedOrderId.value).toBe('order-a')

    orders.value = []
    await nextTick()

    expect(selectedOrderId.value).toBeNull()
  })

  it('clears timers, note drafts, and form state when no order is selected', async () => {
    const {
      applySelectedOrderToForm,
      clearOrderItemNoteDrafts,
      clearOrderMetaSaveTimer,
    } = mountSelectionSync()

    await nextTick()

    expect(clearOrderMetaSaveTimer).toHaveBeenCalledTimes(1)
    expect(clearOrderItemNoteDrafts).toHaveBeenCalledTimes(1)
    expect(applySelectedOrderToForm).toHaveBeenCalledWith(null)
  })

  it('fully resets metadata and note drafts when the selected order changes', async () => {
    const firstOrder = makeOrder({ id: 'order-a' })
    const secondOrder = makeOrder({ id: 'order-b' })
    const {
      applySelectedOrderToForm,
      clearOrderItemNoteDrafts,
      clearOrderMetaSaveTimer,
      selectedOrderId,
      syncOrderItemNoteDrafts,
    } = mountSelectionSync({
      orders: [firstOrder, secondOrder],
      selectedOrderId: 'order-a',
    })

    await nextTick()
    vi.clearAllMocks()

    selectedOrderId.value = 'order-b'
    await nextTick()

    expect(clearOrderMetaSaveTimer).toHaveBeenCalledTimes(1)
    expect(clearOrderItemNoteDrafts).toHaveBeenCalledTimes(1)
    expect(applySelectedOrderToForm).toHaveBeenCalledWith(secondOrder)
    expect(syncOrderItemNoteDrafts).toHaveBeenCalledWith(secondOrder, true)
  })

  it('queues a metadata save when selection hydration refreshes a stale draft delivery date', async () => {
    const draftOrder = makeOrder({ id: 'order-a', deliveryDate: '2026-06-03' })
    const {
      applySelectedOrderToForm,
      ensureFreshDraftDeliveryDate,
      queueOrderMetaSave,
    } = mountSelectionSync({
      ensureFreshDraftDeliveryDate: () => true,
      orders: [draftOrder],
      selectedOrderId: 'order-a',
    })

    await nextTick()

    expect(applySelectedOrderToForm).toHaveBeenCalledWith(draftOrder)
    expect(ensureFreshDraftDeliveryDate).toHaveBeenCalledWith(draftOrder)
    expect(queueOrderMetaSave).toHaveBeenCalledTimes(1)
  })

  it('selects a history order through the shared selection action', async () => {
    const firstOrder = makeOrder({ id: 'order-a' })
    const secondOrder = makeOrder({ id: 'order-b' })
    const { selectedOrderId, selectOrder } = mountSelectionSync({
      orders: [firstOrder, secondOrder],
      selectedOrderId: 'order-a',
    })

    await nextTick()

    selectOrder?.('order-b')
    await nextTick()

    expect(selectedOrderId.value).toBe('order-b')
  })

  it('syncs item note drafts and hydrates clean metadata for same-order remote updates', async () => {
    const firstOrder = makeOrder({ id: 'order-a', comments: 'Original comment' })
    const updatedOrder = makeOrder({ id: 'order-a', comments: 'Remote comment' })
    const {
      applySelectedOrderToForm,
      orders,
      shouldHydrateSelectedOrder,
      syncOrderItemNoteDrafts,
    } = mountSelectionSync({
      hasSelectedOrderChanged: () => false,
      orders: [firstOrder],
      selectedOrderId: 'order-a',
      shouldHydrateSelectedOrder: () => true,
    })

    await nextTick()
    vi.clearAllMocks()

    orders.value = [updatedOrder]
    await nextTick()

    expect(syncOrderItemNoteDrafts).toHaveBeenCalledWith(updatedOrder)
    expect(shouldHydrateSelectedOrder).toHaveBeenCalledWith(updatedOrder, firstOrder)
    expect(applySelectedOrderToForm).toHaveBeenCalledWith(updatedOrder)
  })

  it('keeps dirty local metadata when same-order remote updates should not hydrate', async () => {
    const firstOrder = makeOrder({ id: 'order-a', comments: 'Original comment' })
    const updatedOrder = makeOrder({ id: 'order-a', comments: 'Stale remote echo' })
    const {
      applySelectedOrderToForm,
      orders,
      shouldHydrateSelectedOrder,
      syncOrderItemNoteDrafts,
    } = mountSelectionSync({
      hasSelectedOrderChanged: () => false,
      orders: [firstOrder],
      selectedOrderId: 'order-a',
      shouldHydrateSelectedOrder: () => false,
    })

    await nextTick()
    vi.clearAllMocks()

    orders.value = [updatedOrder]
    await nextTick()

    expect(syncOrderItemNoteDrafts).toHaveBeenCalledWith(updatedOrder)
    expect(shouldHydrateSelectedOrder).toHaveBeenCalledWith(updatedOrder, firstOrder)
    expect(applySelectedOrderToForm).not.toHaveBeenCalled()
  })

  it('queues metadata saves when the local metadata form changes', async () => {
    const { orderMetaForm, queueOrderMetaSave } = mountSelectionSync({
      orders: [makeOrder({ id: 'order-a' })],
      selectedOrderId: 'order-a',
    })

    await nextTick()
    vi.clearAllMocks()

    orderMetaForm.comments = 'User typed a new comment'
    await nextTick()

    expect(queueOrderMetaSave).toHaveBeenCalledTimes(1)
  })
})
