import { computed, getCurrentScope, onScopeDispose, reactive, ref, watch } from 'vue'
import {
  createEmptyOrderMetaFormState,
  getDeliveryDateValidationMessage,
  getRefreshedDraftDeliveryDate,
  getNextThursdayDateString,
  hydrateOrderMetaFormState,
  serializeOrderMetaForm,
  serializeOrderMetaRecord,
  type OrderMetaFormState,
} from '@/features/shopOrders/viewHelpers'
import type { ShopOrderRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseShopOrderMetaFormOptions {
  canEditSelectedOrder: ReadonlyRef<boolean>
  getContextEpoch?: () => number
  persistOrderMeta: (orderId: string, form: OrderMetaFormState) => Promise<boolean>
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderMetaForm({
  canEditSelectedOrder,
  getContextEpoch,
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
  let activeSave: Promise<boolean> | null = null
  let contextVersion = 0
  let disposed = false
  watch([() => selectedOrder.value?.id, () => canEditSelectedOrder.value, () => getContextEpoch?.()], () => {
    contextVersion += 1
    clearOrderMetaSaveTimer()
  }, { flush: 'sync' })
  const savingOrderMeta = ref(false)
  const hasUnsavedOrderMetaChanges = computed(() => canEditSelectedOrder.value &&
    serializeOrderMetaForm(orderMetaForm) !== lastSavedOrderMetaSignature.value)
  if (getCurrentScope()) onScopeDispose(() => { disposed = true; clearOrderMetaSaveTimer() })

  function applySelectedOrderToForm(order: ShopOrderRecord | null) {
    contextVersion += 1
    hydratingOrderMetaForm.value = true
    setActionError('')
    lastHydratedOrderId.value = order?.id ?? null

    hydrateOrderMetaFormState(orderMetaForm, order)
    lastSavedOrderMetaSignature.value = serializeOrderMetaForm(orderMetaForm)
    hydratingOrderMetaForm.value = false
  }

  function ensureFreshDraftDeliveryDate(order: ShopOrderRecord | null = selectedOrder.value) {
    if (!order || !canEditSelectedOrder.value) return false

    const currentFormDate = orderMetaForm.deliveryDate.trim()
    const savedOrderDate = order.deliveryDate?.trim() ?? ''
    const shouldPreserveLocalEdit = savedOrderDate && currentFormDate && currentFormDate !== savedOrderDate
    if (shouldPreserveLocalEdit) return false

    const refreshedDeliveryDate = getRefreshedDraftDeliveryDate(order)
    if (!refreshedDeliveryDate || currentFormDate === refreshedDeliveryDate) return false

    orderMetaForm.deliveryDate = refreshedDeliveryDate
    return true
  }

  function clearOrderMetaSaveTimer() {
    if (!orderMetaSaveTimer) return

    clearTimeout(orderMetaSaveTimer)
    orderMetaSaveTimer = null
  }

  async function saveOrderMetaImmediately() {
    clearOrderMetaSaveTimer()
    const orderId = selectedOrder.value?.id
    const version = contextVersion
    while (activeSave) {
      const previous = activeSave
      const saved = await previous
      if (activeSave === previous) activeSave = null
      if (!saved) return false
    }
    if (disposed || selectedOrder.value?.id !== orderId || version !== contextVersion) return false
    if (!selectedOrder.value || !canEditSelectedOrder.value) return true

    ensureFreshDraftDeliveryDate(selectedOrder.value)

    const validationMessage = getDeliveryDateValidationMessage(orderMetaForm.deliveryDate)
    if (validationMessage) {
      setActionError(validationMessage)
      setActionInfo('')
      return false
    }

    const nextSignature = serializeOrderMetaForm(orderMetaForm)
    if (nextSignature === lastSavedOrderMetaSignature.value) return true

    const snapshot = { ...orderMetaForm }
    savingOrderMeta.value = true
    const saving = (async () => {
      try {
        const saved = await persistOrderMeta(selectedOrder.value!.id, snapshot)
        if (saved && !disposed && selectedOrder.value?.id === orderId && contextVersion === version) {
          lastSavedOrderMetaSignature.value = nextSignature
        }
        return saved && !disposed && selectedOrder.value?.id === orderId && contextVersion === version
      } finally { savingOrderMeta.value = false }
    })()
    activeSave = saving
    try { return await saving } finally { if (activeSave === saving) activeSave = null }
  }

  async function prepareOrderMetaNavigation() {
    const orderId = selectedOrder.value?.id
    const version = contextVersion
    const isCurrent = () => !disposed && selectedOrder.value?.id === orderId && contextVersion === version
    clearOrderMetaSaveTimer()
    if (activeSave && !await activeSave) return false
    while (isCurrent() && hasUnsavedOrderMetaChanges.value) {
      if (!await saveOrderMetaImmediately()) return false
    }
    return isCurrent()
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
    ensureFreshDraftDeliveryDate,
    hasSelectedOrderChanged,
    hasUnsavedOrderMetaChanges,
    orderMetaForm,
    queueOrderMetaSave,
    prepareOrderMetaNavigation,
    savingOrderMeta,
    saveOrderMetaImmediately,
    shouldHydrateSelectedOrder,
  }
}
