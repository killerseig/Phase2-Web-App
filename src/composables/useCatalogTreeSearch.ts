import { computed, type Ref } from 'vue'
import type { ShopCatalogItem } from '@/services'
import type { CategoryNode, ShopCategory } from '@/stores/shopCategories'

const ITEM_PREFIX = 'item-'
const DEFAULT_MAX_DEPTH = 50

type UseCatalogTreeSearchOptions = {
  searchQuery: Ref<string>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  fullTree: Ref<CategoryNode[]>
  getCategoryById: (id: string) => ShopCategory | undefined
  getChildren: (parentId: string) => ShopCategory[]
  includeItem?: (item: ShopCatalogItem) => boolean
  maxDepth?: number
}

export function useCatalogTreeSearch(options: UseCatalogTreeSearchOptions) {
  const includeItem = options.includeItem ?? (() => true)
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const normalizedQuery = computed(() => options.searchQuery.value.trim().toLowerCase())

  const itemMatchesSearch = (item: ShopCatalogItem): boolean => {
    if (!normalizedQuery.value) return true
    const desc = item.description?.toLowerCase() ?? ''
    const sku = item.sku?.toLowerCase() ?? ''
    return desc.includes(normalizedQuery.value) || sku.includes(normalizedQuery.value)
  }

  const getChildrenForParent = (parentId: string): ShopCategory[] => {
    const children = options.getChildren(parentId)
    if (!parentId.startsWith(ITEM_PREFIX)) return children

    const rawItemId = parentId.slice(ITEM_PREFIX.length)
    if (!rawItemId) return children

    const aliasChildren = options.getChildren(rawItemId)
    if (aliasChildren.length === 0) return children

    const seen = new Set(children.map((child) => child.id))
    return [...children, ...aliasChildren.filter((child) => !seen.has(child.id))]
  }

  const categoryHasMatchingItems = (
    categoryId: string,
    depth = 0,
    seen = new Set<string>()
  ): boolean => {
    if (depth > maxDepth || seen.has(categoryId)) return false
    if (!normalizedQuery.value) return true

    const nextSeen = new Set(seen)
    nextSeen.add(categoryId)

    const category = options.getCategoryById(categoryId)
    if (category?.name?.toLowerCase().includes(normalizedQuery.value)) {
      return true
    }

    const directItems = options.allItems.value.filter(
      (item) => item.categoryId === categoryId && includeItem(item)
    )
    if (directItems.some((item) => itemMatchesSearch(item))) return true

    const children = getChildrenForParent(categoryId)
    return children.some((child) => categoryHasMatchingItems(child.id, depth + 1, nextSeen))
  }

  const categoryHasMatchingDescendants = (
    categoryId: string,
    depth = 0,
    seen = new Set<string>()
  ): boolean => {
    if (depth > maxDepth || seen.has(categoryId)) return false
    if (!normalizedQuery.value) return false

    const nextSeen = new Set(seen)
    nextSeen.add(categoryId)

    const directItems = options.allItems.value.filter(
      (item) => item.categoryId === categoryId && includeItem(item)
    )
    if (directItems.some((item) => itemMatchesSearch(item))) return true

    const children = getChildrenForParent(categoryId)
    return children.some((child) => categoryHasMatchingItems(child.id, depth + 1, nextSeen))
  }

  const filterCategoryTree = (tree: CategoryNode[]): CategoryNode[] => {
    return tree
      .filter((category) => {
        if (!normalizedQuery.value) return true
        return categoryHasMatchingDescendants(category.id)
      })
      .map((category) => ({
        ...category,
        children: filterCategoryTree(category.children),
      }))
  }

  const filteredCategoryTree = computed(() => filterCategoryTree(options.fullTree.value))

  const filteredUncategorizedItemNodeIds = computed(() => {
    return options.allItems.value
      .filter((item) => !item.categoryId && includeItem(item) && itemMatchesSearch(item))
      .map((item) => `${ITEM_PREFIX}${item.id}`)
  })

  const resolveParentNodeId = (parentId: string) => {
    if (parentId.startsWith(ITEM_PREFIX)) return parentId
    return options.allItems.value.some((item) => item.id === parentId) ? `${ITEM_PREFIX}${parentId}` : parentId
  }

  const buildExpandedNodesForSearch = (): Set<string> => {
    if (!normalizedQuery.value) return new Set()

    const nodesToExpand = new Set<string>()

    const expandCategoryAndParents = (categoryId: string, depth = 0) => {
      if (depth > maxDepth) return
      nodesToExpand.add(categoryId)

      const category = options.getCategoryById(categoryId)
      if (!category?.parentId) return

      const parentNodeId = resolveParentNodeId(category.parentId)
      nodesToExpand.add(parentNodeId)
      expandCategoryAndParents(parentNodeId, depth + 1)
    }

    const expandChildrenWithMatches = (parentId: string, depth = 0) => {
      if (depth > maxDepth) return
      const children = getChildrenForParent(parentId)
      children.forEach((child) => {
        if (!categoryHasMatchingDescendants(child.id)) return
        nodesToExpand.add(child.id)
        expandChildrenWithMatches(child.id, depth + 1)
      })
    }

    options.categories.value.forEach((category) => {
      if (!categoryHasMatchingDescendants(category.id)) return
      expandCategoryAndParents(category.id)
      expandChildrenWithMatches(category.id)
    })

    options.allItems.value.forEach((item) => {
      if (item.categoryId || !includeItem(item) || !itemMatchesSearch(item)) return
      const itemNodeId = `${ITEM_PREFIX}${item.id}`
      if (!categoryHasMatchingDescendants(itemNodeId)) return
      nodesToExpand.add(itemNodeId)
      expandChildrenWithMatches(itemNodeId)
    })

    return nodesToExpand
  }

  return {
    itemMatchesSearch,
    filteredCategoryTree,
    filteredUncategorizedItemNodeIds,
    buildExpandedNodesForSearch,
  }
}
