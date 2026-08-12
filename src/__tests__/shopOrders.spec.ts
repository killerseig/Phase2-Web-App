import { describe, expect, it } from 'vitest'

import {
  buildTimestampShopOrderNumber,
  formatShopOrderTimestamp,
  getShopOrderDisplayLabel,
  getShopOrderDisplayNumber,
  getShopOrderItemDisplayName,
  getShopOrderNumberLabel,
  getShopOrderStatusLabel,
  sortShopOrderItems,
} from '@/utils/shopOrders'

describe('shop order helpers', () => {
  it('formats explicit and timestamp-derived order numbers', () => {
    const createdAt = new Date(Date.UTC(2026, 5, 4, 14, 20, 27))

    expect(buildTimestampShopOrderNumber(createdAt)).toBe('20260604142027')
    expect(getShopOrderDisplayNumber({ orderNumber: '  SO-1000  ', createdAt })).toBe('SO-1000')
    expect(getShopOrderDisplayNumber({ createdAt })).toBe('20260604142027')
    expect(getShopOrderNumberLabel({ orderNumber: '20260604142027' })).toBe('Order #20260604142027')
    expect(getShopOrderDisplayNumber({})).toBe('Unnumbered')
  })

  it('formats shop order labels from status, delivery date, and creation date fallback', () => {
    expect(getShopOrderStatusLabel({ status: 'submitted' })).toBe('Submitted')
    expect(getShopOrderStatusLabel({ status: 'draft' })).toBe('Draft')
    expect(getShopOrderDisplayLabel({ deliveryDate: '2026-06-11', status: 'submitted' })).toBe(
      'Submitted / Due 2026-06-11',
    )
    expect(getShopOrderDisplayLabel({ createdAt: 'not a date', status: 'draft' })).toBe('Draft / Unknown date')
  })

  it('formats Firestore-like timestamps without leaking invalid dates', () => {
    const timestamp = {
      toMillis: () => new Date(2026, 5, 4, 9, 8).getTime(),
    }

    expect(formatShopOrderTimestamp(null)).toBe('Unknown date')
    expect(formatShopOrderTimestamp('not a date')).toBe('Unknown date')
    expect(formatShopOrderTimestamp(timestamp)).toContain('2026')
    expect(formatShopOrderTimestamp(timestamp)).toContain('9:08')
  })

  it('shows catalog item names without folder prefixes', () => {
    expect(
      getShopOrderItemDisplayName({
        description: '. / Adhesive / Super 77 - SINGLE',
        sourceType: 'catalog',
      }),
    ).toBe('Super 77 - SINGLE')

    expect(
      getShopOrderItemDisplayName({
        description: 'Need a special box',
        sourceType: 'custom',
      }),
    ).toBe('Need a special box')
  })

  it('sorts order items alphabetically by the displayed item name', () => {
    const sorted = sortShopOrderItems([
      { description: '. / Fuel / Gas Can - 5 Gal', id: '3', sourceType: 'catalog' },
      { description: 'Bottled water', id: '2', sourceType: 'custom' },
      { description: '. / Adhesive / AHA Book', id: '1', sourceType: 'catalog' },
    ])

    expect(sorted.map((item) => getShopOrderItemDisplayName(item))).toEqual([
      'AHA Book',
      'Bottled water',
      'Gas Can - 5 Gal',
    ])
  })
})
