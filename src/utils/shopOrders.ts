type ShopOrderNumberSource = {
  orderNumber?: unknown
  orderDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

type ShopOrderItemSortSource = {
  id?: unknown
  sourceType?: unknown
  description?: unknown
}

const shopOrderItemCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function normalizeShopOrderNumber(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeShopOrderItemText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toDate(value: unknown): Date | null {
  if (!value) return null

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    const dateValue = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const dateValue = new Date(value)
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  return null
}

export function buildTimestampShopOrderNumber(value: unknown): string {
  const dateValue = toDate(value)
  if (!dateValue) return ''

  return [
    dateValue.getUTCFullYear(),
    String(dateValue.getUTCMonth() + 1).padStart(2, '0'),
    String(dateValue.getUTCDate()).padStart(2, '0'),
    String(dateValue.getUTCHours()).padStart(2, '0'),
    String(dateValue.getUTCMinutes()).padStart(2, '0'),
    String(dateValue.getUTCSeconds()).padStart(2, '0'),
  ].join('')
}

export function getShopOrderDisplayNumber(order: ShopOrderNumberSource | null | undefined): string {
  return (
    normalizeShopOrderNumber(order?.orderNumber)
    || buildTimestampShopOrderNumber(order?.orderDate)
    || buildTimestampShopOrderNumber(order?.createdAt)
    || buildTimestampShopOrderNumber(order?.updatedAt)
    || 'Unnumbered'
  )
}

export function getShopOrderItemDisplayName(item: ShopOrderItemSortSource | null | undefined): string {
  const itemName = normalizeShopOrderItemText(item?.description) || 'Untitled Item'

  if (item?.sourceType !== 'catalog') return itemName

  const segments = itemName
    .split(' / ')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments[segments.length - 1] || itemName
}

export function compareShopOrderItems(left: ShopOrderItemSortSource, right: ShopOrderItemSortSource): number {
  const displayComparison = shopOrderItemCollator.compare(
    getShopOrderItemDisplayName(left),
    getShopOrderItemDisplayName(right),
  )
  if (displayComparison !== 0) return displayComparison

  const fullDescriptionComparison = shopOrderItemCollator.compare(
    normalizeShopOrderItemText(left.description),
    normalizeShopOrderItemText(right.description),
  )
  if (fullDescriptionComparison !== 0) return fullDescriptionComparison

  return normalizeShopOrderItemText(left.id).localeCompare(normalizeShopOrderItemText(right.id))
}

export function sortShopOrderItems<T extends ShopOrderItemSortSource>(items: readonly T[]): T[] {
  return items.slice().sort(compareShopOrderItems)
}
