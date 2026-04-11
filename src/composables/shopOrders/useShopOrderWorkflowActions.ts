import {
  createShopOrder,
  deleteShopOrder,
  sendShopOrderEmail,
  updateShopOrderDetails,
  updateShopOrderRequestedDeliveryDate,
  updateShopOrderStatus,
  type ShopOrderStatus,
} from '@/services'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { normalizeError } from '@/services/serviceUtils'
import {
  deriveShopOrderStatus,
  normalizeShopOrderRequestedDeliveryDate,
  sanitizeShopOrderItems,
} from '@/utils/shopOrderItems'
import { logError } from '@/utils/logger'
import type {
  ShopOrderMutationState,
  UseShopOrderMutationsOptions,
} from './shopOrderMutationTypes'

export function useShopOrderWorkflowActions(
  options: UseShopOrderMutationsOptions,
  state: ShopOrderMutationState,
) {
  const toast = options.toast ?? useToast()
  const confirm = options.confirm ?? ((message, confirmOptions) => (
    useConfirmDialog().confirm(message, confirmOptions)
  ))

  const deleteOrderById = async (orderId: string) => {
    const confirmed = await confirm('Delete this draft order?', {
      title: 'Delete Order',
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return

    state.deletingOrderId.value = orderId
    try {
      await deleteShopOrder(options.jobId.value, orderId)
      toast.show('Order deleted', 'success')
    } catch (error) {
      logError('ShopOrders', 'Delete order error', error)
      toast.show('Failed to delete order', 'error')
    } finally {
      state.deletingOrderId.value = null
    }
  }

  const createDraft = async () => {
    try {
      const orderId = await createShopOrder(options.jobId.value)
      options.selectedId.value = orderId
      toast.show('New order created', 'success')
    } catch (error) {
      logError('ShopOrders', 'Failed to create order', error)
      toast.show(`Failed to create order: ${normalizeError(error, 'Unknown error')}`, 'error')
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    await deleteOrderById(orderId)
  }

  const submitOrder = async () => {
    const selectedOrder = options.selected.value
    if (!selectedOrder) return

    try {
      const filteredItems = sanitizeShopOrderItems(selectedOrder.items).filter((item) => item.quantity > 0)
      if (filteredItems.length === 0) {
        toast.show('Order must have at least one item with quantity > 0', 'error')
        return
      }

      const requestedDeliveryDate = normalizeShopOrderRequestedDeliveryDate(
        selectedOrder.requestedDeliveryDate ?? null,
      ) ?? null

      await updateShopOrderDetails(options.jobId.value, selectedOrder.id, {
        items: filteredItems,
        requestedDeliveryDate,
        status: 'submitted',
      })

      selectedOrder.items = filteredItems.map((item) => ({ ...item }))
      selectedOrder.requestedDeliveryDate = requestedDeliveryDate
      selectedOrder.status = 'submitted'
      toast.show('Order submitted', 'success')
    } catch {
      toast.show('Failed to submit order', 'error')
    }
  }

  const updateRequestedDeliveryDate = async (value: string) => {
    const selectedOrder = options.selected.value
    if (!selectedOrder) return

    const previousValue = selectedOrder.requestedDeliveryDate ?? null
    const nextValue = normalizeShopOrderRequestedDeliveryDate(value) ?? null
    selectedOrder.requestedDeliveryDate = nextValue

    try {
      await updateShopOrderRequestedDeliveryDate(options.jobId.value, selectedOrder.id, nextValue)
      toast.show('Requested delivery date saved', 'success')
    } catch {
      selectedOrder.requestedDeliveryDate = previousValue
      toast.show('Failed to save requested delivery date', 'error')
    }
  }

  const sendOrderEmail = async () => {
    const selectedOrder = options.selected.value
    if (!selectedOrder) return

    if (!options.shopOrderRecipients.value.length) {
      toast.show('No recipients configured for shop orders', 'error')
      return
    }

    state.sendingEmail.value = true
    try {
      const filteredItems = sanitizeShopOrderItems(selectedOrder.items).filter((item) => item.quantity > 0)
      if (filteredItems.length === 0) {
        toast.show('Order must have at least one item with quantity > 0', 'error')
        return
      }

      const requestedDeliveryDate = normalizeShopOrderRequestedDeliveryDate(
        selectedOrder.requestedDeliveryDate ?? null,
      ) ?? null

      await updateShopOrderDetails(options.jobId.value, selectedOrder.id, {
        items: filteredItems,
        requestedDeliveryDate,
      })

      selectedOrder.items = filteredItems.map((item) => ({ ...item }))
      selectedOrder.requestedDeliveryDate = requestedDeliveryDate

      await sendShopOrderEmail(options.jobId.value, selectedOrder.id, options.shopOrderRecipients.value)

      if (selectedOrder.status === 'draft') {
        const nextStatus: ShopOrderStatus = deriveShopOrderStatus(filteredItems, 'submitted')
        await updateShopOrderStatus(options.jobId.value, selectedOrder.id, nextStatus)
        selectedOrder.status = nextStatus
      }

      toast.show('Order emailed successfully', 'success')
    } catch (error) {
      toast.show(normalizeError(error, 'Failed to email order'), 'error')
    } finally {
      state.sendingEmail.value = false
    }
  }

  return {
    createDraft,
    handleDeleteOrder,
    submitOrder,
    updateRequestedDeliveryDate,
    sendOrderEmail,
  }
}
