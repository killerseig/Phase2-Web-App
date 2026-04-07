import { computed, type Ref } from 'vue'
import { useCatalogTreeBrowser } from '@/composables/useCatalogTreeBrowser'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

type UseShopOrderCatalogBrowserOptions = {
  items: Ref<ShopCatalogItem[]>
  categories: Ref<ShopCategory[]>
}

export function useShopOrderCatalogBrowser(options: UseShopOrderCatalogBrowserOptions) {
  const {
    searchQuery: catalogSearch,
    expandedNodes,
    isSearching,
    searchResults,
    totalResultCount,
    hasMoreResults,
    browseTreeIndex,
    rootNodeIds,
    hasAnyNodes,
    hasSearchResults,
    toggleExpand,
    revealSearchResult,
  } = useCatalogTreeBrowser({
    items: options.items,
    categories: options.categories,
    includeCategory: (category) => category.active !== false,
    includeItem: (item) => item.active !== false,
  })

  const orderableNodeIds = computed(() => {
    const orderable = new Set<string>()

    browseTreeIndex.value.categoryNodesById.forEach((_category, nodeId) => {
      if ((browseTreeIndex.value.childIds.get(nodeId)?.length ?? 0) === 0) {
        orderable.add(nodeId)
      }
    })

    browseTreeIndex.value.itemNodesById.forEach((_item, nodeId) => {
      if ((browseTreeIndex.value.childIds.get(nodeId)?.length ?? 0) === 0) {
        orderable.add(nodeId)
      }
    })

    return orderable
  })

  const showCatalogMissingState = computed(() => !options.items.value.length)
  const showNoCatalogNodes = computed(() => !isSearching.value && !hasAnyNodes.value)
  const showSearchResults = computed(() => isSearching.value && hasSearchResults.value)
  const showNoSearchResults = computed(() => isSearching.value && !hasSearchResults.value)

  return {
    catalogSearch,
    activeExpandedNodes: computed(() => expandedNodes.value),
    browseTreeIndex,
    rootNodeIds,
    isSearching,
    searchResults,
    totalResultCount,
    hasMoreResults,
    orderableNodeIds,
    showCatalogMissingState,
    showNoCatalogNodes,
    showSearchResults,
    showNoSearchResults,
    toggleExpand,
    revealSearchResult,
  }
}
