import { describe, expect, it } from 'vitest'
import { buildCatalogTreeIndex, getCatalogRootNodeIds } from '@/utils/catalogTree'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

describe('catalog tree roots', () => {
  it('surfaces orphaned categories and items as top-level roots', () => {
    const categories: ShopCategory[] = [
      { id: 'cat-a', name: 'Anchors', parentId: null, active: true },
      { id: 'cat-test', name: 'test 2', parentId: 'missing-parent', active: true },
      { id: 'cat-child', name: 'test 3', parentId: 'cat-test', active: true },
    ]
    const items: ShopCatalogItem[] = [
      { id: 'item-a', description: 'Visible Item', categoryId: 'cat-a', active: true },
      { id: 'item-orphan', description: 'test4', categoryId: 'missing-category', active: true },
    ]

    const roots = getCatalogRootNodeIds({ categories, items })

    expect(roots.rootCategoryNodeIds).toContain('cat-test')
    expect(roots.rootCategoryNodeIds).not.toContain('cat-child')
    expect(roots.rootItemNodeIds).toContain('item-item-orphan')
  })

  it('respects include filters when computing roots', () => {
    const categories: ShopCategory[] = [
      { id: 'cat-a', name: 'Anchors', parentId: null, active: true },
      { id: 'cat-inactive', name: 'test 2', parentId: null, active: false },
    ]
    const items: ShopCatalogItem[] = [
      { id: 'item-active', description: 'test4', active: true },
      { id: 'item-inactive', description: 'test5', active: false },
    ]

    const roots = getCatalogRootNodeIds({
      categories,
      items,
      includeCategory: (category) => category.active !== false,
      includeItem: (item) => item.active !== false,
    })

    expect(roots.rootCategoryNodeIds).toEqual(['cat-a'])
    expect(roots.rootItemNodeIds).toEqual(['item-item-active'])
  })

  it('builds indexed child and lookup maps for browse mode', () => {
    const categories: ShopCategory[] = [
      { id: 'cat-a', name: 'Anchors', parentId: null, active: true },
      { id: 'cat-b', name: 'Bolts', parentId: 'cat-a', active: true },
    ]
    const items: ShopCatalogItem[] = [
      { id: 'item-a', description: 'Anchor kit', categoryId: 'cat-a', active: true },
      { id: 'item-root', description: 'Top Level', active: true },
    ]

    const index = buildCatalogTreeIndex({ categories, items })

    expect(index.rootCategoryNodeIds).toEqual(['cat-a'])
    expect(index.rootItemNodeIds).toEqual(['item-item-root'])
    expect(index.childIds.get('cat-a')).toEqual(['cat-b', 'item-item-a'])
    expect(index.categoryNodesById.get('cat-b')?.name).toBe('Bolts')
    expect(index.itemNodesById.get('item-item-a')?.description).toBe('Anchor kit')
  })
})
