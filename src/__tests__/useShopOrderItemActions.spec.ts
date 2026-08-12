import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useShopOrderItemActions } from '@/features/shopOrders/useShopOrderItemActions'
import { useShopOrderCustomItemForm } from '@/features/shopOrders/useShopOrderCustomItemForm'
import { createEmptyCustomItemFormState, type CustomItemFormState } from '@/features/shopOrders/viewHelpers'
import type {
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    id: 'category-1',
    name: 'Adhesive',
    parentId: null,
    active: true,
    ...overrides,
  }
}

function makeCatalogItem(overrides: Partial<ShopCatalogItemRecord> = {}): ShopCatalogItemRecord {
  return {
    id: 'catalog-item-1',
    description: 'PL 375 - Case of 12',
    categoryId: 'category-1',
    sku: 'PL-375',
    price: null,
    active: true,
    ...overrides,
  }
}

function makeOrderItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'order-item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'Adhesive / PL 375 - Case of 12',
    quantity: 1,
    price: 12.5,
    note: '',
    categoryId: 'category-1',
    sku: 'PL-375',
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
    items: [makeOrderItem()],
    ...overrides,
  }
}

function cloneItems(order: ShopOrderRecord) {
  return order.items.map((item) => ({ ...item }))
}

function mountItemActions(options: {
  categories?: ShopCategoryRecord[]
  customItemForm?: Partial<CustomItemFormState>
  ensureTarget?: { orderId: string, items: ShopOrderItemRecord[] } | null
  persistResult?: boolean
  removeItemTargetId?: string | null
  selectedOrder?: ShopOrderRecord | null
  } = {}) {
  const categories = options.categories ?? [makeCategory()]
  const categoriesById = ref(new Map(categories.map((category) => [category.id, category])))
  const { customItemForm, resetCustomItemForm: resetForm } = useShopOrderCustomItemForm()
  Object.assign(customItemForm, options.customItemForm ?? {})
  const resetCustomItemForm = vi.fn(resetForm)
  const selectedOrder = ref<ShopOrderRecord | null>(
    options.selectedOrder === undefined ? makeOrder() : options.selectedOrder,
  )
  const removeItemTargetId = ref<string | null>(options.removeItemTargetId ?? null)
  const actionErrors: string[] = []
  const closeRemoveItemConfirm = vi.fn()
  const ensureDraftOrderTarget = vi.fn<() => Promise<{ orderId: string, items: ShopOrderItemRecord[] } | null>>()
    .mockResolvedValue(options.ensureTarget === undefined
      ? { orderId: 'order-1', items: [] }
      : options.ensureTarget)
  const persistOrderItems = vi.fn<(
    orderId: string,
    items: ShopOrderItemRecord[],
    successMessage: string,
  ) => Promise<boolean>>().mockResolvedValue(options.persistResult ?? true)

  const actions = useShopOrderItemActions({
    categoriesById: computed(() => categoriesById.value),
    cloneOrderItems: cloneItems,
    closeRemoveItemConfirm,
    customItemForm,
    ensureDraftOrderTarget,
    persistOrderItems,
    removeItemTargetId: computed(() => removeItemTargetId.value),
    resetCustomItemForm,
    selectedOrder: computed(() => selectedOrder.value),
    setActionError: (message) => {
      actionErrors.push(message)
    },
  })

  return {
    actionErrors,
    actions,
    categoriesById,
    closeRemoveItemConfirm,
    customItemForm,
    ensureDraftOrderTarget,
    persistOrderItems,
    removeItemTargetId,
    resetCustomItemForm,
    selectedOrder,
  }
}

