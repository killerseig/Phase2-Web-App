import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useShopCatalogDerivedData } from '@/features/shopCatalog/useShopCatalogDerivedData'
import { useShopCatalogInspectorSummary } from '@/features/shopCatalog/useShopCatalogInspectorSummary'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    active: true,
    id: 'cat-tools',
    name: 'Tools',
    parentId: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShopCatalogItemRecord> = {}): ShopCatalogItemRecord {
  return {
    active: true,
    categoryId: 'cat-tools',
    description: 'Cordless Drill',
    id: 'item-drill',
    price: 12.5,
    sku: 'DR-1',
    ...overrides,
  }
}

function mountDerivedData() {
  const categories = ref<ShopCategoryRecord[]>([
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-tools' }),
    makeCategory({ active: false, id: 'cat-archived', name: 'Archived', parentId: 'cat-tools' }),
    makeCategory({ id: 'cat-root-empty-name', name: '   ' }),
  ])
  const items = ref<ShopCatalogItemRecord[]>([
    makeItem({ id: 'item-drill', description: 'Cordless Drill', categoryId: 'cat-tools', sku: 'DR-1', price: 12.5 }),
    makeItem({ id: 'item-bit', description: 'Bit Set', categoryId: 'cat-bits', sku: null, price: null }),
    makeItem({ active: false, id: 'item-archived', description: 'Archived Item', categoryId: 'cat-tools' }),
    makeItem({ id: 'item-root', description: 'Root Item', categoryId: null }),
  ])
  const showArchived = ref(false)
  const derived = useShopCatalogDerivedData({
    categories,
    items,
    showArchived,
  })

  return {
    categories,
    derived,
    items,
    showArchived,
  }
}

describe('useShopCatalogDerivedData', () => {
  it('builds category and item indexes grouped and sorted by parent', () => {
    const { derived } = mountDerivedData()

    expect(derived.categoriesById.value.get('cat-tools')?.name).toBe('Tools')
    expect(derived.childCategoriesByParent.value.get(null)?.map((category) => category.id)).toEqual([
      'cat-tools',
      'cat-root-empty-name',
    ])
    expect(derived.childCategoriesByParent.value.get('cat-tools')?.map((category) => category.id)).toEqual([
      'cat-archived',
      'cat-bits',
    ])
    expect(derived.childItemsByParent.value.get('cat-tools')?.map((item) => item.id)).toEqual([
      'item-archived',
      'item-drill',
    ])
  })

  it('derives visible counts and child counts from archived visibility', () => {
    const { derived, showArchived } = mountDerivedData()

    expect(derived.visibleFolderCount.value).toBe(3)
    expect(derived.visibleItemCount.value).toBe(3)
    expect(derived.getDirectChildCategoryCount('cat-tools')).toBe(2)
    expect(derived.getDirectChildItemCount('cat-tools')).toBe(2)
    expect(derived.getVisibleChildCategoryCount('cat-tools')).toBe(1)
    expect(derived.getVisibleChildItemCount('cat-tools')).toBe(1)

    showArchived.value = true

    expect(derived.visibleFolderCount.value).toBe(4)
    expect(derived.visibleItemCount.value).toBe(4)
    expect(derived.getVisibleChildCategoryCount('cat-tools')).toBe(2)
    expect(derived.getVisibleChildItemCount('cat-tools')).toBe(2)
  })

  it('builds category paths and parent options with display fallbacks', () => {
    const { derived } = mountDerivedData()

    expect(derived.getCategoryPath(null)).toBe('Top Level')
    expect(derived.getCategoryPath('cat-bits')).toBe('Tools / Bits')
    expect(derived.getCategoryPath('missing-category')).toBe('Top Level')
    expect(derived.categoryOptions.value).toEqual([
      { value: 'cat-tools', label: 'Tools' },
      { value: 'cat-bits', label: 'Tools / Bits' },
      { value: 'cat-archived', label: 'Tools / Archived' },
      { value: 'cat-root-empty-name', label: 'Untitled Folder' },
    ])
  })

  it('reacts when catalog records change', () => {
    const { categories, derived, items } = mountDerivedData()

    categories.value = [
      ...categories.value,
      makeCategory({ id: 'cat-new', name: 'New Folder', parentId: 'cat-bits' }),
    ]
    items.value = [
      ...items.value,
      makeItem({ id: 'item-new', description: 'A New Item', categoryId: 'cat-bits' }),
    ]

    expect(derived.getCategoryPath('cat-new')).toBe('Tools / Bits / New Folder')
    expect(derived.getDirectChildCategoryCount('cat-bits')).toBe(1)
    expect(derived.childItemsByParent.value.get('cat-bits')?.map((item) => item.id)).toEqual([
      'item-new',
      'item-bit',
    ])
  })
})

