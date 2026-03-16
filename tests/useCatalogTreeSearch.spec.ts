import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCatalogTreeSearch } from '@/composables/useCatalogTreeSearch'
import type { ShopCatalogItem } from '@/services'
import type { CategoryNode, ShopCategory } from '@/stores/shopCategories'

const categoriesFixture: ShopCategory[] = [
  { id: 'cat-screws', name: 'Screws', parentId: null, active: true },
  { id: 'cat-anchors', name: 'Anchors', parentId: null, active: true },
  { id: 'cat-wood', name: 'Wood', parentId: 'cat-screws', active: true },
]

const fullTreeFixture: CategoryNode[] = [
  {
    id: 'cat-anchors',
    name: 'Anchors',
    parentId: null,
    active: true,
    children: [],
  },
  {
    id: 'cat-screws',
    name: 'Screws',
    parentId: null,
    active: true,
    children: [
      {
        id: 'cat-wood',
        name: 'Wood',
        parentId: 'cat-screws',
        active: true,
        children: [],
      },
    ],
  },
]

const itemsFixture: ShopCatalogItem[] = [
  { id: 'item-anchor', description: 'Lag Anchor', sku: 'AN-200', categoryId: 'cat-anchors', active: true },
  { id: 'item-deck', description: 'Deck Screw', sku: 'SC-100', categoryId: 'cat-screws', active: true },
  { id: 'item-wood', description: 'Wood Screw', sku: 'WOOD-300', categoryId: 'cat-wood', active: true },
  { id: 'item-loose', description: 'Loose Washer', sku: 'WS-001', active: true },
]

function mountComposable(initialQuery = '') {
  const categories = ref<ShopCategory[]>(categoriesFixture)
  const allItems = ref<ShopCatalogItem[]>(itemsFixture)
  const fullTree = ref<CategoryNode[]>(fullTreeFixture)
  const searchQuery = ref(initialQuery)
  const scope = effectScope()

  const search = scope.run(() =>
    useCatalogTreeSearch({
      searchQuery,
      categories,
      allItems,
      fullTree,
      getCategoryById: (id) => categories.value.find((category) => category.id === id),
      getChildren: (parentId) => categories.value.filter((category) => category.parentId === parentId),
      includeItem: (item) => item.active,
      debounceMs: 10,
    })
  )

  if (!search) throw new Error('Failed to mount composable')

  return {
    scope,
    search,
    searchQuery,
  }
}

async function flushSearch(delay = 10) {
  await nextTick()
  vi.advanceTimersByTime(delay)
  await nextTick()
}

describe('useCatalogTreeSearch', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-expands the direct path to a matching leaf item', async () => {
    vi.useFakeTimers()
    const { scope, search, searchQuery } = mountComposable()

    searchQuery.value = 'lag anchor'
    await flushSearch()

    expect(search.isSearching.value).toBe(true)
    expect(search.visibleRootCategoryNodeIds.value).toEqual(['cat-anchors'])
    expect(search.autoExpandedNodeIds.value.has('cat-anchors')).toBe(true)
    expect(search.searchVisibleIds.value.has('cat-anchors')).toBe(true)
    expect(search.searchVisibleIds.value.has('item-item-anchor')).toBe(true)
    expect(search.searchVisibleChildCounts.value.get('cat-anchors')).toBe(1)
    expect(search.searchDirectMatchStrengths.value.get('item-item-anchor')).toBe('primary')

    scope.stop()
  })

  it('auto-expands a directly matching category so users can browse it', async () => {
    vi.useFakeTimers()
    const { scope, search, searchQuery } = mountComposable()

    searchQuery.value = 'screws'
    await flushSearch()

    expect(search.visibleRootCategoryNodeIds.value).toContain('cat-screws')
    expect(search.searchCategoryDirectMatchIds.value.has('cat-screws')).toBe(true)
    expect(search.autoExpandedNodeIds.value.has('cat-screws')).toBe(true)

    scope.stop()
  })

  it('matches secondary visible fields like SKU without hitting Firebase', async () => {
    vi.useFakeTimers()
    const { scope, search, searchQuery } = mountComposable()

    searchQuery.value = 'WOOD-300'
    await flushSearch()

    expect(search.visibleRootCategoryNodeIds.value).toEqual(['cat-screws'])
    expect(search.autoExpandedNodeIds.value.has('cat-screws')).toBe(true)
    expect(search.autoExpandedNodeIds.value.has('cat-wood')).toBe(true)
    expect(search.searchDirectMatchStrengths.value.get('item-item-wood')).toBe('secondary')

    scope.stop()
  })

  it('auto-expands all visible nodes even for broad searches', async () => {
    vi.useFakeTimers()
    const { scope, search, searchQuery } = mountComposable()

    searchQuery.value = 's'
    await flushSearch()

    expect(search.isSearching.value).toBe(true)
    expect(search.visibleRootCategoryNodeIds.value).toContain('cat-screws')
    expect(search.autoExpandedNodeIds.value.size).toBeGreaterThan(0)

    scope.stop()
  })

  it('restores the full in-memory tree when the search is cleared', async () => {
    vi.useFakeTimers()
    const { scope, search, searchQuery } = mountComposable('washer')

    await flushSearch()
    expect(search.isSearching.value).toBe(true)
    expect(search.visibleUncategorizedItemNodeIds.value).toEqual(['item-item-loose'])

    searchQuery.value = ''
    await flushSearch()

    expect(search.isSearching.value).toBe(false)
    expect(search.visibleRootCategoryNodeIds.value).toEqual(['cat-anchors', 'cat-screws'])
    expect(search.visibleUncategorizedItemNodeIds.value).toEqual(['item-item-loose'])
    expect(search.autoExpandedNodeIds.value.size).toBe(0)

    scope.stop()
  })
})
