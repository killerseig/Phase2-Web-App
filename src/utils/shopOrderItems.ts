import type { ShopOrderItem, ShopOrderStatus } from '@/services'

function normalizeDescription(description: string | null | undefined): string {
  return String(description ?? '').trim()
}

export function normalizeShopOrderItemNote(note: string | null | undefined): string | undefined {
  const raw = String(note ?? '')
  return raw.trim() ? raw : undefined
}

export function normalizeShopOrderItemCostCode(costCode: string | null | undefined): string | undefined {
  const raw = String(costCode ?? '')
  return raw.trim() ? raw.trim() : undefined
}

export function normalizeShopOrderRequestedDeliveryDate(
  value: string | null | undefined,
): string | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined

  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
}

function normalizeQuantity(quantity: number | null | undefined): number {
  return Math.max(0, Math.floor(Number(quantity) || 0))
}

function normalizeReceiptQuantities(item: ShopOrderItem) {
  const quantity = normalizeQuantity(item.quantity)
  const receivedQuantity = Math.min(quantity, normalizeQuantity(item.receivedQuantity))
  const backorderedQuantity = Math.min(
    Math.max(0, quantity - receivedQuantity),
    normalizeQuantity(item.backorderedQuantity),
  )

  return {
    quantity,
    receivedQuantity,
    backorderedQuantity,
  }
}

function normalizeComparableNote(note: string | null | undefined): string | undefined {
  const trimmed = String(note ?? '').trim()
  return trimmed ? trimmed : undefined
}

function canMergeShopOrderItems(existing: ShopOrderItem, incoming: ShopOrderItem): boolean {
  const existingCatalogItemId = existing.catalogItemId ?? null
  const incomingCatalogItemId = incoming.catalogItemId ?? null
  const existingNote = normalizeComparableNote(existing.note)
  const incomingNote = normalizeComparableNote(incoming.note)

  if (existingCatalogItemId && incomingCatalogItemId) {
    return existingCatalogItemId === incomingCatalogItemId && existingNote === incomingNote
  }

  if (existingCatalogItemId || incomingCatalogItemId) {
    return false
  }

  return (
    normalizeDescription(existing.description) === normalizeDescription(incoming.description)
    && existingNote === incomingNote
  )
}

export function sanitizeShopOrderItems(items: ShopOrderItem[]): ShopOrderItem[] {
  return items.map((item) => {
    const note = normalizeShopOrderItemNote(item.note)
    const costCode = normalizeShopOrderItemCostCode(item.costCode)
    const {
      quantity,
      receivedQuantity,
      backorderedQuantity,
    } = normalizeReceiptQuantities(item)

    return {
      description: normalizeDescription(item.description),
      quantity,
      ...(note ? { note } : {}),
      catalogItemId: item.catalogItemId ?? null,
      ...(costCode ? { costCode } : {}),
      ...(receivedQuantity > 0 ? { receivedQuantity } : {}),
      ...(backorderedQuantity > 0 ? { backorderedQuantity } : {}),
    }
  })
}

export function mergeShopOrderItem(items: ShopOrderItem[], nextItem: ShopOrderItem): ShopOrderItem[] {
  const normalizedNextItem = sanitizeShopOrderItems([nextItem])[0]

  if (!normalizedNextItem) {
    return items.map((item) => ({ ...item }))
  }

  const nextItems = items.map((item) => ({ ...item }))
  const existingIndex = nextItems.findIndex((item) => canMergeShopOrderItems(item, normalizedNextItem))

  if (existingIndex === -1) {
    return [...nextItems, normalizedNextItem]
  }

  const existingItem = nextItems[existingIndex]
  if (!existingItem) {
    return [...nextItems, normalizedNextItem]
  }

  nextItems[existingIndex] = {
    ...existingItem,
    quantity: normalizeQuantity(existingItem.quantity) + normalizedNextItem.quantity,
    ...(normalizedNextItem.note ? { note: normalizedNextItem.note } : { note: undefined }),
    ...(normalizedNextItem.costCode || existingItem.costCode
      ? { costCode: normalizedNextItem.costCode ?? existingItem.costCode }
      : { costCode: undefined }),
  }

  return nextItems
}

export function buildCatalogSelectionQuantities(items: ShopOrderItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const catalogItemId = item.catalogItemId ?? null
    if (!catalogItemId) return counts

    counts[catalogItemId] = (counts[catalogItemId] ?? 0) + normalizeQuantity(item.quantity)
    return counts
  }, {})
}

export function getShopOrderItemReceivedQuantity(item: ShopOrderItem): number {
  return normalizeReceiptQuantities(item).receivedQuantity
}

export function getShopOrderItemBackorderedQuantity(item: ShopOrderItem): number {
  return normalizeReceiptQuantities(item).backorderedQuantity
}

export function getShopOrderItemPendingQuantity(item: ShopOrderItem): number {
  const {
    quantity,
    receivedQuantity,
    backorderedQuantity,
  } = normalizeReceiptQuantities(item)

  return Math.max(0, quantity - receivedQuantity - backorderedQuantity)
}

export type ShopOrderItemReceiptStatus = 'ordered' | 'partial' | 'backordered' | 'received'

export function getShopOrderItemReceiptStatus(item: ShopOrderItem): ShopOrderItemReceiptStatus {
  const quantity = normalizeQuantity(item.quantity)
  const receivedQuantity = getShopOrderItemReceivedQuantity(item)
  const backorderedQuantity = getShopOrderItemBackorderedQuantity(item)
  const pendingQuantity = getShopOrderItemPendingQuantity(item)

  if (quantity === 0) return 'ordered'
  if (receivedQuantity >= quantity && pendingQuantity === 0) return 'received'
  if (backorderedQuantity > 0) return 'backordered'
  if (receivedQuantity > 0) return 'partial'
  return 'ordered'
}

export function deriveShopOrderStatus(
  items: ShopOrderItem[],
  fallbackStatus: Exclude<ShopOrderStatus, 'draft'> = 'submitted',
): Exclude<ShopOrderStatus, 'draft'> {
  const sanitizedItems = sanitizeShopOrderItems(items).filter((item) => item.quantity > 0)
  if (sanitizedItems.length === 0) return fallbackStatus

  if (sanitizedItems.every((item) => getShopOrderItemReceiptStatus(item) === 'received')) {
    return 'received'
  }

  if (sanitizedItems.some((item) => getShopOrderItemReceiptStatus(item) === 'backordered')) {
    return 'backordered'
  }

  if (sanitizedItems.some((item) => getShopOrderItemReceiptStatus(item) === 'partial')) {
    return 'partial'
  }

  return fallbackStatus
}

export function summarizeShopOrderItems(items: ShopOrderItem[]) {
  return sanitizeShopOrderItems(items).reduce(
    (summary, item) => ({
      orderedQuantity: summary.orderedQuantity + item.quantity,
      receivedQuantity: summary.receivedQuantity + getShopOrderItemReceivedQuantity(item),
      backorderedQuantity: summary.backorderedQuantity + getShopOrderItemBackorderedQuantity(item),
      pendingQuantity: summary.pendingQuantity + getShopOrderItemPendingQuantity(item),
    }),
    {
      orderedQuantity: 0,
      receivedQuantity: 0,
      backorderedQuantity: 0,
      pendingQuantity: 0,
    },
  )
}
