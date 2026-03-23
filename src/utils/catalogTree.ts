import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

const ITEM_PREFIX = 'item-'

export type CatalogTreeChildNodeMap = Map<string, readonly string[]>
export type CatalogTreeItemNodeMap = Map<string, ShopCatalogItem>
export type CatalogTreeCategoryNodeMap = Map<string, ShopCategory>

type RootOptions = {
  categories: ShopCategory[]
  items: ShopCatalogItem[]
  includeCategory?: (category: ShopCategory) => boolean
  includeItem?: (item: ShopCatalogItem) => boolean
}

type CatalogTreeIndex = {
  childIds: CatalogTreeChildNodeMap
  itemNodesById: CatalogTreeItemNodeMap
  categoryNodesById: CatalogTreeCategoryNodeMap
  rootCategoryNodeIds: string[]
  rootItemNodeIds: string[]
}

export function createCatalogItemNodeId(itemId: string): string {
  return `${ITEM_PREFIX}${itemId}`
}

export function isCatalogItemNodeId(nodeId: string): boolean {
  return nodeId.startsWith(ITEM_PREFIX)
}

export function collectCatalogSubtreeDescendants(
  childIds: CatalogTreeChildNodeMap,
  rootNodeId: string,
): {
  descendantNodeIds: string[]
  descendantCategoryIds: string[]
  descendantItemIds: string[]
} {
  const descendantNodeIds: string[] = []
  const descendantCategoryIds: string[] = []
  const descendantItemIds: string[] = []
  const visited = new Set<string>()
  const MAX_DEPTH = 250

  const walk = (nodeId: string, depth = 0) => {
    if (depth > MAX_DEPTH) return
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    for (const childId of childIds.get(nodeId) ?? []) {
      walk(childId, depth + 1)
    }

    if (nodeId === rootNodeId) return

    descendantNodeIds.push(nodeId)
    if (isCatalogItemNodeId(nodeId)) {
      descendantItemIds.push(nodeId.slice(ITEM_PREFIX.length))
    } else {
      descendantCategoryIds.push(nodeId)
    }
  }

  walk(rootNodeId)

  return {
    descendantNodeIds,
    descendantCategoryIds,
    descendantItemIds,
  }
}

export function buildCatalogTreeIndex(options: RootOptions): CatalogTreeIndex {
  const includeCategory = options.includeCategory ?? (() => true)
  const includeItem = options.includeItem ?? (() => true)

  const visibleCategories = options.categories
    .filter(includeCategory)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const visibleItems = options.items
    .filter(includeItem)
    .slice()
    .sort((a, b) => a.description.localeCompare(b.description))

  const categoryNodesById: CatalogTreeCategoryNodeMap = new Map(
    visibleCategories.map((category) => [category.id, category] as const)
  )
  const itemNodesById: CatalogTreeItemNodeMap = new Map(
    visibleItems.map((item) => [createCatalogItemNodeId(item.id), item] as const)
  )
  const visibleCategoryIds = new Set(visibleCategories.map((category) => category.id))
  const visibleItemIds = new Set(visibleItems.map((item) => item.id))
  const childIdsMutable = new Map<string, string[]>()

  const ensureChildBucket = (nodeId: string) => {
    if (!childIdsMutable.has(nodeId)) {
      childIdsMutable.set(nodeId, [])
    }
  }

  const normalizeParentNodeId = (parentId: string | null | undefined): string | null => {
    if (!parentId) return null
    if (parentId.startsWith(ITEM_PREFIX)) {
      const itemId = parentId.slice(ITEM_PREFIX.length)
      return visibleItemIds.has(itemId) ? parentId : null
    }
    if (visibleItemIds.has(parentId)) return createCatalogItemNodeId(parentId)
    if (visibleCategoryIds.has(parentId)) return parentId
    return null
  }

  visibleCategories.forEach((category) => ensureChildBucket(category.id))
  visibleItems.forEach((item) => ensureChildBucket(createCatalogItemNodeId(item.id)))

  const rootCategoryNodeIds: string[] = []
  const rootItemNodeIds: string[] = []

  visibleCategories.forEach((category) => {
    const parentNodeId = normalizeParentNodeId(category.parentId)
    if (!parentNodeId) {
      rootCategoryNodeIds.push(category.id)
      return
    }

    ensureChildBucket(parentNodeId)
    childIdsMutable.get(parentNodeId)?.push(category.id)
  })

  visibleItems.forEach((item) => {
    const nodeId = createCatalogItemNodeId(item.id)
    const parentNodeId = normalizeParentNodeId(item.categoryId ?? null)
    if (!parentNodeId) {
      rootItemNodeIds.push(nodeId)
      return
    }

    ensureChildBucket(parentNodeId)
    childIdsMutable.get(parentNodeId)?.push(nodeId)
  })

  return {
    childIds: new Map(
      Array.from(childIdsMutable.entries()).map(([nodeId, children]) => [nodeId, children] as const)
    ),
    itemNodesById,
    categoryNodesById,
    rootCategoryNodeIds,
    rootItemNodeIds,
  }
}

export function getCatalogRootNodeIds(options: RootOptions): {
  rootCategoryNodeIds: string[]
  rootItemNodeIds: string[]
} {
  const index = buildCatalogTreeIndex(options)
  return {
    rootCategoryNodeIds: index.rootCategoryNodeIds,
    rootItemNodeIds: index.rootItemNodeIds,
  }
}
