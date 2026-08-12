import { formatAppTimestamp, toAppDate } from '@/utils/dateTime'

type ShopOrderNumberSource = {
  orderNumber?: unknown
  orderDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

type ShopOrderDisplaySource = ShopOrderNumberSource & {
  deliveryDate?: unknown
  status?: unknown
}

type ShopOrderItemSortSource = {
  id?: unknown
  sourceType?: unknown
  description?: unknown
}

type ShopOrderItemPriceSource = {
  quantity?: unknown
  price?: unknown
}

const shopOrderItemCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

const shopOrderCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function normalizeShopOrderNumber(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeShopOrderItemText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeShopOrderNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.replace(/[$,]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function buildTimestampShopOrderNumber(value: unknown): string {
  const dateValue = toAppDate(value)
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

export function formatShopOrderTimestamp(value: unknown): string {
  return formatAppTimestamp(value, 'Unknown date')
}

export function getShopOrderStatusLabel(order: ShopOrderDisplaySource | null | undefined): string {
  return order?.status === 'submitted' ? 'Submitted' : 'Draft'
}

export function getShopOrderDisplayLabel(order: ShopOrderDisplaySource | null | undefined): string {
  const statusLabel = getShopOrderStatusLabel(order)
  const deliveryDate = typeof order?.deliveryDate === 'string' ? order.deliveryDate.trim() : ''

  if (deliveryDate) return `${statusLabel} / Due ${deliveryDate}`

  return `${statusLabel} / ${formatShopOrderTimestamp(order?.createdAt)}`
}

export function getShopOrderNumberLabel(order: ShopOrderNumberSource | null | undefined): string {
  return `Order #${getShopOrderDisplayNumber(order)}`
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

export function getShopOrderItemUnitPrice(item: ShopOrderItemPriceSource | null | undefined): number | null {
  const price = normalizeShopOrderNumberValue(item?.price)
  return price === null || price < 0 ? null : price
}

export function getShopOrderItemLineTotal(item: ShopOrderItemPriceSource | null | undefined): number | null {
  const unitPrice = getShopOrderItemUnitPrice(item)
  const quantity = normalizeShopOrderNumberValue(item?.quantity)

  if (unitPrice === null || quantity === null || quantity < 1) return null

  return unitPrice * Math.round(quantity)
}

export function getShopOrderEstimatedTotal(items: readonly ShopOrderItemPriceSource[]): number | null {
  const lineTotals = items
    .map((item) => getShopOrderItemLineTotal(item))
    .filter((value): value is number => value !== null)

  if (!lineTotals.length) return null

  return lineTotals.reduce((sum, total) => sum + total, 0)
}

export function formatShopOrderCurrency(value: unknown, fallback = 'No price'): string {
  const normalized = normalizeShopOrderNumberValue(value)

  if (normalized === null || normalized < 0) return fallback

  return shopOrderCurrencyFormatter.format(normalized)
}
