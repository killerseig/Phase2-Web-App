import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import {
  formatShopCatalogFolderItemSummary,
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
  normalizeShopCatalogSearch,
} from '@/features/shopCatalog/catalogDisplayHelpers'

export type ShopOrderCatalogTreeNode =
  | {
      key: `category:${string}`
      kind: 'category'
      id: string
      parentId: string | null
      depth: number
      label: string
      secondary: string
      hasChildren: boolean
    }
  | {
      key: `item:${string}`
      kind: 'item'
      id: string
      parentId: string | null
      depth: number
      label: string
    }

interface BuildShopOrderCatalogTreeNodesOptions {
  treeSearch: string
  expandedCategoryIds: readonly string[]
  collapsedCategoryIdsDuringSearch: readonly string[]
  categoriesById: ReadonlyMap<string, ShopCategoryRecord>
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>
  getCategoryPath: (categoryId: string | null) => string
}

function countActiveCategories(
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
  categoryId: string | null,
) {
  return (childCategoriesByParent.get(categoryId) ?? []).filter((category) => category.active).length
}

function countActiveItems(
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>,
  categoryId: string | null,
) {
  return (childItemsByParent.get(categoryId) ?? []).filter((item) => item.active).length
}

function hasActiveChildren(
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>,
  categoryId: string | null,
) {
  return countActiveCategories(childCategoriesByParent, categoryId) > 0 || countActiveItems(childItemsByParent, categoryId) > 0
}

export function buildShopOrderCatalogTreeNodes(
  options: BuildShopOrderCatalogTreeNodesOptions,
): ShopOrderCatalogTreeNode[] {
  const {
    treeSearch,
    expandedCategoryIds,
    collapsedCategoryIdsDuringSearch,
    categoriesById,
    childCategoriesByParent,
    childItemsByParent,
    getCategoryPath,
  } = options
  const query = normalizeShopCatalogSearch(treeSearch)
  const isSearchActive = query.length > 0
  const expandedCategorySet = new Set(expandedCategoryIds)
  const collapsedDuringSearchSet = new Set(collapsedCategoryIdsDuringSearch)

  const itemMatchesSearch = (item: ShopCatalogItemRecord) => {
    if (!item.active) return false
    if (!query) return true

    const haystack = [
      getShopCatalogItemDisplayName(item),
      item.sku ?? '',
      getCategoryPath(item.categoryId),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  }

  const categoryMatchesSearch = (categoryId: string): boolean => {
    const category = categoriesById.get(categoryId)
    if (!category || !category.active) return false

    if (!query) return true
    if (getShopCategoryDisplayName(category).toLowerCase().includes(query)) return true

    const directItems = childItemsByParent.get(categoryId) ?? []
    if (directItems.some((item) => itemMatchesSearch(item))) return true

    const childCategories = childCategoriesByParent.get(categoryId) ?? []
    return childCategories.some((child) => categoryMatchesSearch(child.id))
  }

  const isCategoryEffectivelyExpanded = (categoryId: string) => {
    if (isSearchActive) return !collapsedDuringSearchSet.has(categoryId)
    return expandedCategorySet.has(categoryId)
  }

  const buildNodes = (parentId: string | null, depth: number): ShopOrderCatalogTreeNode[] => {
    const nodes: ShopOrderCatalogTreeNode[] = []
    const visibleCategories = (childCategoriesByParent.get(parentId) ?? []).filter(
      (category) => category.active && categoryMatchesSearch(category.id),
    )

    for (const category of visibleCategories) {
      nodes.push({
        key: `category:${category.id}`,
        kind: 'category',
        id: category.id,
        parentId: category.parentId,
        depth,
        label: getShopCategoryDisplayName(category),
        secondary: formatShopCatalogFolderItemSummary(
          countActiveCategories(childCategoriesByParent, category.id),
          countActiveItems(childItemsByParent, category.id),
        ),
        hasChildren: hasActiveChildren(childCategoriesByParent, childItemsByParent, category.id),
      })

      if (isCategoryEffectivelyExpanded(category.id)) {
        nodes.push(...buildNodes(category.id, depth + 1))
      }
    }

    const visibleItems = (childItemsByParent.get(parentId) ?? []).filter((item) => itemMatchesSearch(item))
    for (const item of visibleItems) {
      nodes.push({
        key: `item:${item.id}`,
        kind: 'item',
        id: item.id,
        parentId: item.categoryId,
        depth,
        label: getShopCatalogItemDisplayName(item),
      })
    }

    return nodes
  }

  return buildNodes(null, 1)
}
