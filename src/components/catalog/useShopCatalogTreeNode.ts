import { computed } from 'vue'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import type { ShopCatalogItem } from '@/services'
import type {
  CatalogTreeChildCountMap,
  CatalogTreeDirectMatchStrengthMap,
  CatalogTreeVisibleIdSet,
} from '@/composables/useCatalogTreeSearch'
import type {
  CatalogTreeCategoryNodeMap,
  CatalogTreeChildNodeMap,
  CatalogTreeItemNodeMap,
} from '@/utils/catalogTree'
import {
  createCatalogItemNodeId,
  getCatalogItemIdFromNodeId,
  isCatalogItemNodeId,
  isCatalogParentItemId,
} from '@/utils/catalogNode'
import { normalizeCatalogOrderQuantity } from '@/utils/catalogOrder'

export interface ShopCatalogTreeNodeProps {
  nodeId: string
  expanded: Set<string>
  items?: ShopCatalogItem[]
  orderMode?: boolean
  catalogItemQtys?: Record<string, number>
  selectedItemQuantities?: Record<string, number>
  itemFilter?: (item: ShopCatalogItem) => boolean
  nodeChildIds?: CatalogTreeChildNodeMap
  itemNodesById?: CatalogTreeItemNodeMap
  categoryNodesById?: CatalogTreeCategoryNodeMap
  searchMode?: boolean
  searchVisibleIds?: CatalogTreeVisibleIdSet
  searchCategoryDirectMatchIds?: Set<string>
  searchDirectMatchStrengths?: CatalogTreeDirectMatchStrengthMap
  searchVisibleChildCounts?: CatalogTreeChildCountMap
  bypassSearchFilter?: boolean
  editingItemId?: string | null
  editingCategoryId?: string | null
  editCategoryName?: string
  savingCategoryEdit?: boolean
  depth?: number
}

export function useShopCatalogTreeNode(props: ShopCatalogTreeNodeProps) {
  const categoriesStore = useShopCategoriesStore()

  const isItemNode = computed(() => isCatalogItemNodeId(props.nodeId))
  const itemId = computed(() => getCatalogItemIdFromNodeId(props.nodeId) ?? '')
  const itemSafeId = computed(() => itemId.value || '')
  const categoryId = computed(() => (isItemNode.value ? '' : props.nodeId))

  const category = computed(() => {
    if (!categoryId.value) return null
    if (props.categoryNodesById) {
      return props.categoryNodesById.get(categoryId.value) ?? null
    }
    return categoriesStore.getCategoryById(categoryId.value) ?? null
  })

  const item = computed(() => {
    if (!itemId.value) return null
    if (props.itemNodesById) {
      return props.itemNodesById.get(props.nodeId) ?? null
    }
    if (!props.items) return null
    return props.items.find((catalogItem) => catalogItem.id === itemId.value) ?? null
  })

  const categorySafeId = computed(() => category.value?.id ?? '')
  const categorySafeName = computed(() => category.value?.name ?? '')
  const isEditingItem = computed(() => props.editingItemId === itemId.value)
  const isEditingCategory = computed(() => props.editingCategoryId === props.nodeId)
  const itemArchived = computed(() => !!item.value && item.value.active === false)
  const isArchived = computed(() => !!category.value && category.value.active === false)
  const isExpanded = computed(() => props.expanded.has(props.nodeId))
  const isSearchVisible = computed(() => props.searchVisibleIds?.has(props.nodeId) ?? true)
  const isDirectCategoryMatch = computed(() => props.searchCategoryDirectMatchIds?.has(props.nodeId) ?? false)

  const allChildren = computed(() => {
    if (props.nodeChildIds) {
      return props.nodeChildIds.get(props.nodeId) ?? []
    }

    if (categoryId.value) {
      const categoryChildren = categoriesStore.getChildren(categoryId.value).map((child) => child.id)
      let itemChildren = (props.items?.filter((catalogItem) => catalogItem.categoryId === categoryId.value) ?? [])
        .map((catalogItem) => createCatalogItemNodeId(catalogItem.id))

      if (props.itemFilter) {
        itemChildren = itemChildren.filter((nodeKey) => {
          const catalogItemId = getCatalogItemIdFromNodeId(nodeKey) ?? ''
          const catalogItem = props.items?.find((candidate) => candidate.id === catalogItemId)
          return catalogItem ? props.itemFilter!(catalogItem) : true
        })
      }

      return [...categoryChildren, ...itemChildren]
    }

    if (itemId.value) {
      return categoriesStore.categories
        .filter((catalogCategory) => isCatalogParentItemId(catalogCategory.parentId, itemId.value))
        .map((catalogCategory) => catalogCategory.id)
    }

    return []
  })

  const children = computed(() => {
    if (!props.searchMode || props.bypassSearchFilter) return allChildren.value
    if (!isSearchVisible.value) return []
    if (isDirectCategoryMatch.value) {
      return isExpanded.value ? allChildren.value : []
    }
    return allChildren.value.filter((childId) => props.searchVisibleIds?.has(childId))
  })

  const hasChildren = computed(() => allChildren.value.length > 0)
  const shouldRenderNode = computed(() => (
    !!(category.value || item.value)
    && (!props.searchMode || props.bypassSearchFilter || isSearchVisible.value)
  ))
  const animateExpansion = computed(() => !props.searchMode)
  const childBypassSearchFilter = computed(() => (
    !!props.bypassSearchFilter || (!!props.searchMode && isDirectCategoryMatch.value && isExpanded.value)
  ))
  const nodeDepth = computed(() => props.depth ?? 0)
  const depthClass = computed(() => (nodeDepth.value % 2 === 0 ? 'depth-even' : 'depth-odd'))

  const selectedItemCount = computed(() => {
    if (!props.orderMode || hasChildren.value) return 0
    const nodeKey = item.value ? itemSafeId.value : categorySafeId.value
    return nodeKey ? (props.selectedItemQuantities?.[nodeKey] ?? 0) : 0
  })

  const categoryDisplayLabel = computed(() => {
    const countSuffix = selectedItemCount.value > 0 ? ` x${selectedItemCount.value}` : ''
    return `${categorySafeName.value}${countSuffix}`
  })

  const itemDisplayLabel = computed(() => {
    const baseLabel = item.value?.description ?? ''
    const countSuffix = selectedItemCount.value > 0 ? ` x${selectedItemCount.value}` : ''
    return `${baseLabel}${countSuffix}`
  })

  return {
    item,
    itemSafeId,
    category,
    categorySafeId,
    isEditingItem,
    isEditingCategory,
    itemArchived,
    isArchived,
    isExpanded,
    hasChildren,
    children,
    shouldRenderNode,
    animateExpansion,
    childBypassSearchFilter,
    nodeDepth,
    depthClass,
    selectedItemCount,
    categoryDisplayLabel,
    itemDisplayLabel,
    getCatalogItemQty: (id: string) => normalizeCatalogOrderQuantity(props.catalogItemQtys?.[id], 1),
  }
}
