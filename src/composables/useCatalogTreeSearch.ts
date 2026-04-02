import { computed, type Ref } from 'vue'
import { useDebouncedSearchQuery } from '@/composables/useDebouncedSearchQuery'
import type { ShopCatalogItem } from '@/services'
import type { CategoryNode, ShopCategory } from '@/stores/shopCategories'
import { createCatalogItemNodeId } from '@/utils/catalogTree'
import {
  buildCatalogSearchNodeIndex,
  normalizeCatalogSearchValue,
  resolveCatalogSearchMatchStrength,
  tokenizeCatalogSearchQuery,
  type CatalogSearchMatchStrength,
  type CatalogSearchTextRecord,
} from '@/utils/catalogSearch'

const DEFAULT_DEBOUNCE_MS = 80

type UseCatalogTreeSearchOptions = {
  searchQuery: Ref<string>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  fullTree: Ref<CategoryNode[]>
  includeItem?: (item: ShopCatalogItem) => boolean
  debounceMs?: number
}

export type CatalogTreeMatchStrength = CatalogSearchMatchStrength
export type CatalogTreeVisibleIdSet = Set<string>
export type CatalogTreeDirectMatchStrengthMap = Map<string, CatalogTreeMatchStrength>
export type CatalogTreeChildCountMap = Map<string, number>

type FlatCatalogNode = CatalogSearchTextRecord & {
  nodeId: string
  kind: 'category' | 'item'
  parentNodeId: string | null
}

type CatalogTreeIndex = {
  childIds: Map<string, string[]>
  itemNodesById: Map<string, ShopCatalogItem>
  nodeRecordsById: Map<string, FlatCatalogNode>
  rootCategoryNodeIds: string[]
  uncategorizedItemNodeIds: string[]
}

type CatalogTreeSearchSets = {
  visibleIds: CatalogTreeVisibleIdSet
  autoExpandedIds: Set<string>
  categoryDirectMatchIds: Set<string>
  directMatchStrengths: CatalogTreeDirectMatchStrengthMap
  visibleChildCounts: CatalogTreeChildCountMap
  visibleRootCategoryNodeIds: string[]
  visibleUncategorizedItemNodeIds: string[]
}

function filterTreeByVisibleIds(tree: CategoryNode[], visibleIds: Set<string>): CategoryNode[] {
  return tree
    .filter((category) => visibleIds.has(category.id))
    .map((category) => ({
      ...category,
      children: filterTreeByVisibleIds(category.children, visibleIds),
    }))
}

