import { getDeliveryDateValidationMessage } from '@/features/shopOrders/viewHelpers'
import {
  deleteShopOrderRecord,
  sendShopOrderSubmissionEmail,
  updateShopOrderRecord,
  type ShopOrderActor,
} from '@/services/shopOrders'
import type { ShopOrderRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface ShopOrderMetaFormLike {
  deliveryDate: string
}

interface UseShopOrderSubmissionActionsOptions {
  canEditSelectedOrder: ReadonlyRef<boolean>
  clearOrderMetaSaveTimer: () => void
  closeDeleteDraftConfirm: () => void
  closeSubmitConfirm: () => void
  getActor: () => ShopOrderActor
  itemActionLoading: Ref<boolean>
  openSubmitConfirm: () => void
  orderMetaForm: ShopOrderMetaFormLike
  requestDeleteDraftOrder: () => void
  saveOrderMetaImmediately: () => Promise<boolean>
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  selectedOrderId: Ref<string | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderSubmissionActions({
  canEditSelectedOrder,
  clearOrderMetaSaveTimer,
  closeDeleteDraftConfirm,
  closeSubmitConfirm,
  getActor,
  itemActionLoading,
  openSubmitConfirm,
  orderMetaForm,
  requestDeleteDraftOrder,
  saveOrderMetaImmediately,
  selectedOrder,
  selectedOrderId,
  setActionError,
  setActionInfo,
}: UseShopOrderSubmissionActionsOptions) {
  async function handleDeleteSelectedOrder() {
    requestDeleteDraftOrder()
  }

  async function confirmDeleteSelectedOrder() {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') {
      closeDeleteDraftConfirm()
      return
    }

    itemActionLoading.value = true
    setActionError('')

    try {
      await deleteShopOrderRecord(selectedOrder.value.id)
      setActionInfo('Draft order deleted.')
      selectedOrderId.value = null
      closeDeleteDraftConfirm()
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to delete draft order.'))
    } finally {
      itemActionLoading.value = false
    }
  }

  async function handleSubmitSelectedOrder() {
    if (!selectedOrder.value || !canEditSelectedOrder.value) return

    const validationMessage = getDeliveryDateValidationMessage(orderMetaForm.deliveryDate)
    if (validationMessage) {
      setActionError(validationMessage)
      return
    }

    if (selectedOrder.value.items.length === 0) {
      setActionError('Add at least one item before submitting the order.')
      return
    }

    clearOrderMetaSaveTimer()
    const savedMeta = await saveOrderMetaImmediately()
    if (!savedMeta) return

    openSubmitConfirm()
  }

  async function confirmSubmitSelectedOrder() {
    if (!selectedOrder.value || !canEditSelectedOrder.value) {
      closeSubmitConfirm()
      return
    }

    itemActionLoading.value = true
    setActionError('')

    try {
      const submittedOrderId = selectedOrder.value.id
      const submittedJobId = selectedOrder.value.jobId

      await updateShopOrderRecord(submittedOrderId, { status: 'submitted' }, getActor())
      setActionInfo('Shop order submitted.')
      try {
        await sendShopOrderSubmissionEmail(submittedJobId, submittedOrderId)
      } catch (emailError) {
        setActionError(normalizeError(emailError, 'Shop order was submitted, but the email could not be sent.'))
      }
      closeSubmitConfirm()
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to submit the shop order.'))
    } finally {
      itemActionLoading.value = false
    }
  }

  return {
    confirmDeleteSelectedOrder,
    confirmSubmitSelectedOrder,
    handleDeleteSelectedOrder,
    handleSubmitSelectedOrder,
  }
}