describe('useShopCatalogInspectorSummary', () => {
  it('summarizes selected folders with path, title, child state, and direct counts', () => {
    const { derived } = mountDerivedData()
    const selectedCategory = ref<ShopCategoryRecord | null>(makeCategory({
      id: 'cat-tools',
      name: 'Tools',
      parentId: null,
    }))
    const selectedItem = ref<ShopCatalogItemRecord | null>(null)
    const summary = useShopCatalogInspectorSummary({
      childCategoriesByParent: derived.childCategoriesByParent,
      childItemsByParent: derived.childItemsByParent,
      getCategoryPath: derived.getCategoryPath,
      selectedCategory,
      selectedItem,
    })

    expect(summary.selectedCategoryTitle.value).toBe('Tools')
    expect(summary.selectedCategoryPathLabel.value).toBe('Top Level')
    expect(summary.selectedCategorySummaryLabel.value).toBe('2 folders | 2 items')
    expect(summary.selectedCategoryHasChildren.value).toBe(true)

    selectedCategory.value = makeCategory({ id: 'cat-root-empty-name', name: '   ', parentId: null })

    expect(summary.selectedCategoryTitle.value).toBe('Untitled Folder')
    expect(summary.selectedCategorySummaryLabel.value).toBe('No direct contents')
    expect(summary.selectedCategoryHasChildren.value).toBe(false)
  })

  it('summarizes selected items with title, path, SKU, and price labels', () => {
    const { derived } = mountDerivedData()
    const selectedCategory = ref<ShopCategoryRecord | null>(null)
    const selectedItem = ref<ShopCatalogItemRecord | null>(makeItem({
      categoryId: 'cat-bits',
      description: '  ',
      price: 7,
      sku: 'B-7',
    }))
    const summary = useShopCatalogInspectorSummary({
      childCategoriesByParent: derived.childCategoriesByParent,
      childItemsByParent: derived.childItemsByParent,
      getCategoryPath: derived.getCategoryPath,
      selectedCategory,
      selectedItem,
    })

    expect(summary.selectedItemTitle.value).toBe('Untitled Item')
    expect(summary.selectedItemPathLabel.value).toBe('Tools / Bits')
    expect(summary.selectedItemSkuLabel.value).toBe('SKU B-7')
    expect(summary.selectedItemPriceLabel.value).toBe('$7.00')

    selectedItem.value = makeItem({
      categoryId: null,
      description: 'Root Item',
      price: null,
      sku: null,
    })

    expect(summary.selectedItemTitle.value).toBe('Root Item')
    expect(summary.selectedItemPathLabel.value).toBe('Top Level')
    expect(summary.selectedItemSkuLabel.value).toBe('No SKU')
    expect(summary.selectedItemPriceLabel.value).toBe('No Price')
  })

  it('returns blank labels when nothing is selected', () => {
    const { derived } = mountDerivedData()
    const summary = useShopCatalogInspectorSummary({
      childCategoriesByParent: derived.childCategoriesByParent,
      childItemsByParent: derived.childItemsByParent,
      getCategoryPath: derived.getCategoryPath,
      selectedCategory: computed(() => null),
      selectedItem: computed(() => null),
    })

    expect(summary.selectedCategoryTitle.value).toBe('')
    expect(summary.selectedCategoryPathLabel.value).toBe('')
    expect(summary.selectedCategorySummaryLabel.value).toBe('')
    expect(summary.selectedCategoryHasChildren.value).toBe(false)
    expect(summary.selectedItemTitle.value).toBe('')
    expect(summary.selectedItemPathLabel.value).toBe('')
    expect(summary.selectedItemSkuLabel.value).toBe('No SKU')
    expect(summary.selectedItemPriceLabel.value).toBe('No Price')
  })
})