export function useCatalogTreeSearch(options: UseCatalogTreeSearchOptions) {
  const includeItem = options.includeItem ?? (() => true)
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  const debouncedSearchQuery = useDebouncedSearchQuery(options.searchQuery, debounceMs)
  const normalizedQuery = computed(() => normalizeCatalogSearchValue(debouncedSearchQuery.value))
  const queryTokens = computed(() => tokenizeCatalogSearchQuery(normalizedQuery.value))
  const isSearching = computed(() => queryTokens.value.length > 0)

  const catalogIndex = computed<CatalogTreeIndex>(() => {
    const includedItems = options.allItems.value.filter(includeItem)
    const nodeIndex = buildCatalogSearchNodeIndex({
      categories: options.categories.value,
      items: includedItems,
    })
    const nodeRecordsById = new Map<string, FlatCatalogNode>()
    const itemNodesById = new Map<string, ShopCatalogItem>()

    nodeIndex.nodesById.forEach((record, nodeId) => {
      nodeRecordsById.set(nodeId, {
        nodeId,
        kind: record.kind,
        parentNodeId: record.parentNodeId,
        primaryText: normalizeCatalogSearchValue(record.label),
        secondaryText: normalizeCatalogSearchValue(record.kind === 'item' ? record.sku : ''),
        tertiaryText: normalizeCatalogSearchValue(record.kind === 'item' ? record.price : ''),
      })

      if (record.kind === 'item' && record.item) {
        itemNodesById.set(nodeId, record.item)
      }
    })

    return {
      childIds: nodeIndex.childIds,
      itemNodesById,
      nodeRecordsById,
      rootCategoryNodeIds: options.fullTree.value.map((category) => category.id),
      uncategorizedItemNodeIds: nodeIndex.uncategorizedItemNodeIds,
    }
  })

  const searchSets = computed<CatalogTreeSearchSets>(() => {
    const { nodeRecordsById, childIds, rootCategoryNodeIds, uncategorizedItemNodeIds } = catalogIndex.value

    if (!isSearching.value) {
      return {
        visibleIds: new Set<string>(),
        autoExpandedIds: new Set<string>(),
        categoryDirectMatchIds: new Set<string>(),
        directMatchStrengths: new Map<string, CatalogTreeMatchStrength>(),
        visibleChildCounts: new Map<string, number>(),
        visibleRootCategoryNodeIds: rootCategoryNodeIds,
        visibleUncategorizedItemNodeIds: uncategorizedItemNodeIds,
      }
    }

    const tokens = queryTokens.value
    const visibleIds = new Set<string>()
    const autoExpandedIds = new Set<string>()
    const categoryDirectMatchIds = new Set<string>()
    const directMatchStrengths = new Map<string, CatalogTreeMatchStrength>()

    nodeRecordsById.forEach((record, nodeId) => {
      const strength = resolveCatalogSearchMatchStrength(record, tokens)
      if (strength === 'none') return

      directMatchStrengths.set(nodeId, strength)
      visibleIds.add(nodeId)

      if (record.kind === 'category') {
        categoryDirectMatchIds.add(nodeId)
      }

      let parentNodeId = record.parentNodeId
      while (parentNodeId) {
        visibleIds.add(parentNodeId)
        parentNodeId = nodeRecordsById.get(parentNodeId)?.parentNodeId ?? null
      }
    })

    visibleIds.forEach((nodeId) => {
      autoExpandedIds.add(nodeId)
    })

    const visibleChildCounts = new Map<string, number>()
    childIds.forEach((children, parentNodeId) => {
      if (!visibleIds.has(parentNodeId)) {
        visibleChildCounts.set(parentNodeId, 0)
        return
      }

      visibleChildCounts.set(
        parentNodeId,
        children.reduce((count, childNodeId) => count + (visibleIds.has(childNodeId) ? 1 : 0), 0),
      )
    })

    return {
      visibleIds,
      autoExpandedIds,
      categoryDirectMatchIds,
      directMatchStrengths,
      visibleChildCounts,
      visibleRootCategoryNodeIds: rootCategoryNodeIds.filter((nodeId) => visibleIds.has(nodeId)),
      visibleUncategorizedItemNodeIds: uncategorizedItemNodeIds.filter((nodeId) => visibleIds.has(nodeId)),
    }
  })

  const filteredCategoryTree = computed(() => {
    if (!isSearching.value) return options.fullTree.value
    return filterTreeByVisibleIds(options.fullTree.value, searchSets.value.visibleIds)
  })

  const filteredUncategorizedItemNodeIds = computed(() => {
    if (!isSearching.value) return catalogIndex.value.uncategorizedItemNodeIds
    return searchSets.value.visibleUncategorizedItemNodeIds
  })

  const itemMatchesSearch = (item: ShopCatalogItem): boolean => {
    if (!includeItem(item)) return false
    if (!isSearching.value) return true
    return searchSets.value.visibleIds.has(createCatalogItemNodeId(item.id))
  }

  const buildExpandedNodesForSearch = (): Set<string> => {
    if (!isSearching.value) return new Set<string>()
    return new Set(searchSets.value.autoExpandedIds)
  }

  return {
    searchQuery: debouncedSearchQuery,
    normalizedQuery,
    isSearching,
    itemMatchesSearch,
    filteredCategoryTree,
    filteredUncategorizedItemNodeIds,
    buildExpandedNodesForSearch,
    visibleRootCategoryNodeIds: computed(() => searchSets.value.visibleRootCategoryNodeIds),
    visibleUncategorizedItemNodeIds: computed(() => searchSets.value.visibleUncategorizedItemNodeIds),
    nodeChildIds: computed(() => catalogIndex.value.childIds),
    itemNodesById: computed(() => catalogIndex.value.itemNodesById),
    searchVisibleIds: computed(() => searchSets.value.visibleIds),
    searchCategoryDirectMatchIds: computed(() => searchSets.value.categoryDirectMatchIds),
    searchDirectMatchStrengths: computed(() => searchSets.value.directMatchStrengths),
    searchVisibleChildCounts: computed(() => searchSets.value.visibleChildCounts),
    autoExpandedNodeIds: computed(() => searchSets.value.autoExpandedIds),
  }
}
