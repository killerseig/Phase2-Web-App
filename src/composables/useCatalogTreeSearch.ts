import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { ShopCatalogItem } from '@/services'
import type { CategoryNode, ShopCategory } from '@/stores/shopCategories'

const ITEM_PREFIX = 'item-'
const DEFAULT_DEBOUNCE_MS = 80
const DEFAULT_AUTO_EXPAND_MIN_QUERY_LENGTH = 2
const DEFAULT_AUTO_EXPAND_MAX_ITEM_MATCHES = 24

type UseCatalogTreeSearchOptions = {
  searchQuery: Ref<string>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  fullTree: Ref<CategoryNode[]>
  getCategoryById: (id: string) => ShopCategory | undefined
  getChildren: (parentId: string) => ShopCategory[]
  includeItem?: (item: ShopCatalogItem) => boolean
  debounceMs?: number
}

export type CatalogTreeMatchStrength = 'none' | 'primary' | 'secondary' | 'tertiary'
export type CatalogTreeChildNodeMap = Map<string, readonly string[]>
export type CatalogTreeItemNodeMap = Map<string, ShopCatalogItem>
export type CatalogTreeVisibleIdSet = Set<string>
export type CatalogTreeDirectMatchStrengthMap = Map<string, CatalogTreeMatchStrength>
export type CatalogTreeChildCountMap = Map<string, number>

type FlatCatalogNode = {
  nodeId: string
  kind: 'category' | 'item'
  parentNodeId: string | null
  primaryText: string
  secondaryText: string
  tertiaryText: string
}

type CatalogTreeIndex = {
  childIds: CatalogTreeChildNodeMap
  itemNodesById: CatalogTreeItemNodeMap
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

function createItemNodeId(itemId: string): string {
  return `${ITEM_PREFIX}${itemId}`
}

function normalizeSearchValue(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchValue(query)
    .split(' ')
    .filter(Boolean)
}

function includesAllTokens(haystack: string, tokens: string[]): boolean {
  if (!haystack || tokens.length === 0) return false
  return tokens.every((token) => haystack.includes(token))
}

function resolveMatchStrength(record: FlatCatalogNode, tokens: string[]): CatalogTreeMatchStrength {
  if (tokens.length === 0) return 'none'
  if (includesAllTokens(record.primaryText, tokens)) return 'primary'
  if (includesAllTokens(record.secondaryText, tokens)) return 'secondary'
  if (includesAllTokens(record.tertiaryText, tokens)) return 'tertiary'

  const combined = [record.primaryText, record.secondaryText, record.tertiaryText]
    .filter(Boolean)
    .join(' ')

  return includesAllTokens(combined, tokens) ? 'tertiary' : 'none'
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

  const debouncedSearchQuery: Ref<string> = (() => {
    if (debounceMs <= 0) {
      // No debounce — derive directly via computed for zero-latency reactivity
      return computed(() => {
        const v = options.searchQuery.value ?? ''
        return v.trim() ? v : ''
      })
    }

    const result = ref(options.searchQuery.value)
    let debounceHandle: ReturnType<typeof setTimeout> | null = null

    const stop = watch(
      () => options.searchQuery.value,
      (value) => {
        if (debounceHandle) {
          clearTimeout(debounceHandle)
          debounceHandle = null
        }

        if (!value?.trim()) {
          result.value = ''
          return
        }

        debounceHandle = setTimeout(() => {
          result.value = value
          debounceHandle = null
        }, debounceMs)
      },
      { immediate: true }
    )

    onScopeDispose(() => {
      if (debounceHandle) clearTimeout(debounceHandle)
      stop()
    })

    return result
  })()

  const normalizedQuery = computed(() => normalizeSearchValue(debouncedSearchQuery.value))
  const queryTokens = computed(() => tokenizeSearchQuery(normalizedQuery.value))
  const isSearching = computed(() => queryTokens.value.length > 0)

  const catalogIndex = computed<CatalogTreeIndex>(() => {
    const includedItems = options.allItems.value.filter((item) => includeItem(item))
    const itemIds = new Set(includedItems.map((item) => item.id))
    const categoryIds = new Set(options.categories.value.map((category) => category.id))

    const nodeRecordsById = new Map<string, FlatCatalogNode>()
    const childIdsMutable = new Map<string, string[]>()
    const itemNodesById = new Map<string, ShopCatalogItem>()

    const ensureChildBucket = (nodeId: string) => {
      if (!childIdsMutable.has(nodeId)) {
        childIdsMutable.set(nodeId, [])
      }
    }

    const normalizeParentNodeId = (parentId: string | null | undefined): string | null => {
      if (!parentId) return null
      if (parentId.startsWith(ITEM_PREFIX)) return parentId
      if (itemIds.has(parentId)) return createItemNodeId(parentId)
      if (categoryIds.has(parentId)) return parentId
      return null
    }

    options.categories.value.forEach((category) => {
      const parentNodeId = normalizeParentNodeId(category.parentId)
      nodeRecordsById.set(category.id, {
        nodeId: category.id,
        kind: 'category',
        parentNodeId,
        primaryText: normalizeSearchValue(category.name),
        secondaryText: '',
        tertiaryText: '',
      })
      ensureChildBucket(category.id)
    })

    includedItems.forEach((item) => {
      const nodeId = createItemNodeId(item.id)
      nodeRecordsById.set(nodeId, {
        nodeId,
        kind: 'item',
        parentNodeId: item.categoryId ?? null,
        primaryText: normalizeSearchValue(item.description),
        secondaryText: normalizeSearchValue(item.sku),
        tertiaryText: normalizeSearchValue(item.price),
      })
      itemNodesById.set(nodeId, item)
      ensureChildBucket(nodeId)
    })

    const pushChild = (parentNodeId: string | null, childNodeId: string) => {
      if (!parentNodeId) return
      ensureChildBucket(parentNodeId)
      childIdsMutable.get(parentNodeId)?.push(childNodeId)
    }

    options.categories.value.forEach((category) => {
      pushChild(normalizeParentNodeId(category.parentId), category.id)
    })

    includedItems.forEach((item) => {
      pushChild(item.categoryId ?? null, createItemNodeId(item.id))
    })

    const childIds: CatalogTreeChildNodeMap = new Map(
      Array.from(childIdsMutable.entries()).map(([nodeId, children]) => [nodeId, children] as const)
    )

    return {
      childIds,
      itemNodesById,
      nodeRecordsById,
      rootCategoryNodeIds: options.fullTree.value.map((category) => category.id),
      uncategorizedItemNodeIds: includedItems
        .filter((item) => !item.categoryId)
        .map((item) => createItemNodeId(item.id)),
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
    const directItemMatchIds: string[] = []

    nodeRecordsById.forEach((record, nodeId) => {
      const strength = resolveMatchStrength(record, tokens)
      if (strength === 'none') return

      directMatchStrengths.set(nodeId, strength)
      visibleIds.add(nodeId)

      if (record.kind === 'category') {
        categoryDirectMatchIds.add(nodeId)
      } else {
        directItemMatchIds.push(nodeId)
      }

      let parentNodeId = record.parentNodeId
      while (parentNodeId) {
        visibleIds.add(parentNodeId)
        parentNodeId = nodeRecordsById.get(parentNodeId)?.parentNodeId ?? null
      }
    })

    // Auto-expand all visible nodes so search results are fully revealed
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
        children.reduce((count, childNodeId) => count + (visibleIds.has(childNodeId) ? 1 : 0), 0)
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
    return searchSets.value.visibleIds.has(createItemNodeId(item.id))
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
