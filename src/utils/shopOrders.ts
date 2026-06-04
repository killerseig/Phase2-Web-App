type ShopOrderNumberSource = {
  orderNumber?: unknown
  orderDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

function normalizeShopOrderNumber(value: unknown): string {
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
