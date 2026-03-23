const ITEM_PREFIX = 'item-'
const CATEGORY_NODE_PREFIX = 'category:'
const ITEM_NODE_PREFIX = 'item:'

export function createCatalogItemNodeId(itemId) {
  return `${ITEM_PREFIX}${itemId}`
}

function createLegacyCategoryNodeId(categoryId) {
  return `${CATEGORY_NODE_PREFIX}${categoryId}`
}

function createLegacyItemNodeId(itemId) {
  return `${ITEM_NODE_PREFIX}${itemId}`
}

function getRawNodeId(legacyNodeId) {
  const separatorIndex = legacyNodeId.indexOf(':')
  return separatorIndex >= 0 ? legacyNodeId.slice(separatorIndex + 1) : legacyNodeId
}

function hasPurchasingFields(node) {
  return Boolean(
    (typeof node.sku === 'string' && node.sku.trim()) ||
    typeof node.price === 'number'
  )
}

function normalizeLegacyParentNodeId(parentId, categoryIds, itemIds) {
  if (!parentId) return null

  if (parentId.startsWith(ITEM_PREFIX)) {
    const itemId = parentId.slice(ITEM_PREFIX.length)
    return itemIds.has(itemId) ? createLegacyItemNodeId(itemId) : null
  }

  if (itemIds.has(parentId)) return createLegacyItemNodeId(parentId)
  if (categoryIds.has(parentId)) return createLegacyCategoryNodeId(parentId)
  return null
}

function buildLegacyNodes(categories, items) {
  const nodes = new Map()

  categories.forEach((category) => {
    const legacyNodeId = createLegacyCategoryNodeId(category.id)
    nodes.set(legacyNodeId, {
      legacyNodeId,
      rawId: category.id,
      sourceType: 'category',
      name: category.name ?? '',
      parentRef: typeof category.parentId === 'string' ? category.parentId : null,
      sku: category.sku,
      price: category.price,
      active: category.active ?? true,
      createdAt: category.createdAt ?? null,
      updatedAt: category.updatedAt ?? null,
    })
  })

  items.forEach((item) => {
    const legacyNodeId = createLegacyItemNodeId(item.id)
    nodes.set(legacyNodeId, {
      legacyNodeId,
      rawId: item.id,
      sourceType: 'item',
      name: item.description ?? '',
      parentRef: typeof item.categoryId === 'string' ? item.categoryId : null,
      sku: item.sku,
      price: item.price,
      active: item.active ?? true,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
    })
  })

  return nodes
}

function buildLegacyChildMap(nodes, categoryIds, itemIds) {
  const childIds = new Map()

  const ensureBucket = (nodeId) => {
    if (!childIds.has(nodeId)) {
      childIds.set(nodeId, [])
    }
  }

  nodes.forEach((node) => ensureBucket(node.legacyNodeId))

  nodes.forEach((node) => {
    const parentNodeId = normalizeLegacyParentNodeId(node.parentRef, categoryIds, itemIds)
    if (!parentNodeId) return
    ensureBucket(parentNodeId)
    childIds.get(parentNodeId).push(node.legacyNodeId)
  })

  return childIds
}

function resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds) {
  const parentNodeId = normalizeLegacyParentNodeId(node.parentRef, categoryIds, itemIds)
  if (!parentNodeId) return null
  return finalCategoryNodeIds.has(parentNodeId) ? getRawNodeId(parentNodeId) : null
}

function resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds) {
  return resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds)
}

