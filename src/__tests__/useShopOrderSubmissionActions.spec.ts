import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopOrderSubmissionActions } from '@/features/shopOrders/useShopOrderSubmissionActions'
import {
  deleteShopOrderRecord,
  sendShopOrderSubmissionEmail,
  updateShopOrderRecord,
} from '@/services/shopOrders'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

vi.mock('@/services/shopOrders', () => ({
  deleteShopOrderRecord: vi.fn(),
  sendShopOrderSubmissionEmail: vi.fn(),
  updateShopOrderRecord: vi.fn(),
}))

const deleteShopOrderRecordMock = vi.mocked(deleteShopOrderRecord)
const sendShopOrderSubmissionEmailMock = vi.mocked(sendShopOrderSubmissionEmail)
const updateShopOrderRecordMock = vi.mocked(updateShopOrderRecord)

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
    deliveryDate: '2099-07-16',
    status: 'draft',
    comments: '',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [makeItem()],
    ...overrides,
  }
}

function mountSubmissionActions(options: {
  canEdit?: boolean
  deliveryDate?: string
  metaSaveResult?: boolean
  selectedOrder?: ShopOrderRecord | null
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const itemActionLoading = ref(false)
  const orderMetaForm = {
    deliveryDate: options.deliveryDate ?? '2099-07-16',
  }
  const selectedOrder = ref<ShopOrderRecord | null>(
    options.selectedOrder === undefined ? makeOrder() : options.selectedOrder,
  )
  const selectedOrderId = ref<string | null>(selectedOrder.value?.id ?? null)
  const actionErrors: string[] = []
  const actionInfos: string[] = []
  const clearOrderMetaSaveTimer = vi.fn()
  const closeDeleteDraftConfirm = vi.fn()
  const closeSubmitConfirm = vi.fn()
  const openSubmitConfirm = vi.fn()
  const requestDeleteDraftOrder = vi.fn()
  const saveOrderMetaImmediately = vi.fn<() => Promise<boolean>>()
    .mockResolvedValue(options.metaSaveResult ?? true)

  const actions = useShopOrderSubmissionActions({
    canEditSelectedOrder: computed(() => canEdit.value),
    clearOrderMetaSaveTimer,
    closeDeleteDraftConfirm,
    closeSubmitConfirm,
    getActor: () => ({ userId: 'user-1', displayName: 'CJ Blanchard' }),
    itemActionLoading,
    openSubmitConfirm,
    orderMetaForm,
    requestDeleteDraftOrder,
    saveOrderMetaImmediately,
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
    canEdit,
    clearOrderMetaSaveTimer,
    closeDeleteDraftConfirm,
    closeSubmitConfirm,
    itemActionLoading,
    openSubmitConfirm,
    requestDeleteDraftOrder,
    saveOrderMetaImmediately,
    selectedOrder,
    selectedOrderId,
  }
}

describe('useShopOrderSubmissionActions', () => {
  beforeEach(() => {
    deleteShopOrderRecordMock.mockReset()
    sendShopOrderSubmissionEmailMock.mockReset()
    updateShopOrderRecordMock.mockReset()
    deleteShopOrderRecordMock.mockResolvedValue(undefined)
    sendShopOrderSubmissionEmailMock.mockResolvedValue(undefined)
    updateShopOrderRecordMock.mockResolvedValue(undefined)
  })

  it('delegates delete-button clicks to the delete confirmation request', async () => {
    const { actions, requestDeleteDraftOrder } = mountSubmissionActions()

    await actions.handleDeleteSelectedOrder()

    expect(requestDeleteDraftOrder).toHaveBeenCalledTimes(1)
  })

  it('deletes draft orders, clears selection, closes the dialog, and clears loading state', async () => {
    const {
      actionInfos,
      actions,
      closeDeleteDraftConfirm,
      itemActionLoading,
      selectedOrderId,
    } = mountSubmissionActions()

    await actions.confirmDeleteSelectedOrder()

    expect(deleteShopOrderRecordMock).toHaveBeenCalledWith('order-1')
    expect(actionInfos).toContain('Draft order deleted.')
    expect(selectedOrderId.value).toBeNull()
    expect(closeDeleteDraftConfirm).toHaveBeenCalledTimes(1)
    expect(itemActionLoading.value).toBe(false)
  })

  it('closes delete confirmation without service work when the selected order is not a draft', async () => {
    const { actions, closeDeleteDraftConfirm } = mountSubmissionActions({
      selectedOrder: makeOrder({ status: 'submitted' }),
    })

    await actions.confirmDeleteSelectedOrder()

    expect(deleteShopOrderRecordMock).not.toHaveBeenCalled()
    expect(closeDeleteDraftConfirm).toHaveBeenCalledTimes(1)
  })

  it('reports draft delete failures without leaving loading state stuck', async () => {
    deleteShopOrderRecordMock.mockRejectedValueOnce(new Error('Delete denied'))
    const { actionErrors, actions, closeDeleteDraftConfirm, itemActionLoading } = mountSubmissionActions()

    await actions.confirmDeleteSelectedOrder()

    expect(actionErrors).toContain('Delete denied')
    expect(closeDeleteDraftConfirm).not.toHaveBeenCalled()
    expect(itemActionLoading.value).toBe(false)
  })

  it('validates submit preconditions before opening the submit confirmation', async () => {
    const invalidDate = mountSubmissionActions({ deliveryDate: '2000-01-01' })

    await invalidDate.actions.handleSubmitSelectedOrder()

    expect(invalidDate.actionErrors).toContain('Delivery date must be today or later.')
    expect(invalidDate.openSubmitConfirm).not.toHaveBeenCalled()

    const emptyOrder = mountSubmissionActions({
      selectedOrder: makeOrder({ items: [] }),
    })

    await emptyOrder.actions.handleSubmitSelectedOrder()

    expect(emptyOrder.actionErrors).toContain('Add at least one item before submitting the order.')
    expect(emptyOrder.openSubmitConfirm).not.toHaveBeenCalled()
  })

  it('saves metadata before opening submit confirmation', async () => {
    const {
      actions,
      clearOrderMetaSaveTimer,
      openSubmitConfirm,
      saveOrderMetaImmediately,
    } = mountSubmissionActions()

    await actions.handleSubmitSelectedOrder()

    expect(clearOrderMetaSaveTimer).toHaveBeenCalledTimes(1)
    expect(saveOrderMetaImmediately).toHaveBeenCalledTimes(1)
    expect(openSubmitConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not open submit confirmation when metadata save fails or order is read-only', async () => {
    const saveFailed = mountSubmissionActions({ metaSaveResult: false })

    await saveFailed.actions.handleSubmitSelectedOrder()

    expect(saveFailed.openSubmitConfirm).not.toHaveBeenCalled()

    const readOnly = mountSubmissionActions({ canEdit: false })

    await readOnly.actions.handleSubmitSelectedOrder()

    expect(readOnly.saveOrderMetaImmediately).not.toHaveBeenCalled()
    expect(readOnly.openSubmitConfirm).not.toHaveBeenCalled()
  })

  it('submits editable orders, sends the email, closes the dialog, and clears loading state', async () => {
    const { actionInfos, actions, closeSubmitConfirm, itemActionLoading } = mountSubmissionActions()

    await actions.confirmSubmitSelectedOrder()

    expect(updateShopOrderRecordMock).toHaveBeenCalledWith(
      'order-1',
      { status: 'submitted' },
      { userId: 'user-1', displayName: 'CJ Blanchard' },
    )
    expect(sendShopOrderSubmissionEmailMock).toHaveBeenCalledWith('job-1', 'order-1')
    expect(actionInfos).toContain('Shop order submitted.')
    expect(closeSubmitConfirm).toHaveBeenCalledTimes(1)
    expect(itemActionLoading.value).toBe(false)
  })

  it('keeps a submitted order success while reporting email failures', async () => {
    sendShopOrderSubmissionEmailMock.mockRejectedValueOnce(new Error('Email offline'))
    const { actionErrors, actions, closeSubmitConfirm } = mountSubmissionActions()

    await actions.confirmSubmitSelectedOrder()

    expect(updateShopOrderRecordMock).toHaveBeenCalledWith(
      'order-1',
      { status: 'submitted' },
      { userId: 'user-1', displayName: 'CJ Blanchard' },
    )
    expect(actionErrors).toContain('Email offline')
    expect(closeSubmitConfirm).toHaveBeenCalledTimes(1)
  })

  it('reports submit failures and closes read-only submit attempts without service work', async () => {
    updateShopOrderRecordMock.mockRejectedValueOnce(new Error('Submit denied'))
    const failedSubmit = mountSubmissionActions()

    await failedSubmit.actions.confirmSubmitSelectedOrder()

    expect(failedSubmit.actionErrors).toContain('Submit denied')
    expect(failedSubmit.closeSubmitConfirm).not.toHaveBeenCalled()
    expect(failedSubmit.itemActionLoading.value).toBe(false)

    const readOnly = mountSubmissionActions({ canEdit: false })

    await readOnly.actions.confirmSubmitSelectedOrder()

    expect(updateShopOrderRecordMock).toHaveBeenCalledTimes(1)
    expect(readOnly.closeSubmitConfirm).toHaveBeenCalledTimes(1)
  })
})
