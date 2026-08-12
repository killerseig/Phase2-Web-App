import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useShopCatalogTreeExpansion } from '@/features/shopCatalog/useShopCatalogTreeExpansion'
import type { ShopCategoryRecord } from '@/types/domain'

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    active: true,
    id: 'cat-tools',
    name: 'Tools',
    parentId: null,
    ...overrides,
  }
}

function mountExpansion(options: {
  categories?: ShopCategoryRecord[]
  showArchived?: boolean
} = {}) {
  const categories = ref<ShopCategoryRecord[]>(options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-drills', name: 'Drills', parentId: 'cat-tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-drills' }),
    makeCategory({ id: 'cat-archived', name: 'Archived', active: false }),
  ])
  const showArchived = ref(options.showArchived ?? false)
  const closeContextMenu = vi.fn()
  const categoriesById = computed(() => new Map(
    categories.value.map((category) => [category.id, category]),
  ))
  const expansion = useShopCatalogTreeExpansion({
    categories,
    categoriesById,
    closeContextMenu,
    showArchived,
  })

  return {
    categories,
    closeContextMenu,
    expansion,
    showArchived,
  }
}

describe('useShopCatalogTreeExpansion', () => {
  it('initializes root categories only', () => {
    const { expansion } = mountExpansion()

    expansion.initializeRootCategories()

    expect(expansion.expandedCategoryIds.value).toEqual(['cat-tools'])
  })

  it('accepts an explicit category list when initializing roots', () => {
    const { expansion } = mountExpansion()

    expansion.initializeRootCategories([
      makeCategory({ id: 'cat-new-root', name: 'New Root' }),
      makeCategory({ id: 'cat-new-child', name: 'New Child', parentId: 'cat-new-root' }),
    ])

    expect(expansion.expandedCategoryIds.value).toEqual(['cat-new-root'])
  })

  it('expands a category and every ancestor without dropping existing expanded folders', () => {
    const { expansion } = mountExpansion()
    expansion.expandedCategoryIds.value = ['cat-existing']

    expansion.ensureExpandedToCategory('cat-bits')

    expect(new Set(expansion.expandedCategoryIds.value)).toEqual(new Set([
      'cat-existing',
      'cat-bits',
      'cat-drills',
      'cat-tools',
    ]))
  })

  it('ignores missing category ids while preserving current expansion state', () => {
    const { expansion } = mountExpansion()
    expansion.expandedCategoryIds.value = ['cat-tools']

    expansion.ensureExpandedToCategory(null)

    expect(expansion.expandedCategoryIds.value).toEqual(['cat-tools'])
  })

  it('toggles individual category expansion', () => {
    const { expansion } = mountExpansion()

    expansion.toggleCategoryExpanded('cat-tools')
    expect(expansion.isCategoryExpanded('cat-tools')).toBe(true)

    expansion.toggleCategoryExpanded('cat-tools')
    expect(expansion.isCategoryExpanded('cat-tools')).toBe(false)
  })

  it('expands all visible categories and closes the context menu', () => {
    const { closeContextMenu, expansion } = mountExpansion()

    expansion.expandAllCategories()

    expect(expansion.rootBucketExpanded.value).toBe(true)
    expect(expansion.expandedCategoryIds.value).toEqual([
      'cat-tools',
      'cat-drills',
      'cat-bits',
    ])
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
  })

  it('includes archived categories when the archived filter is enabled', () => {
    const { expansion, showArchived } = mountExpansion()

    showArchived.value = true

    expect(expansion.getVisibleCategoryIds()).toEqual([
      'cat-tools',
      'cat-drills',
      'cat-bits',
      'cat-archived',
    ])
  })

  it('collapses all categories, closes the context menu, and hides the root bucket', () => {
    const { closeContextMenu, expansion } = mountExpansion()
    expansion.expandedCategoryIds.value = ['cat-tools', 'cat-drills']

    expansion.collapseAllCategories()

    expect(expansion.rootBucketExpanded.value).toBe(false)
    expect(expansion.expandedCategoryIds.value).toEqual([])
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
  })

  it('toggles the root bucket independently from category expansion', () => {
    const { expansion } = mountExpansion()
    expansion.expandedCategoryIds.value = ['cat-tools']

    expansion.toggleRootBucketExpanded()

    expect(expansion.rootBucketExpanded.value).toBe(false)
    expect(expansion.expandedCategoryIds.value).toEqual(['cat-tools'])
  })
})
