import type { CatalogOrderSelection } from '@/types/shopOrders'

type CatalogOrderSelectionInput = {
  id: string
  description: string
  quantity?: string | number | null | undefined
  sku?: string
  price?: string | number | null | undefined
}

export function normalizeCatalogOrderQuantity(value: unknown, fallback = 1): number {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.max(1, Math.floor(numericValue))
  }

  const numericFallback = Number(fallback)
  if (Number.isFinite(numericFallback) && numericFallback > 0) {
    return Math.max(1, Math.floor(numericFallback))
  }

  return 1
}

export function createCatalogOrderSelection(
  item: CatalogOrderSelectionInput,
): CatalogOrderSelection {
  const selection: CatalogOrderSelection = {
    id: item.id,
    description: item.description.trim(),
    quantity: normalizeCatalogOrderQuantity(item.quantity),
  }

  if (item.sku) {
    selection.sku = item.sku
  }

  if (item.price !== undefined && item.price !== null && item.price !== '') {
    selection.price = item.price
  }

  return selection
}

export function buildCatalogSelectionNote(
  item: Pick<CatalogOrderSelection, 'sku' | 'price'>,
): string {
  const noteParts: string[] = []

  if (item.sku) noteParts.push(`SKU: ${item.sku}`)
  if (item.price !== undefined && item.price !== null && item.price !== '') {
    noteParts.push(`$${item.price}`)
  }

  return noteParts.join(' - ')
}
