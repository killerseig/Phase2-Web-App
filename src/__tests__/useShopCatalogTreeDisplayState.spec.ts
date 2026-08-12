import { computed, reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useShopCatalogTreeDisplayState } from '@/features/shopCatalog/useShopCatalogTreeDisplayState'
import type { ShopCatalogCategoryOption } from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'
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
    categoryId: null,
    description: 'Root Item',
    id: 'item-root',
    price: null,
    sku: null,
    ...overrides,
  }
}

function groupCategories(categories: readonly ShopCategoryRecord[]) {
  const grouped = new Map<string | null, ShopCategoryRecord[]>()
  for (const category of categories) {
    const parentId = category.parentId ?? null
    grouped.set(parentId, [...(grouped.get(parentId) ?? []), category])
  }
  return grouped
}

function groupItems(items: readonly ShopCatalogItemRecord[]) {
  const grouped = new Map<string | null, ShopCatalogItemRecord[]>()
  for (const item of items) {
    const parentId = item.categoryId ?? null
    grouped.set(parentId, [...(grouped.get(parentId) ?? []), item])
  }
  return grouped
}

function mountDisplayState(options: {
  createState?: {
    key: ShopCatalogTreeNode['key'] | null
    kind: 'category' | 'item' | null
    parentId: string | null
    value: string
  }
  expandedCategoryIds?: string[]
  rootBucketExpanded?: boolean
  selectedCategoryId?: string | null
  showArchived?: boolean
  treeSearch?: string
} = {}) {
  const categories = ref([
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-fasteners', name: 'Fasteners', parentId: 'cat-tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-fasteners' }),
    makeCategory({ id: 'cat-archived', name: 'Archived', active: false }),
  ])
  const items = ref([
    makeItem({ id: 'item-root', description: 'Root Level Item' }),
    makeItem({ id: 'item-drill', description: 'Cordless Drill', categoryId: 'cat-tools', sku: 'DR-1' }),
    makeItem({ id: 'item-archived', description: 'Archived Hammer', categoryId: 'cat-tools', active: false }),
  ])
  const childCategoriesByParent = computed(() => groupCategories(categories.value))
  const childItemsByParent = computed(() => groupItems(items.value))
  const expandedCategoryIds = ref<readonly string[]>(options.expandedCategoryIds ?? ['cat-tools'])
  const rootBucketExpanded = ref(options.rootBucketExpanded ?? true)
  const showArchived = ref(options.showArchived ?? false)
  const treeSearch = ref(options.treeSearch ?? '')
  const createState = reactive(options.createState ?? {
    key: null as ShopCatalogTreeNode['key'] | null,
    kind: null as 'category' | 'item' | null,
    parentId: null as string | null,
    value: '',
  })
  const categoryOptions = computed<ShopCatalogCategoryOption[]>(() => categories.value.map((category) => ({
    value: category.id,
    label: getCategoryPath(category.id),
  })))
  const selectedCategory = computed(() => (
    options.selectedCategoryId
      ? categories.value.find((category) => category.id === options.selectedCategoryId) ?? null
      : null
  ))

  function getCategoryPath(categoryId: string | null): string {
    if (!categoryId) return 'Top Level'
    const category = categories.value.find((candidate) => candidate.id === categoryId) ?? null
    if (!category) return 'Top Level'
    const parentPath = category.parentId ? `${getCategoryPath(category.parentId)} / ` : ''
    return `${parentPath}${category.name}`
  }

  function isVisible(active: boolean) {
    return showArchived.value || active
  }

  function getVisibleChildCategoryCount(categoryId: string | null) {
    return (childCategoriesByParent.value.get(categoryId) ?? [])
      .filter((category) => isVisible(category.active))
      .length
  }

  function getVisibleChildItemCount(categoryId: string | null) {
    return (childItemsByParent.value.get(categoryId) ?? [])
      .filter((item) => isVisible(item.active))
      .length
  }

  const display = useShopCatalogTreeDisplayState({
    categoryOptions,
    childCategoriesByParent,
    childItemsByParent,
    createState,
    expandedCategoryIds,
    getCategoryPath,
    getVisibleChildCategoryCount,
    getVisibleChildItemCount,
    rootBucketExpanded,
    selectedCategory,
    showArchived,
    treeSearch,
  })

  return {
    categories,
    createState,
    display,
    expandedCategoryIds,
    rootBucketExpanded,
    showArchived,
    treeSearch,
  }
}

describe('useShopCatalogTreeDisplayState', () => {
  it('derives root counts, summary copy, and top-level child state', () => {
    const { display } = mountDisplayState()

    expect(display.visibleRootCategoryCount.value).toBe(1)
    expect(display.visibleRootItemCount.value).toBe(1)
    expect(display.rootBucketSummary.value).toBe('1 folder | 1 item')
    expect(display.rootBucketHasChildren.value).toBe(true)
  })

  it('uses top-level inline create state to keep an otherwise empty root bucket visible', () => {
    const { display } = mountDisplayState({
      createState: {
        key: 'draft:category:root' as ShopCatalogTreeNode['key'],
        kind: 'category',
        parentId: null,
        value: '',
      },
    })

    expect(display.rootBucketHasChildren.value).toBe(true)
    expect(display.treeNodes.value.map((node) => node.label)).toContain('New Folder')
  })

  it('builds tree nodes from expansion state and visible active records', () => {
    const { display } = mountDisplayState()

    const labels = display.treeNodes.value.map((node) => node.label)

    expect(labels).toEqual([
      'Tools',
      'Fasteners',
      'Cordless Drill',
      'Root Level Item',
    ])
    expect(display.treeNodes.value.find((node) => node.label === 'Tools')?.secondary).toBe('1 folder | 1 item')
    expect(display.treeNodes.value.find((node) => node.label === 'Cordless Drill')?.secondary).toBe('SKU DR-1')
    expect(labels).not.toContain('Archived')
    expect(labels).not.toContain('Archived Hammer')
  })

  it('searches collapsed branches and matches category paths', () => {
    const { display } = mountDisplayState({
      expandedCategoryIds: [],
      rootBucketExpanded: false,
      treeSearch: 'bits',
    })

    expect(display.treeNodes.value.map((node) => node.label)).toEqual(['Bits'])
  })

  it('includes archived records when archived mode is enabled', () => {
    const { display, showArchived } = mountDisplayState()

    showArchived.value = true

    const labels = display.treeNodes.value.map((node) => node.label)

    expect(display.visibleRootCategoryCount.value).toBe(2)
    expect(display.treeNodes.value.find((node) => node.label === 'Tools')?.secondary).toBe('1 folder | 2 items')
    expect(labels).toContain('Archived')
    expect(labels).toContain('Archived Hammer')
  })

  it('filters parent options to prevent selecting the current folder or descendants', () => {
    const { display } = mountDisplayState({
      selectedCategoryId: 'cat-tools',
    })

    expect(display.detailCategoryParentOptions.value).toEqual([
      {
        value: 'cat-archived',
        label: 'Archived',
      },
    ])
  })

  it('reacts to root expansion and create-state changes', () => {
    const { createState, display, rootBucketExpanded } = mountDisplayState()

    rootBucketExpanded.value = false
    expect(display.treeNodes.value).toEqual([])

    createState.key = 'draft:item:root' as ShopCatalogTreeNode['key']
    createState.kind = 'item'
    createState.parentId = null
    createState.value = 'Temporary Item'

    rootBucketExpanded.value = true

    expect(display.treeNodes.value.map((node) => node.label)).toContain('Temporary Item')
  })
})
