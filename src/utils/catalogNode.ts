export const CATALOG_ITEM_NODE_PREFIX = 'item-'

export function createCatalogItemNodeId(itemId: string): string {
  return `${CATALOG_ITEM_NODE_PREFIX}${itemId}`
}

export function isCatalogItemNodeId(nodeId: string): boolean {
  return nodeId.startsWith(CATALOG_ITEM_NODE_PREFIX)
}

export function getCatalogItemIdFromNodeId(nodeId: string): string | null {
  if (!isCatalogItemNodeId(nodeId)) {
    return null
  }

  return nodeId.slice(CATALOG_ITEM_NODE_PREFIX.length)
}

export function isCatalogParentItemId(
  parentId: string | null | undefined,
  itemId: string,
): boolean {
  return parentId === itemId || parentId === createCatalogItemNodeId(itemId)
}

export function normalizeCatalogParentNodeId(
  parentId: string | null | undefined,
  categoryIds: ReadonlySet<string>,
  itemIds: ReadonlySet<string>,
): string | null {
  if (!parentId) {
    return null
  }

  const parentItemId = getCatalogItemIdFromNodeId(parentId)
  if (parentItemId) {
    return itemIds.has(parentItemId) ? parentId : null
  }

  if (itemIds.has(parentId)) {
    return createCatalogItemNodeId(parentId)
  }

  return categoryIds.has(parentId) ? parentId : null
}
