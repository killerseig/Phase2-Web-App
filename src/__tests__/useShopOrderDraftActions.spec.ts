import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderDraftActions } from '@/features/shopOrders/useShopOrderDraftActions'
import { createShopOrderRecord } from '@/services/shopOrders'
import type { JobRecord, ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

vi.mock('@/services/shopOrders', () => ({
  createShopOrderRecord: vi.fn(),
}))

const createShopOrderRecordMock = vi.mocked(createShopOrderRecord)

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
    deliveryDate: '2026-06-11',
    status: 'draft',
    comments: '',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [makeItem()],
    ...overrides,
  }
}

function mountDraftActions(options: {
  draftOrders?: ShopOrderRecord[]
  job?: JobRecord | null
  jobId?: string | null
  orderDeliveryDate?: string
  selectedOrder?: ShopOrderRecord | null
} = {}) {
  const createOrderLoading = ref(false)
  const draftOrders = ref(options.draftOrders ?? [])
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const orderMetaForm = {
    deliveryDate: options.orderDeliveryDate ?? '2026-06-11',
  }
  const selectedOrder = ref<ShopOrderRecord | null>(
    options.selectedOrder === undefined ? null : options.selectedOrder,
  )
  const selectedOrderId = ref<string | null>(selectedOrder.value?.id ?? null)
  const actionErrors: string[] = []
  const actionInfos: string[] = []
  const cloneOrderItems = vi.fn((order: ShopOrderRecord) => order.items.map((item) => ({ ...item })))

  const actions = useShopOrderDraftActions({
    cloneOrderItems,
    createOrderLoading,
    draftOrders: computed(() => draftOrders.value),
    getForemanName: () => 'CJ Blanchard',
    getForemanUserId: () => 'user-1',
    job: computed(() => job.value),
    jobId: computed(() => jobId.value),
    orderMetaForm,
    selectedOrder: computed(() => selectedOrder.value),
    selectedOrderId,
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
    actions,
    cloneOrderItems,
    createOrderLoading,
    draftOrders,
    job,
    jobId,
    orderMetaForm,
    selectedOrder,
    selectedOrderId,
  }
}

describe('useShopOrderDraftActions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'))
    createShopOrderRecordMock.mockReset()
    createShopOrderRecordMock.mockResolvedValue('created-order')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a draft order with job and foreman context, then selects it', async () => {
    const { actionInfos, actions, createOrderLoading, selectedOrderId } = mountDraftActions()

    await expect(actions.createDraftOrder('New order started.', '2026-06-11')).resolves.toBe('created-order')

    expect(createShopOrderRecordMock).toHaveBeenCalledWith({
      deliveryDate: '2026-06-11',
      foremanName: 'CJ Blanchard',
      foremanUserId: 'user-1',
      jobCode: '736',
      jobId: 'job-1',
      jobName: 'Shop',
    })
    expect(selectedOrderId.value).toBe('created-order')
    expect(actionInfos).toContain('New order started.')
    expect(createOrderLoading.value).toBe(false)
  })

  it('blocks draft creation until a job context and valid delivery date are available', async () => {
    const missingJob = mountDraftActions({ job: null })

    await expect(missingJob.actions.createDraftOrder()).resolves.toBeNull()

    expect(missingJob.actionErrors).toContain('Load the job first before creating a shop order.')
    expect(createShopOrderRecordMock).not.toHaveBeenCalled()

    const invalidDate = mountDraftActions()

    await expect(invalidDate.actions.createDraftOrder(undefined, '2026-06-03')).resolves.toBeNull()

    expect(invalidDate.actionErrors).toContain('Delivery date must be today or later.')
    expect(createShopOrderRecordMock).not.toHaveBeenCalled()
  })

  it('returns the selected draft order target with cloned items when adding items', async () => {
    const selectedDraft = makeOrder({
      id: 'selected-draft',
      items: [makeItem({ id: 'item-a' })],
    })
    const { actions, cloneOrderItems } = mountDraftActions({
      selectedOrder: selectedDraft,
    })

    const target = await actions.ensureDraftOrderTarget()

    expect(target?.orderId).toBe('selected-draft')
    expect(target?.items).toEqual([expect.objectContaining({ id: 'item-a' })])
    expect(target?.items[0]).not.toBe(selectedDraft.items[0])
    expect(cloneOrderItems).toHaveBeenCalledWith(selectedDraft)
  })

  it('selects an existing draft target when the current order is submitted', async () => {
    const existingDraft = makeOrder({
      id: 'existing-draft',
      items: [makeItem({ id: 'draft-item' })],
    })
    const { actions, selectedOrderId } = mountDraftActions({
      draftOrders: [existingDraft],
      selectedOrder: makeOrder({ id: 'submitted-order', status: 'submitted' }),
    })

    const target = await actions.ensureDraftOrderTarget()

    expect(selectedOrderId.value).toBe('existing-draft')
    expect(target).toEqual({
      orderId: 'existing-draft',
      items: [expect.objectContaining({ id: 'draft-item' })],
    })
  })

  it('requires a new draft before adding items when no selected or existing draft is available', async () => {
    const { actionErrors, actions } = mountDraftActions()

    await expect(actions.ensureDraftOrderTarget()).resolves.toBeNull()

    expect(actionErrors).toContain('Create a new order with a delivery date before adding items.')
  })

  it('blocks duplicate new-order requests when a draft is already selected', async () => {
    const { actionErrors, actions } = mountDraftActions({
      selectedOrder: makeOrder({ id: 'active-draft' }),
    })

    await actions.handleCreateOrder()

    expect(actionErrors).toContain('You already have a draft order. Select it or delete it to start a new one.')
    expect(createShopOrderRecordMock).not.toHaveBeenCalled()
  })

  it('starts a new draft with the next Thursday delivery date', async () => {
    const { actions } = mountDraftActions()

    await actions.handleCreateOrder()

    expect(createShopOrderRecordMock).toHaveBeenCalledWith(expect.objectContaining({
      deliveryDate: '2026-06-11',
    }))
  })
})
