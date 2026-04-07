import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useShopOrderMutations } from '@/composables/shopOrders/useShopOrderMutations'
import type { ShopOrder } from '@/services'

const {
  createShopOrderMock,
  deleteShopOrderMock,
  sendShopOrderEmailMock,
  updateShopOrderItemsMock,
  updateShopOrderStatusMock,
} = vi.hoisted(() => ({
  createShopOrderMock: vi.fn(),
  deleteShopOrderMock: vi.fn(),
  sendShopOrderEmailMock: vi.fn(),
  updateShopOrderItemsMock: vi.fn(),
  updateShopOrderStatusMock: vi.fn(),
}))

vi.mock('@/services', () => ({
  createShopOrder: createShopOrderMock,
  deleteShopOrder: deleteShopOrderMock,
  sendShopOrderEmail: sendShopOrderEmailMock,
  updateShopOrderItems: updateShopOrderItemsMock,
  updateShopOrderStatus: updateShopOrderStatusMock,
}))

function createOrder(overrides: Partial<ShopOrder> = {}): ShopOrder {
  return {
    id: overrides.id ?? 'order-1',
    jobId: overrides.jobId ?? 'job-1',
    uid: overrides.uid ?? 'scope:employee',
    ownerUid: overrides.ownerUid ?? 'user-1',
    status: overrides.status ?? 'draft',
    items: overrides.items ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

function createHarness(order = createOrder()) {
  const orders = ref<ShopOrder[]>([order])
  const selectedId = ref<string | null>(order.id)
  const selected = computed(() => orders.value.find((entry) => entry.id === selectedId.value) ?? null)
  const toast = { show: vi.fn() }
  const confirm = vi.fn().mockResolvedValue(true)

  const mutations = useShopOrderMutations({
    jobId: computed(() => 'job-1'),
    orders,
    selected,
    selectedId,
    shopOrderRecipients: ref<string[]>(['ops@example.com']),
    toast,
    confirm,
  })

  return {
    orders,
    selected,
    selectedId,
    toast,
    confirm,
    mutations,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useShopOrderMutations', () => {
  it('adds a catalog item using the browser quantity fallback and resets the browser quantity back to 1', async () => {
    updateShopOrderItemsMock.mockResolvedValue(undefined)
    const { selected, mutations, toast } = createHarness()

    mutations.catalogItemQtys.value['catalog-1'] = 3

    mutations.selectCatalogItem({
      id: 'catalog-1',
      description: 'Outrigger',
      quantity: 0,
    })

    await flushPromises()

    expect(selected.value?.items).toEqual([
      { description: 'Outrigger', quantity: 3, catalogItemId: 'catalog-1' },
    ])
    expect(updateShopOrderItemsMock).toHaveBeenCalledWith('job-1', 'order-1', [
      { description: 'Outrigger', quantity: 3, catalogItemId: 'catalog-1' },
    ])
    expect(mutations.catalogItemQtys.value['catalog-1']).toBe(1)
    expect(mutations.newItemDescription.value).toBe('')
    expect(toast.show).toHaveBeenCalledWith('Item added successfully', 'success')
  })

  it('restores the draft inputs and items when optimistic add persistence fails', async () => {
    updateShopOrderItemsMock.mockRejectedValueOnce(new Error('network down'))
    const { selected, mutations, toast } = createHarness()

    mutations.newItemDescription.value = 'Outrigger'
    mutations.newItemQty.value = '2'
    mutations.newItemNote.value = 'Rush'

    await mutations.addItem()

    expect(selected.value?.items).toEqual([])
    expect(mutations.newItemDescription.value).toBe('Outrigger')
    expect(mutations.newItemQty.value).toBe('2')
    expect(mutations.newItemNote.value).toBe('Rush')
    expect(toast.show).toHaveBeenCalledWith('Failed to add item: network down', 'error')
  })

  it('restores deleted items when optimistic delete persistence fails', async () => {
    updateShopOrderItemsMock.mockRejectedValueOnce(new Error('delete failed'))
    const { selected, mutations, toast } = createHarness(createOrder({
      items: [{ description: 'Outrigger', quantity: 2 }],
    }))

    await mutations.handleDeleteSelectedItem(0)

    expect(selected.value?.items).toEqual([{ description: 'Outrigger', quantity: 2 }])
    expect(toast.show).toHaveBeenCalledWith('Failed to delete item: delete failed', 'error')
  })

  it('confirms before deleting an order and clears the deleting state when finished', async () => {
    let resolveDelete!: () => void
    deleteShopOrderMock.mockReturnValue(new Promise<void>((resolve) => {
      resolveDelete = resolve
    }))

    const { mutations, confirm, toast } = createHarness()

    const deleting = mutations.handleDeleteOrder('order-1')
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith('Delete this draft order?', {
      title: 'Delete Order',
      confirmText: 'Delete',
      variant: 'danger',
    })
    expect(mutations.deletingOrderId.value).toBe('order-1')

    resolveDelete()
    await deleting

    expect(deleteShopOrderMock).toHaveBeenCalledWith('job-1', 'order-1')
    expect(mutations.deletingOrderId.value).toBeNull()
    expect(toast.show).toHaveBeenCalledWith('Order deleted', 'success')
  })

  it('emails the selected order and updates its status', async () => {
    sendShopOrderEmailMock.mockResolvedValue(undefined)
    updateShopOrderStatusMock.mockResolvedValue(undefined)

    const { mutations, toast } = createHarness(createOrder({
      status: 'draft',
      items: [{ description: 'Outrigger', quantity: 2 }],
    }))

    await mutations.sendOrderEmail()

    expect(sendShopOrderEmailMock).toHaveBeenCalledWith('job-1', 'order-1', ['ops@example.com'])
    expect(updateShopOrderStatusMock).toHaveBeenCalledWith('job-1', 'order-1', 'order')
    expect(mutations.sendingEmail.value).toBe(false)
    expect(toast.show).toHaveBeenCalledWith('Order emailed successfully', 'success')
  })
})
