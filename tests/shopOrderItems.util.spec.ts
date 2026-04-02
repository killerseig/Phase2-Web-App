import { describe, expect, it } from 'vitest'
import {
  buildCatalogSelectionQuantities,
  mergeShopOrderItem,
  normalizeShopOrderItemNote,
  sanitizeShopOrderItems,
} from '@/utils/shopOrderItems'

describe('shopOrderItems utils', () => {
  it('merges repeat catalog items into a single line item', () => {
    const merged = mergeShopOrderItem(
      [{ description: 'Outrigger', quantity: 1, note: 'SKU: OUT-1', catalogItemId: 'item-outrigger' }],
      { description: 'Outrigger', quantity: 2, note: 'SKU: OUT-1', catalogItemId: 'item-outrigger' }
    )

    expect(merged).toEqual([
      { description: 'Outrigger', quantity: 3, note: 'SKU: OUT-1', catalogItemId: 'item-outrigger' },
    ])
  })

  it('keeps distinct custom rows separate when their notes differ', () => {
    const merged = mergeShopOrderItem(
      [{ description: 'Custom Item', quantity: 1, note: 'Blue' }],
      { description: 'Custom Item', quantity: 1, note: 'Red' }
    )

    expect(merged).toHaveLength(2)
  })

  it('builds catalog quantities from order items', () => {
    const counts = buildCatalogSelectionQuantities([
      { description: 'Outrigger', quantity: 2, catalogItemId: 'item-outrigger' },
      { description: 'Guard Rail', quantity: 3, catalogItemId: 'item-guard-rail' },
      { description: 'Outrigger', quantity: 1, catalogItemId: 'item-outrigger' },
      { description: 'Custom Item', quantity: 5 },
    ])

    expect(counts).toEqual({
      'item-outrigger': 3,
      'item-guard-rail': 3,
    })
  })

  it('sanitizes quantities and removes blank notes without stripping typed spaces', () => {
    const sanitized = sanitizeShopOrderItems([
      { description: '  Item A  ', quantity: 2.9, note: '  keep me  ', catalogItemId: 'item-a' },
      { description: ' Item B ', quantity: -4, note: '   ' },
    ])

    expect(sanitized).toEqual([
      { description: 'Item A', quantity: 2, note: '  keep me  ', catalogItemId: 'item-a' },
      { description: 'Item B', quantity: 0, catalogItemId: null },
    ])
  })

  it('treats blank notes as empty during normalization while preserving meaningful spaces', () => {
    expect(normalizeShopOrderItemNote('   ')).toBeUndefined()
    expect(normalizeShopOrderItemNote(' test ')).toBe(' test ')
  })
})