export function planShopCatalogMigration(categories, items) {
  const categoryIds = new Set(categories.map((category) => category.id))
  const itemIds = new Set(items.map((item) => item.id))
  const nodes = buildLegacyNodes(categories, items)
  const childIds = buildLegacyChildMap(nodes, categoryIds, itemIds)

  const finalCategoryNodeIds = new Set(
    Array.from(nodes.values())
      .filter((node) => (childIds.get(node.legacyNodeId) ?? []).length > 0)
      .map((node) => node.legacyNodeId)
  )
  const finalItemNodeIds = new Set(
    Array.from(nodes.values())
      .filter((node) => (childIds.get(node.legacyNodeId) ?? []).length === 0)
      .map((node) => node.legacyNodeId)
  )

  const finalCategoryIdsFromCategories = new Set(
    categories
      .filter((category) => finalCategoryNodeIds.has(createLegacyCategoryNodeId(category.id)))
      .map((category) => category.id)
  )
  const finalItemIdsFromItems = new Set(
    items
      .filter((item) => finalItemNodeIds.has(createLegacyItemNodeId(item.id)))
      .map((item) => item.id)
  )

  const itemToCategoryIdConflicts = items
    .filter((item) => finalCategoryNodeIds.has(createLegacyItemNodeId(item.id)))
    .filter((item) => finalCategoryIdsFromCategories.has(item.id))
    .map((item) => item.id)

  const categoryToItemIdConflicts = categories
    .filter((category) => finalItemNodeIds.has(createLegacyCategoryNodeId(category.id)))
    .filter((category) => finalItemIdsFromItems.has(category.id))
    .map((category) => category.id)

  const createCategoriesFromItems = Array.from(nodes.values())
    .filter((node) => node.sourceType === 'item' && finalCategoryNodeIds.has(node.legacyNodeId))
    .map((node) => ({
      sourceItemId: node.rawId,
      id: node.rawId,
      data: {
        name: node.name,
        parentId: resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds),
        active: node.active,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
    }))

  const createItemsFromCategories = Array.from(nodes.values())
    .filter((node) => node.sourceType === 'category' && finalItemNodeIds.has(node.legacyNodeId))
    .map((node) => ({
      sourceCategoryId: node.rawId,
      id: node.rawId,
      data: {
        description: node.name,
        categoryId: resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds),
        sku: node.sku ?? null,
        price: node.price ?? null,
        active: node.active,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
    }))

  const updateCategories = Array.from(nodes.values())
    .filter((node) => node.sourceType === 'category' && finalCategoryNodeIds.has(node.legacyNodeId))
    .map((node) => {
      const updates = {}
      const nextParentId = resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds)

      if ((node.parentRef ?? null) !== nextParentId) {
        updates.parentId = nextParentId
      }

      if (node.sku !== undefined) updates.sku = null
      if (node.price !== undefined) updates.price = null

      return Object.keys(updates).length > 0 ? { id: node.rawId, updates } : null
    })
    .filter(Boolean)

  const updateItems = Array.from(nodes.values())
    .filter((node) => node.sourceType === 'item' && finalItemNodeIds.has(node.legacyNodeId))
    .map((node) => {
      const updates = {}
      const nextCategoryId = resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds)

      if ((node.parentRef ?? null) !== nextCategoryId) {
        updates.categoryId = nextCategoryId
      }

      return Object.keys(updates).length > 0 ? { id: node.rawId, updates } : null
    })
    .filter(Boolean)

  const finalItemIdsWithoutPurchasingFields = Array.from(nodes.values())
    .filter((node) => finalItemNodeIds.has(node.legacyNodeId) && !hasPurchasingFields(node))
    .map((node) => node.rawId)

  const unresolvedCategoryParents = Array.from(nodes.values())
    .filter((node) => finalCategoryNodeIds.has(node.legacyNodeId))
    .filter((node) => node.parentRef && !resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds))
    .map((node) => node.rawId)

  const unresolvedItemParents = Array.from(nodes.values())
    .filter((node) => finalItemNodeIds.has(node.legacyNodeId))
    .filter((node) => node.parentRef && !resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds))
    .map((node) => node.rawId)

  return {
    summary: {
      totalCategories: categories.length,
      totalItems: items.length,
      finalCategories: finalCategoryNodeIds.size,
      finalItems: finalItemNodeIds.size,
      convertItemsToCategories: createCategoriesFromItems.length,
      convertCategoriesToItems: createItemsFromCategories.length,
      updateCategories: updateCategories.length,
      updateItems: updateItems.length,
      deleteCategoryIds: createItemsFromCategories.length,
      deleteItemIds: createCategoriesFromItems.length,
      conflicts: itemToCategoryIdConflicts.length + categoryToItemIdConflicts.length,
    },
    createCategoriesFromItems,
    createItemsFromCategories,
    updateCategories,
    updateItems,
    deleteCategoryIds: createItemsFromCategories.map((entry) => entry.id),
    deleteItemIds: createCategoriesFromItems.map((entry) => entry.id),
    warnings: {
      finalItemIdsWithoutPurchasingFields,
      unresolvedCategoryParents,
      unresolvedItemParents,
    },
    conflicts: {
      itemToCategoryIdConflicts,
      categoryToItemIdConflicts,
    },
  }
}
