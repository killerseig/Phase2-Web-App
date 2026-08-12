import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderMetaForm } from '@/features/shopOrders/useShopOrderMetaForm'
import type { OrderMetaFormState } from '@/features/shopOrders/viewHelpers'
import type { ShopOrderRecord } from '@/types/domain'

function makeOrder(overrides: Partial<ShopOrderRecord> = {}): ShopOrderRecord {
  return {
    id: 'order-1',
    jobId: 'job-1',
    jobCode: '736',
    jobName: 'Shop',
    orderNumber: '202607150001',
    deliveryDate: '2026-06-11',
    status: 'draft',
    comments: 'Initial comments',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [],
    ...overrides,
  }
}

function mountMetaForm(options: {
  canEdit?: boolean
  selectedOrder?: ShopOrderRecord | null
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const selectedOrder = ref<ShopOrderRecord | null>(
    options.selectedOrder === undefined ? makeOrder() : options.selectedOrder,
  )
  const actionErrors: string[] = []
  const actionInfos: string[] = []
  const persistOrderMeta = vi.fn<(
    orderId: string,
    form: OrderMetaFormState,
  ) => Promise<boolean>>().mockResolvedValue(true)

  const metaForm = useShopOrderMetaForm({
    canEditSelectedOrder: computed(() => canEdit.value),
    persistOrderMeta,
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
    canEdit,
    metaForm,
    persistOrderMeta,
    selectedOrder,
  }
}

describe('useShopOrderMetaForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates selected order metadata and resets to default metadata when no order is selected', () => {
    const { actionErrors, metaForm } = mountMetaForm()

    metaForm.applySelectedOrderToForm(makeOrder({
      comments: 'Deliver to south gate',
      deliveryDate: '2026-06-18',
    }))

    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-18')
    expect(metaForm.orderMetaForm.comments).toBe('Deliver to south gate')
    expect(actionErrors).toContain('')

    metaForm.applySelectedOrderToForm(null)

    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-11')
    expect(metaForm.orderMetaForm.comments).toBe('')
  })

  it('protects dirty local metadata from stale remote echoes for the same order', () => {
    const { metaForm } = mountMetaForm()
    const selected = makeOrder({
      comments: 'Initial comments',
      deliveryDate: '2026-06-11',
    })

    metaForm.applySelectedOrderToForm(selected)

    expect(metaForm.shouldHydrateSelectedOrder(
      makeOrder({ comments: 'Remote changed', deliveryDate: '2026-06-11' }),
      selected,
    )).toBe(true)

    metaForm.applySelectedOrderToForm(selected)
    metaForm.orderMetaForm.comments = 'User is still typing here'

    expect(metaForm.shouldHydrateSelectedOrder(
      makeOrder({ comments: 'Older server echo', deliveryDate: '2026-06-11' }),
      selected,
    )).toBe(false)
    expect(metaForm.shouldHydrateSelectedOrder(
      makeOrder({ id: 'order-2', comments: 'Different order' }),
      selected,
    )).toBe(true)
  })

  it('validates delivery date before saving metadata', async () => {
    const { actionErrors, actionInfos, metaForm, persistOrderMeta } = mountMetaForm()

    metaForm.applySelectedOrderToForm(makeOrder())
    metaForm.orderMetaForm.deliveryDate = '2026-06-03'
    metaForm.orderMetaForm.comments = 'Updated comments'

    await expect(metaForm.saveOrderMetaImmediately()).resolves.toBe(false)

    expect(persistOrderMeta).not.toHaveBeenCalled()
    expect(actionErrors).toContain('Delivery date must be today or later.')
    expect(actionInfos).toContain('')
  })

  it('persists changed metadata once and skips unchanged saves after success', async () => {
    const { metaForm, persistOrderMeta } = mountMetaForm()

    metaForm.applySelectedOrderToForm(makeOrder())
    metaForm.orderMetaForm.deliveryDate = '2026-06-18'
    metaForm.orderMetaForm.comments = 'Updated comments'

    await expect(metaForm.saveOrderMetaImmediately()).resolves.toBe(true)

    expect(persistOrderMeta).toHaveBeenCalledTimes(1)
    expect(persistOrderMeta).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        comments: 'Updated comments',
        deliveryDate: '2026-06-18',
      }),
    )

    await expect(metaForm.saveOrderMetaImmediately()).resolves.toBe(true)

    expect(persistOrderMeta).toHaveBeenCalledTimes(1)
  })

  it('debounces queued metadata saves and ignores read-only or unchanged queues', async () => {
    const { canEdit, metaForm, persistOrderMeta } = mountMetaForm()

    metaForm.applySelectedOrderToForm(makeOrder())
    metaForm.queueOrderMetaSave()
    await vi.advanceTimersByTimeAsync(700)

    expect(persistOrderMeta).not.toHaveBeenCalled()

    metaForm.orderMetaForm.comments = 'Queued comments'
    metaForm.queueOrderMetaSave()
    await vi.advanceTimersByTimeAsync(699)

    expect(persistOrderMeta).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(persistOrderMeta).toHaveBeenCalledTimes(1)
    expect(persistOrderMeta).toHaveBeenLastCalledWith(
      'order-1',
      expect.objectContaining({ comments: 'Queued comments' }),
    )

    canEdit.value = false
    metaForm.orderMetaForm.comments = 'Read only change'
    metaForm.queueOrderMetaSave()
    await vi.advanceTimersByTimeAsync(700)

    expect(persistOrderMeta).toHaveBeenCalledTimes(1)
  })

  it('applies next Thursday delivery only while the selected order is editable', () => {
    const { canEdit, metaForm } = mountMetaForm()

    metaForm.applySelectedOrderToForm(makeOrder({ deliveryDate: '2026-06-18' }))
    metaForm.applyThursdayDelivery()

    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-11')

    canEdit.value = false
    metaForm.orderMetaForm.deliveryDate = '2026-06-18'
    metaForm.applyThursdayDelivery()

    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-18')
  })

  it('refreshes stale editable draft delivery dates to the current default', async () => {
    const { metaForm, persistOrderMeta } = mountMetaForm()
    const staleDraft = makeOrder({ deliveryDate: '2026-06-03' })

    metaForm.applySelectedOrderToForm(staleDraft)

    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-03')
    expect(metaForm.ensureFreshDraftDeliveryDate(staleDraft)).toBe(true)
    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-11')

    await expect(metaForm.saveOrderMetaImmediately()).resolves.toBe(true)

    expect(persistOrderMeta).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ deliveryDate: '2026-06-11' }),
    )
  })

  it('does not override unsaved manual delivery date edits while refreshing drafts', () => {
    const { metaForm } = mountMetaForm()
    const staleDraft = makeOrder({ deliveryDate: '2026-06-03' })

    metaForm.applySelectedOrderToForm(staleDraft)
    metaForm.orderMetaForm.deliveryDate = '2026-06-20'

    expect(metaForm.ensureFreshDraftDeliveryDate(staleDraft)).toBe(false)
    expect(metaForm.orderMetaForm.deliveryDate).toBe('2026-06-20')
  })
})
