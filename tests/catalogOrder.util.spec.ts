import { describe, expect, it } from 'vitest'
import {
  buildCatalogSelectionNote,
  createCatalogOrderSelection,
  normalizeCatalogOrderQuantity,
} from '@/utils/catalogOrder'

describe('catalogOrder utilities', () => {
  it('normalizes order quantities to positive whole numbers', () => {
    expect(normalizeCatalogOrderQuantity('4.7')).toBe(4)
    expect(normalizeCatalogOrderQuantity(0)).toBe(1)
    expect(normalizeCatalogOrderQuantity(undefined, 3)).toBe(3)
  })

  it('creates trimmed catalog order selections with normalized quantities', () => {
    expect(createCatalogOrderSelection({
      id: 'item-a',
      description: '  Outrigger  ',
      quantity: '2.9',
    })).toEqual({
      id: 'item-a',
      description: 'Outrigger',
      quantity: 2,
    })
  })

  it('builds order notes from sku and price metadata', () => {
    expect(buildCatalogSelectionNote({ sku: 'SKU-1', price: 0 })).toBe('SKU: SKU-1 - $0')
    expect(buildCatalogSelectionNote({ sku: undefined, price: undefined })).toBe('')
  })
})
