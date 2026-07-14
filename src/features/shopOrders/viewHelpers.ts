import {
  getShopCatalogCategoryPath,
  getShopCatalogItemDisplayName,
} from '@/features/shopCatalog/catalogDisplayHelpers'
import { getE2ENowValue } from '@/testing/e2eRuntime'
import type {
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'
import { sortShopOrderItems } from '@/utils/shopOrders'

export interface OrderMetaFormState {
  deliveryDate: string
  comments: string
}

export interface CustomItemFormState {
  description: string
  quantity: string
  note: string
}

export interface ShopOrderItemNoteDraftState {
  noteDrafts: Record<string, string>
  savingIds: Record<string, boolean>
  queuedSaveIds: Record<string, boolean>
  saveTimers: Map<string, ReturnType<typeof setTimeout>>
}

export function createEmptyOrderMetaFormState(): OrderMetaFormState {
  return {
    deliveryDate: getDefaultDeliveryDateString(),
    comments: '',
  }
}

export function createEmptyCustomItemFormState(): CustomItemFormState {
  return {
    description: '',
    quantity: '1',
    note: '',
  }
}

export function hydrateOrderMetaFormState(
  form: OrderMetaFormState,
  order: ShopOrderRecord | null,
) {
  if (!order) {
    const emptyForm = createEmptyOrderMetaFormState()
    form.deliveryDate = emptyForm.deliveryDate
    form.comments = emptyForm.comments
    return
  }

  form.deliveryDate = order.deliveryDate ?? getDefaultDeliveryDateString()
  form.comments = order.comments
}

export function getRemoveShopOrderItemConfirmMessage(item: ShopOrderItemRecord | null) {
  return item ? `Remove ${item.description} from this order?` : 'Remove this item from the order?'
}

export function getShopOrderItemCount(order: ShopOrderRecord | null) {
  return order?.items.length ?? 0
}

export function getShopOrderTotalQuantity(order: ShopOrderRecord | null) {
  return (order?.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
}

export function getSortedShopOrderItems(items: readonly ShopOrderItemRecord[]) {
  return sortShopOrderItems(items)
}

export function cloneSortedShopOrderItems(order: ShopOrderRecord | null) {
  return getSortedShopOrderItems(order?.items ?? []).map((item) => ({ ...item }))
}

export function getShopOrderCatalogItemDescription(
  item: Pick<ShopCatalogItemRecord, 'description' | 'categoryId'>,
  categoriesById: ReadonlyMap<string, ShopCategoryRecord>,
) {
  const itemName = getShopCatalogItemDisplayName(item)
  const categoryPath = getShopCatalogCategoryPath(item.categoryId, categoriesById)

  if (categoryPath === 'Top Level') return itemName
  return `${categoryPath} / ${itemName}`
}

export function makeLocalShopOrderItemId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `shop-order-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatShopOrderDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getShopOrderRuntimeNow() {
  return getE2ENowValue() ?? new Date()
}

export function getTodayDateString() {
  return formatShopOrderDateInput(getShopOrderRuntimeNow())
}

export function getNextThursdayDateString() {
  const nextDate = new Date(getShopOrderRuntimeNow())
  const day = nextDate.getDay()
  let daysUntilThursday = (4 - day + 7) % 7
  if (daysUntilThursday === 0) {
    daysUntilThursday = 7
  }
  nextDate.setDate(nextDate.getDate() + daysUntilThursday)
  return formatShopOrderDateInput(nextDate)
}

export function getDefaultDeliveryDateString() {
  return getNextThursdayDateString()
}

export function readShopOrderQuantity(value: string | number | null | undefined) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.round(parsed)
}

export function normalizeOrderItemNoteValue(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

export function clearShopOrderItemNoteSaveTimer(
  saveTimers: Map<string, ReturnType<typeof setTimeout>>,
  orderItemId: string,
) {
  const timer = saveTimers.get(orderItemId)
  if (timer) {
    clearTimeout(timer)
  }
  saveTimers.delete(orderItemId)
}

export function clearQueuedShopOrderItemNoteSaveIds(
  queuedSaveIds: Record<string, boolean>,
  validIds?: ReadonlySet<string>,
) {
  for (const orderItemId of Object.keys(queuedSaveIds)) {
    if (!validIds || !validIds.has(orderItemId)) {
      delete queuedSaveIds[orderItemId]
    }
  }
}

export function clearShopOrderItemNoteDraftState(state: ShopOrderItemNoteDraftState) {
  state.saveTimers.forEach((timer) => {
    clearTimeout(timer)
  })
  state.saveTimers.clear()
  clearQueuedShopOrderItemNoteSaveIds(state.queuedSaveIds)

  for (const orderItemId of Object.keys(state.noteDrafts)) {
    delete state.noteDrafts[orderItemId]
  }
}

export function syncShopOrderItemNoteDraftState(
  order: ShopOrderRecord | null,
  state: ShopOrderItemNoteDraftState,
  force = false,
) {
  if (!order) {
    clearShopOrderItemNoteDraftState(state)
    return
  }

  const validIds = new Set(order.items.map((item) => item.id))
  clearQueuedShopOrderItemNoteSaveIds(state.queuedSaveIds, validIds)

  for (const orderItemId of Array.from(state.saveTimers.keys())) {
    if (validIds.has(orderItemId)) continue
    clearShopOrderItemNoteSaveTimer(state.saveTimers, orderItemId)
  }

  for (const orderItemId of Object.keys(state.noteDrafts)) {
    if (!validIds.has(orderItemId)) {
      delete state.noteDrafts[orderItemId]
    }
  }

  for (const item of order.items) {
    const incomingNote = item.note ?? ''
    const draftNote = state.noteDrafts[item.id] ?? incomingNote
    const hasPendingSave =
      state.saveTimers.has(item.id)
      || !!state.savingIds[item.id]
      || !!state.queuedSaveIds[item.id]
    const hasUnsavedLocalChanges = normalizeOrderItemNoteValue(draftNote) !== normalizeOrderItemNoteValue(incomingNote)

    if (force || (!hasPendingSave && !hasUnsavedLocalChanges)) {
      state.noteDrafts[item.id] = incomingNote
    }
  }
}

export function serializeOrderMetaForm(form: OrderMetaFormState) {
  return JSON.stringify({
    deliveryDate: form.deliveryDate.trim(),
    comments: form.comments.trim(),
  })
}

export function serializeOrderMetaRecord(order: ShopOrderRecord | null) {
  return JSON.stringify({
    deliveryDate: order?.deliveryDate?.trim() ?? '',
    comments: order?.comments?.trim() ?? '',
  })
}

export function getDeliveryDateValidationMessage(value: string, todayDate = getTodayDateString()) {
  const trimmed = value.trim()
  if (!trimmed) return 'Choose a delivery date.'
  if (trimmed < todayDate) return 'Delivery date must be today or later.'
  return ''
}
