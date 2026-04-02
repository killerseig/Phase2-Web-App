import { describe, expect, it } from 'vitest'
import {
  createCatalogItemNodeId,
  getCatalogItemIdFromNodeId,
  isCatalogItemNodeId,
  isCatalogParentItemId,
  normalizeCatalogParentNodeId,
} from '@/utils/catalogNode'

describe('catalogNode utilities', () => {
  it('creates and parses item node ids consistently', () => {
    expect(createCatalogItemNodeId('anchor-kit')).toBe('item-anchor-kit')
    expect(isCatalogItemNodeId('item-anchor-kit')).toBe(true)
    expect(isCatalogItemNodeId('cat-fasteners')).toBe(false)
    expect(getCatalogItemIdFromNodeId('item-anchor-kit')).toBe('anchor-kit')
    expect(getCatalogItemIdFromNodeId('cat-fasteners')).toBeNull()
  })

  it('matches legacy and normalized parent item references', () => {
    expect(isCatalogParentItemId('item-anchor-kit', 'anchor-kit')).toBe(true)
    expect(isCatalogParentItemId('anchor-kit', 'anchor-kit')).toBe(true)
    expect(isCatalogParentItemId('cat-fasteners', 'anchor-kit')).toBe(false)
  })

  it('normalizes parent node ids against known category and item ids', () => {
    const categoryIds = new Set(['cat-fasteners'])
    const itemIds = new Set(['anchor-kit'])

    expect(normalizeCatalogParentNodeId('item-anchor-kit', categoryIds, itemIds)).toBe('item-anchor-kit')
    expect(normalizeCatalogParentNodeId('anchor-kit', categoryIds, itemIds)).toBe('item-anchor-kit')
    expect(normalizeCatalogParentNodeId('cat-fasteners', categoryIds, itemIds)).toBe('cat-fasteners')
    expect(normalizeCatalogParentNodeId('missing-parent', categoryIds, itemIds)).toBeNull()
    expect(normalizeCatalogParentNodeId(null, categoryIds, itemIds)).toBeNull()
  })
})
