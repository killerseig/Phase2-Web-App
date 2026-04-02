import type { ShopOrderItem } from '@/services'

function normalizeDescription(description: string | null | undefined): string {
  return String(description ?? '').trim()
}

export function normalizeShopOrderItemNote(note: string | null | undefined): string | undefined {
  const raw = String(note ?? '')
  return raw.trim() ? raw : undefined
}

function normalizeQuantity(quantity: number | null | undefined): number {
  return Math.max(0, Math.floor(Number(quantity) || 0))
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
    return {
      description: normalizeDescription(item.description),
      quantity: normalizeQuantity(item.quantity),
      ...(note ? { note } : {}),
      catalogItemId: item.catalogItemId ?? null,
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