describe('useShopOrderItemActions', () => {
  it('adds catalog items with category-path descriptions and normalized quantities', async () => {
    const { actions, persistOrderItems } = mountItemActions({
      categories: [
        makeCategory({ id: 'parent-category', name: 'Top Level', parentId: null }),
        makeCategory({ id: 'category-1', name: 'Adhesive', parentId: 'parent-category' }),
      ],
      ensureTarget: { orderId: 'order-1', items: [] },
    })

    await expect(actions.addCatalogItemToOrder(makeCatalogItem({ price: 42.5 }), 2.4)).resolves.toBe(true)

    expect(persistOrderItems).toHaveBeenCalledTimes(1)
    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [
        expect.objectContaining({
          catalogItemId: 'catalog-item-1',
          categoryId: 'category-1',
          description: 'Top Level / Adhesive / PL 375 - Case of 12',
          price: 42.5,
          quantity: 2,
          sourceType: 'catalog',
          sku: 'PL-375',
        }),
      ],
      'Top Level / Adhesive / PL 375 - Case of 12 added to the current order.',
    )
  })

  it('merges repeated catalog items instead of adding duplicate rows', async () => {
    const existingItem = makeOrderItem({ quantity: 3 })
    const { actions, persistOrderItems } = mountItemActions({
      ensureTarget: { orderId: 'order-1', items: [existingItem] },
    })

    await actions.addCatalogItemToOrder(makeCatalogItem(), 4)

    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [
        expect.objectContaining({
          catalogItemId: 'catalog-item-1',
          quantity: 7,
        }),
      ],
      'Adhesive / PL 375 - Case of 12 added to the current order.',
    )
  })

  it('adds custom items to the same item list and resets the custom form after a save', async () => {
    const {
      actions,
      customItemForm,
      persistOrderItems,
      resetCustomItemForm,
    } = mountItemActions({
      customItemForm: {
        description: '  Bottled water  ',
        note: '  100 bottles total  ',
        quantity: '5',
      },
      ensureTarget: { orderId: 'order-1', items: [makeOrderItem()] },
    })

    await actions.addCustomItemToOrder()

    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [
        expect.objectContaining({ sourceType: 'catalog' }),
        expect.objectContaining({
          catalogItemId: null,
          categoryId: null,
          description: 'Bottled water',
          note: '100 bottles total',
          price: null,
          quantity: 5,
          sourceType: 'custom',
          sku: null,
        }),
      ],
      'Custom item added to the current order.',
    )
    expect(resetCustomItemForm).toHaveBeenCalledTimes(1)
    expect(customItemForm).toEqual(createEmptyCustomItemFormState())
  })

  it('keeps invalid custom items local and preserves form text when save fails', async () => {
    const invalid = mountItemActions({
      customItemForm: { description: '   ', quantity: '2' },
    })

    await invalid.actions.addCustomItemToOrder()

    expect(invalid.actionErrors).toEqual(['Enter a description for the custom item.'])
    expect(invalid.persistOrderItems).not.toHaveBeenCalled()

    const failed = mountItemActions({
      customItemForm: { description: 'Bottled water', quantity: '2' },
      persistResult: false,
    })

    await failed.actions.addCustomItemToOrder()

    expect(failed.customItemForm.description).toBe('Bottled water')
    expect(failed.customItemForm.quantity).toBe('2')
    expect(failed.resetCustomItemForm).not.toHaveBeenCalled()
  })

  it('updates quantities only for draft selected orders', async () => {
    const draftOrder = makeOrder({ items: [makeOrderItem({ id: 'target-item', quantity: 8 })] })
    const { actions, persistOrderItems, selectedOrder } = mountItemActions({
      selectedOrder: draftOrder,
    })

    await actions.updateOrderItemQuantity('target-item', 'bad-number')

    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [expect.objectContaining({ id: 'target-item', quantity: 1 })],
      'Order quantity updated.',
    )

    selectedOrder.value = makeOrder({
      id: 'submitted-order',
      status: 'submitted',
      items: [makeOrderItem({ id: 'target-item', quantity: 8 })],
    })

    await actions.updateOrderItemQuantity('target-item', '6')

    expect(persistOrderItems).toHaveBeenCalledTimes(1)
  })

  it('removes draft items and always closes the confirmation dialog', async () => {
    const { actions, closeRemoveItemConfirm, persistOrderItems } = mountItemActions({
      removeItemTargetId: 'remove-me',
      selectedOrder: makeOrder({
        items: [
          makeOrderItem({ id: 'keep-me', description: 'AHA Book' }),
          makeOrderItem({ id: 'remove-me', description: 'Foreman Book' }),
        ],
      }),
    })

    await actions.confirmRemoveOrderItem()

    expect(persistOrderItems).toHaveBeenCalledWith(
      'order-1',
      [expect.objectContaining({ id: 'keep-me' })],
      'Order item removed.',
    )
    expect(closeRemoveItemConfirm).toHaveBeenCalledTimes(1)

    const readOnly = mountItemActions({
      removeItemTargetId: 'remove-me',
      selectedOrder: makeOrder({ status: 'submitted' }),
    })

    await readOnly.actions.confirmRemoveOrderItem()

    expect(readOnly.persistOrderItems).not.toHaveBeenCalled()
    expect(readOnly.closeRemoveItemConfirm).toHaveBeenCalledTimes(1)
  })
})
