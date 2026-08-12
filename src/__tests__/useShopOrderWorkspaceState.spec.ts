import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useShopOrderWorkspaceState } from '@/features/shopOrders/useShopOrderWorkspaceState'
import type {
  JobRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    name: 'Shop',
    code: '736',
    gc: 'Phase 2',
    type: 'general',
    active: true,
    assignedForemanIds: [],
    ...overrides,
  }
}

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    id: 'category-1',
    name: 'Adhesive',
    parentId: null,
    active: true,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'AHA Book',
    quantity: 1,
    price: 12.5,
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

function mountWorkspaceState(options: {
  categories?: ShopCategoryRecord[]
  createOrderLoading?: boolean
  itemActionLoading?: boolean
  job?: JobRecord | null
  jobId?: string | null
  orders?: ShopOrderRecord[]
  selectedOrderId?: string | null
} = {}) {
  const categories = ref(options.categories ?? [makeCategory()])
  const createOrderLoading = ref(options.createOrderLoading ?? false)
  const itemActionLoading = ref(options.itemActionLoading ?? false)
  const job = ref<JobRecord | null>(options.job ?? makeJob())
  const jobId = ref<string | null>(options.jobId ?? 'job-1')
  const orders = ref<ShopOrderRecord[]>(options.orders ?? [])
  const selectedOrderId = ref<string | null>(options.selectedOrderId ?? null)

  const state = useShopOrderWorkspaceState({
    categories: computed(() => categories.value),
    createOrderLoading: computed(() => createOrderLoading.value),
    itemActionLoading: computed(() => itemActionLoading.value),
    job: computed(() => job.value),
    jobId: computed(() => jobId.value),
    orders: computed(() => orders.value),
    selectedOrderId: computed(() => selectedOrderId.value),
  })

  return {
    categories,
    createOrderLoading,
    itemActionLoading,
    job,
    jobId,
    orders,
    selectedOrderId,
    state,
  }
}

describe('useShopOrderWorkspaceState', () => {
  it('derives selected order, editable state, order groups, totals, and category lookup', () => {
    const selectedDraft = makeOrder({
      id: 'draft-order',
      items: [
        makeItem({ id: 'item-z', description: 'Zebra Tape', quantity: 2 }),
        makeItem({ id: 'item-a', description: './ *Start Up / AHA Book', quantity: 1 }),
        makeItem({ id: 'item-p', description: 'Adhesive / PL 375 - SINGLE', quantity: null }),
      ],
    })
    const submittedOrder = makeOrder({
      id: 'submitted-order',
      status: 'submitted',
      items: [makeItem({ id: 'submitted-item', quantity: 4 })],
    })
    const { state } = mountWorkspaceState({
      categories: [
        makeCategory({ id: 'category-1', name: 'Adhesive' }),
        makeCategory({ id: 'category-2', name: 'Start Up' }),
      ],
      orders: [submittedOrder, selectedDraft],
      selectedOrderId: 'draft-order',
    })

    expect(state.selectedOrder.value?.id).toBe('draft-order')
    expect(state.canEditSelectedOrder.value).toBe(true)
    expect(state.draftOrders.value.map((order) => order.id)).toEqual(['draft-order'])
    expect(state.submittedOrders.value.map((order) => order.id)).toEqual(['submitted-order'])
    expect(state.orderItemCount.value).toBe(3)
    expect(state.orderEstimatedTotal.value).toBe(37.5)
    expect(state.orderTotalQuantity.value).toBe(3)
    expect(state.sortedSelectedOrderItems.value.map((item) => item.id)).toEqual(['item-a', 'item-p', 'item-z'])
    expect(state.categoriesById.value.get('category-2')?.name).toBe('Start Up')
  })

  it('treats submitted or missing selections as read-only and empty', () => {
    const submittedOrder = makeOrder({ id: 'submitted-order', status: 'submitted' })
    const { selectedOrderId, state } = mountWorkspaceState({
      orders: [submittedOrder],
      selectedOrderId: 'submitted-order',
    })

    expect(state.selectedOrder.value?.id).toBe('submitted-order')
    expect(state.canEditSelectedOrder.value).toBe(false)

    selectedOrderId.value = 'missing-order'

    expect(state.selectedOrder.value).toBeNull()
    expect(state.canEditSelectedOrder.value).toBe(false)
    expect(state.orderItemCount.value).toBe(0)
    expect(state.orderEstimatedTotal.value).toBeNull()
    expect(state.orderTotalQuantity.value).toBe(0)
    expect(state.sortedSelectedOrderItems.value).toEqual([])
  })

  it('disables create/edit inputs while loading or when job context is missing', () => {
    const { createOrderLoading, itemActionLoading, job, jobId, state } = mountWorkspaceState()

    expect(state.orderInputDisabled.value).toBe(false)
    expect(state.orderMutationDisabled.value).toBe(false)

    createOrderLoading.value = true

    expect(state.orderInputDisabled.value).toBe(true)
    expect(state.orderMutationDisabled.value).toBe(true)

    createOrderLoading.value = false
    itemActionLoading.value = true

    expect(state.orderInputDisabled.value).toBe(false)
    expect(state.orderMutationDisabled.value).toBe(true)

    itemActionLoading.value = false
    jobId.value = null

    expect(state.orderInputDisabled.value).toBe(true)
    expect(state.orderMutationDisabled.value).toBe(true)

    jobId.value = 'job-1'
    job.value = null

    expect(state.orderInputDisabled.value).toBe(true)
    expect(state.orderMutationDisabled.value).toBe(true)
  })
})
