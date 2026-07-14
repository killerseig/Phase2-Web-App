import { reactive, ref, type ComputedRef } from 'vue'
import {
  createEmptyOrderMetaFormState,
  getDeliveryDateValidationMessage,
  getNextThursdayDateString,
  hydrateOrderMetaFormState,
  serializeOrderMetaForm,
  serializeOrderMetaRecord,
  type OrderMetaFormState,
} from '@/features/shopOrders/viewHelpers'
import type { ShopOrderRecord } from '@/types/domain'

interface UseShopOrderMetaFormOptions {
  canEditSelectedOrder: ComputedRef<boolean>
  persistOrderMeta: (orderId: string, form: OrderMetaFormState) => Promise<boolean>
  selectedOrder: ComputedRef<ShopOrderRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderMetaForm({
  canEditSelectedOrder,
  persistOrderMeta,
  selectedOrder,
  setActionError,
  setActionInfo,
}: UseShopOrderMetaFormOptions) {
  const orderMetaForm = reactive<OrderMetaFormState>(createEmptyOrderMetaFormState())
  const hydratingOrderMetaForm = ref(false)
  const lastHydratedOrderId = ref<string | null>(null)
  const lastSavedOrderMetaSignature = ref('')
  let orderMetaSaveTimer: ReturnType<typeof setTimeout> | null = null

  function applySelectedOrderToForm(order: ShopOrderRecord | null) {
    hydratingOrderMetaForm.value = true
    setActionError('')
    lastHydratedOrderId.value = order?.id ?? null

    hydrateOrderMetaFormState(orderMetaForm, order)
    lastSavedOrderMetaSignature.value = serializeOrderMetaForm(orderMetaForm)
    hydratingOrderMetaForm.value = false
  }

  function clearOrderMetaSaveTimer() {
    if (!orderMetaSaveTimer) return

    clearTimeout(orderMetaSaveTimer)
    orderMetaSaveTimer = null
  }

  async function saveOrderMetaImmediately() {
    if (!selectedOrder.value || !canEditSelectedOrder.value) return true

    const validationMessage = getDeliveryDateValidationMessage(orderMetaForm.deliveryDate)
    if (validationMessage) {
      setActionError(validationMessage)
      setActionInfo('')
      return false
    }

    const nextSignature = serializeOrderMetaForm(orderMetaForm)
    if (nextSignature === lastSavedOrderMetaSignature.value) return true

    const saved = await persistOrderMeta(selectedOrder.value.id, orderMetaForm)
    if (saved) {
      lastSavedOrderMetaSignature.value = nextSignature
    }

    return saved
  }

  function queueOrderMetaSave() {
    if (!selectedOrder.value || !canEditSelectedOrder.value || hydratingOrderMetaForm.value) return

    const nextSignature = serializeOrderMetaForm(orderMetaForm)
    if (nextSignature === lastSavedOrderMetaSignature.value) return

    clearOrderMetaSaveTimer()
    orderMetaSaveTimer = setTimeout(() => {
      void saveOrderMetaImmediately()
    }, 700)
  }

  function hasSelectedOrderChanged(order: ShopOrderRecord, previousOrder: ShopOrderRecord | null) {
    const nextOrderId = order.id
    const previousOrderId = previousOrder?.id ?? null

    return nextOrderId !== previousOrderId || nextOrderId !== lastHydratedOrderId.value
  }

  function shouldHydrateSelectedOrder(order: ShopOrderRecord, previousOrder: ShopOrderRecord | null) {
    if (hasSelectedOrderChanged(order, previousOrder)) return true

    const localSignature = serializeOrderMetaForm(orderMetaForm)
    const incomingSignature = serializeOrderMetaRecord(order)
    const hasUnsavedLocalChanges =
      canEditSelectedOrder.value && localSignature !== lastSavedOrderMetaSignature.value

    if (hasUnsavedLocalChanges) return false

    return incomingSignature !== lastSavedOrderMetaSignature.value
  }

  function applyThursdayDelivery() {
    if (!canEditSelectedOrder.value) return

    orderMetaForm.deliveryDate = getNextThursdayDateString()
  }

  return {
    applySelectedOrderToForm,
    applyThursdayDelivery,
    clearOrderMetaSaveTimer,
    hasSelectedOrderChanged,
    orderMetaForm,
    queueOrderMetaSave,
    saveOrderMetaImmediately,
    shouldHydrateSelectedOrder,
  }
}
