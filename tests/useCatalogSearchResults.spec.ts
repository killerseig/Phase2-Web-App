import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { useCatalogSearchResults } from '@/composables/useCatalogSearchResults'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

const categoriesFixture: ShopCategory[] = [
  { id: 'cat-fasteners', name: 'Fasteners', parentId: null, active: true },
  { id: 'cat-anchors', name: 'Anchors', parentId: 'cat-fasteners', active: true },
  { id: 'cat-kit-bits', name: 'Bits', parentId: 'item-item-kit', active: true },
]

const itemsFixture: ShopCatalogItem[] = [
  { id: 'item-anchor', description: 'Lag Anchor', sku: 'AN-200', categoryId: 'cat-anchors', active: true },
  { id: 'item-kit', description: 'Driver Kit', sku: 'KIT-100', active: true },
  { id: 'item-bit', description: 'Phillips Bit', sku: 'BIT-1', categoryId: 'cat-kit-bits', active: true },
  { id: 'item-legacy', description: 'Legacy Leaf', sku: 'LEG-1', price: 9.5, active: true },
]

function mountComposable(
  initialQuery = '',
  overrides: Partial<Parameters<typeof useCatalogSearchResults>[0]> = {}
) {
  const categories = ref<ShopCategory[]>(categoriesFixture)
  const allItems = ref<ShopCatalogItem[]>(itemsFixture)
  const searchQuery = ref(initialQuery)
  const scope = effectScope()

  const search = scope.run(() =>
    useCatalogSearchResults({
      searchQuery,
      categories,
      allItems,
      debounceMs: 0,
      ...overrides,
    })
  )

  if (!search) throw new Error('Failed to mount search composable')

  return {
    scope,
    search,
    searchQuery,
  }
}

describe('useCatalogSearchResults', () => {
  afterEach(() => {
    // nothing to reset; keeps suite pattern consistent
  })

  it('matches items by direct fields and breadcrumb path', () => {
    const { scope, search, searchQuery } = mountComposable()

    searchQuery.value = 'lag anchor'
    expect(search.isSearching.value).toBe(true)
    expect(search.results.value).toHaveLength(1)
    expect(search.results.value[0]).toMatchObject({
      nodeId: 'item-item-anchor',
      kind: 'item',
      label: 'Lag Anchor',
      breadcrumbLabel: 'Fasteners > Anchors',
      matchStrength: 'primary',
    })

    searchQuery.value = 'fasteners anchors'
    expect(search.results.value[0]?.label).toBe('Lag Anchor')
    expect(search.results.value[0]?.matchStrength).toBe('tertiary')

    scope.stop()
  })

  it('supports terminal-node search for ordering without returning branch items', () => {
    const { scope, search, searchQuery } = mountComposable('', {
      includeCategory: (category, { hasChildren }) => category.active && !hasChildren,
      includeItem: (item, { hasChildren }) => item.active && !hasChildren,
    })

    searchQuery.value = 'kit'

    const labels = search.results.value.map((result) => result.label)
    expect(labels).toContain('Phillips Bit')
    expect(labels).not.toContain('Driver Kit')

    const bitResult = search.results.value.find((result) => result.label === 'Phillips Bit')
    expect(bitResult?.breadcrumbLabel).toBe('Driver Kit > Bits')

    searchQuery.value = 'legacy'
    expect(search.results.value.map((result) => result.label)).toEqual(['Legacy Leaf'])
    expect(search.results.value[0]).toMatchObject({
      kind: 'item',
      sku: 'LEG-1',
      price: 9.5,
    })

    scope.stop()
  })

  it('caps broad searches to the configured result limit', () => {
    const { scope, search, searchQuery } = mountComposable('', {
      maxResults: 1,
    })

    searchQuery.value = 'i'

    expect(search.totalResultCount.value).toBeGreaterThan(1)
    expect(search.results.value).toHaveLength(1)
    expect(search.hasMoreResults.value).toBe(true)

    scope.stop()
  })
})
