import {
  getDefaultDeliveryDateString,
  getDeliveryDateValidationMessage,
} from '@/features/shopOrders/viewHelpers'
import { createShopOrderRecord } from '@/services/shopOrders'
import type { JobRecord, ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'
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

interface EnsureDraftOrderTarget {
  orderId: string
  items: ShopOrderItemRecord[]
}

interface UseShopOrderDraftActionsOptions {
  cloneOrderItems: (order: ShopOrderRecord) => ShopOrderItemRecord[]
  createOrderLoading: Ref<boolean>
  draftOrders: ReadonlyRef<ShopOrderRecord[]>
  getForemanName: () => string | null
  getForemanUserId: () => string | null
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  orderMetaForm: ShopOrderMetaFormLike
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  selectedOrderId: Ref<string | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderDraftActions({
  cloneOrderItems,
  createOrderLoading,
  draftOrders,
  getForemanName,
  getForemanUserId,
  job,
  jobId,
  orderMetaForm,
  selectedOrder,
  selectedOrderId,
  setActionError,
  setActionInfo,
}: UseShopOrderDraftActionsOptions) {
  async function createDraftOrder(successMessage?: string, deliveryDate?: string) {
    if (!jobId.value || !job.value) {
      setActionError('Load the job first before creating a shop order.')
      return null
    }

    const dateToUse = deliveryDate || getDefaultDeliveryDateString()
    const dateValidationMessage = getDeliveryDateValidationMessage(dateToUse)
    if (dateValidationMessage) {
      setActionError(dateValidationMessage)
      return null
    }

    createOrderLoading.value = true
    setActionError('')

    try {
      const orderId = await createShopOrderRecord({
        jobId: jobId.value,
        jobCode: job.value.code ?? null,
        jobName: job.value.name,
        foremanUserId: getForemanUserId(),
        foremanName: getForemanName(),
        deliveryDate: dateToUse,
      })

      selectedOrderId.value = orderId
      if (successMessage) {
        setActionInfo(successMessage)
      }
      return orderId
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to create a shop order.'))
      return null
    } finally {
      createOrderLoading.value = false
    }
  }

  async function ensureDraftOrderTarget(): Promise<EnsureDraftOrderTarget | null> {
    if (selectedOrder.value?.status === 'draft') {
      const validationMessage = getDeliveryDateValidationMessage(orderMetaForm.deliveryDate)
      if (validationMessage) {
        setActionError(validationMessage)
        return null
      }
      return {
        orderId: selectedOrder.value.id,
        items: cloneOrderItems(selectedOrder.value),
      }
    }

    const existingDraft = draftOrders.value[0] ?? null
    if (existingDraft) {
      selectedOrderId.value = existingDraft.id
      return {
        orderId: existingDraft.id,
        items: cloneOrderItems(existingDraft),
      }
    }

    setActionError('Create a new order with a delivery date before adding items.')
    return null
  }

  async function handleCreateOrder() {
    if (selectedOrder.value?.status === 'draft') {
      setActionError('You already have a draft order. Select it or delete it to start a new one.')
      return
    }

    const defaultDeliveryDate = getDefaultDeliveryDateString()
    const dateValidationMessage = getDeliveryDateValidationMessage(defaultDeliveryDate)
    if (dateValidationMessage) {
      setActionError(dateValidationMessage)
      return
    }

    await createDraftOrder('New order started.', defaultDeliveryDate)
  }

  return {
    createDraftOrder,
    ensureDraftOrderTarget,
    handleCreateOrder,
  }
}
