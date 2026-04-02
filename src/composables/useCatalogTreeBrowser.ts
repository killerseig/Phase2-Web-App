import { computed, nextTick, ref, type Ref } from 'vue'
import { useCatalogSearchResults, type CatalogSearchResult } from '@/composables/useCatalogSearchResults'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import { buildCatalogTreeIndex, sortCatalogNodeIds } from '@/utils/catalogTree'

type UseCatalogTreeBrowserOptions = {
  items: Ref<ShopCatalogItem[]>
  categories: Ref<ShopCategory[]>
  searchQuery?: Ref<string>
  includeCategory?: (category: ShopCategory) => boolean
  includeItem?: (item: ShopCatalogItem) => boolean
  debounceMs?: number
  maxResults?: number
  onExpandNode?: (nodeId: string, nextExpanded: Set<string>) => void
}

export function useCatalogTreeBrowser(options: UseCatalogTreeBrowserOptions) {
  const includeCategory = options.includeCategory ?? (() => true)
  const includeItem = options.includeItem ?? (() => true)
  const searchQuery = options.searchQuery ?? ref('')
  const expandedNodes = ref<Set<string>>(new Set())

  const {
    isSearching,
    results: searchResults,
    totalResultCount,
    hasMoreResults,
  } = useCatalogSearchResults({
    searchQuery,
    categories: options.categories,
    allItems: options.items,
    includeCategory,
    includeItem,
    debounceMs: options.debounceMs ?? 40,
    maxResults: options.maxResults ?? 250,
  })

  const browseTreeIndex = computed(() =>
    buildCatalogTreeIndex({
      categories: options.categories.value,
      items: options.items.value,
      includeCategory,
      includeItem,
    })
  )

  const rootNodeIds = computed(() => (
    sortCatalogNodeIds(
      [
        ...browseTreeIndex.value.rootItemNodeIds,
        ...browseTreeIndex.value.rootCategoryNodeIds,
      ],
      browseTreeIndex.value.itemNodesById,
      browseTreeIndex.value.categoryNodesById,
    )
  ))

  const hasAnyNodes = computed(() => rootNodeIds.value.length > 0)
  const hasSearchResults = computed(() => searchResults.value.length > 0)

  function updateExpandedNodes(mutator: (nextExpanded: Set<string>) => void) {
    const nextExpanded = new Set(expandedNodes.value)
    mutator(nextExpanded)
    expandedNodes.value = nextExpanded
  }

  function toggleExpand(nodeId: string) {
    updateExpandedNodes((nextExpanded) => {
      if (nextExpanded.has(nodeId)) {
        nextExpanded.delete(nodeId)
        return
      }

      nextExpanded.add(nodeId)
      options.onExpandNode?.(nodeId, nextExpanded)
    })
  }

  async function revealSearchResult(result: CatalogSearchResult) {
    searchQuery.value = ''
    updateExpandedNodes((nextExpanded) => {
      result.ancestorNodeIds.forEach((nodeId) => nextExpanded.add(nodeId))
      if (result.hasChildren) {
        nextExpanded.add(result.nodeId)
      }
    })

    await nextTick()
    const target = document.getElementById(`btn-${result.nodeId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (target instanceof HTMLElement) {
      target.focus()
    }
  }

  return {
    searchQuery,
    expandedNodes,
    browseTreeIndex,
    rootNodeIds,
    isSearching,
    searchResults,
    totalResultCount,
    hasMoreResults,
    hasAnyNodes,
    hasSearchResults,
    updateExpandedNodes,
    toggleExpand,
    revealSearchResult,
  }
}
