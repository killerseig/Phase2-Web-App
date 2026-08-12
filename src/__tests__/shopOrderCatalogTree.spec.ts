import { describe, expect, it } from 'vitest'

import { buildShopOrderCatalogTreeNodes } from '@/features/shopOrders/catalogBrowserHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

const categories: ShopCategoryRecord[] = [
  {
    id: 'cat-lighting',
    name: 'Lighting',
    parentId: null,
    active: true,
  },
  {
    id: 'cat-lifts',
    name: 'Lifts',
    parentId: null,
    active: true,
  },
  {
    id: 'cat-archived',
    name: 'Archived',
    parentId: null,
    active: false,
  },
]

const catalogItems: ShopCatalogItemRecord[] = [
  {
    id: 'item-bulb',
    description: 'Light Bulb - 24 Pack',
    categoryId: 'cat-lighting',
    sku: 'LB-24',
    price: null,
    active: true,
  },
  {
    id: 'item-lift',
    description: 'Scissor Lift',
    categoryId: 'cat-lifts',
    sku: null,
    price: null,
    active: true,
  },
  {
    id: 'item-archived',
    description: 'Archived Item',
    categoryId: null,
    sku: null,
    price: null,
    active: false,
  },
]

function groupCategoriesByParent(records: readonly ShopCategoryRecord[]) {
  const map = new Map<string | null, ShopCategoryRecord[]>()
  for (const category of records) {
    const key = category.parentId ?? null
    map.set(key, [...map.get(key) ?? [], category])
  }
  for (const siblings of map.values()) {
    siblings.sort((left, right) => left.name.localeCompare(right.name))
  }
  return map
}

function groupItemsByParent(records: readonly ShopCatalogItemRecord[]) {
  const map = new Map<string | null, ShopCatalogItemRecord[]>()
  for (const item of records) {
    const key = item.categoryId ?? null
    map.set(key, [...map.get(key) ?? [], item])
  }
  for (const siblings of map.values()) {
    siblings.sort((left, right) => left.description.localeCompare(right.description))
  }
  return map
}

function buildNodes(overrides = {}) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return buildShopOrderCatalogTreeNodes({
    treeSearch: '',
    expandedCategoryIds: [],
    collapsedCategoryIdsDuringSearch: [],
    categoriesById,
    childCategoriesByParent: groupCategoriesByParent(categories),
    childItemsByParent: groupItemsByParent(catalogItems),
    getCategoryPath: (categoryId) => {
      if (!categoryId) return 'Top Level'
      return categoriesById.get(categoryId)?.name ?? 'Top Level'
    },
    ...overrides,
  })
}

describe('shop order catalog tree helper', () => {
  it('builds active category rows and hides collapsed item rows when not searching', () => {
    const nodes = buildNodes()

    expect(nodes.map((node) => node.label)).toEqual(['Lifts', 'Lighting'])
    expect(nodes.map((node) => node.label)).not.toContain('Light Bulb - 24 Pack')
    expect(nodes.map((node) => node.label)).not.toContain('Archived')
  })

  it('shows item rows for expanded categories', () => {
    const nodes = buildNodes({
      expandedCategoryIds: ['cat-lighting'],
    })

    expect(nodes.map((node) => node.label)).toEqual([
      'Lifts',
      'Lighting',
      'Light Bulb - 24 Pack',
    ])
  })

  it('searches through item names, SKU, and category paths while expanding matching branches', () => {
    const nodes = buildNodes({
      treeSearch: 'lb-24',
    })

    expect(nodes.map((node) => node.label)).toEqual(['Lighting', 'Light Bulb - 24 Pack'])
  })

  it('allows matching search folders to stay collapsed when the user collapses them during search', () => {
    const nodes = buildNodes({
      treeSearch: 'lift',
      collapsedCategoryIdsDuringSearch: ['cat-lifts'],
    })

    expect(nodes.map((node) => node.label)).toEqual(['Lifts'])
  })
})
